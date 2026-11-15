/**
 * The deterministic planning engine. Given a PlanConfig and what is already
 * memorized, it simulates the future day by day and reports the numbers the
 * UI and the AI are allowed to talk about: daily amount, study days,
 * estimated completion date and daily time needed.
 *
 * It is pure: no clocks, no storage, no randomness. "today" is passed in.
 */
import { addDays, diffDays, weekdayOf, WEEKDAYS, type IsoDate, type Weekday } from "../dates";
import type { QuranIndex } from "../quran";
import { EXCEPTION_DEFAULTS, type DateException, type PlanConfig, type PlanPatch, type RevisionLevel } from "./schema";
import { buildSequence, takePortion } from "./sequence";

export const MAX_FORECAST_DAYS = 365 * 25;
const REVISION_FACTOR: Record<RevisionLevel, number> = { normal: 1, light: 0.5, none: 0, extra: 2 };

export type DayIntensity = {
  /** Anything scheduled at all (new material or revision). */
  active: boolean;
  newMultiplier: number;
  revision: RevisionLevel;
  exception?: DateException;
};

export function dayIntensity(config: PlanConfig, date: IsoDate): DayIntensity {
  const wd = weekdayOf(date);
  const study = config.studyWeekdays.includes(wd);
  let mult = study ? 1 : 0;
  let revision: RevisionLevel = study ? "normal" : "none";
  const ov = config.weekdayOverrides[wd];
  if (study && ov) mult = ov.revisionOnly ? 0 : ov.newMultiplier;

  // Last matching exception wins, so a later "catch-up" overrides an older "travel".
  let exception: DateException | undefined;
  for (const e of config.exceptions) if (e.from <= date && date <= e.to) exception = e;
  if (exception) {
    const d = EXCEPTION_DEFAULTS[exception.kind];
    const exMult = exception.newMultiplier ?? d.newMultiplier;
    const exRev = exception.revision ?? d.revision;
    if (study || exception.kind === "catchup") {
      mult = Math.min(2, (study ? mult : 1) * exMult);
      revision = exRev;
    }
  }
  return { active: mult > 0 || revision !== "none", newMultiplier: mult, revision, exception };
}

export function newQuota(config: PlanConfig, date: IsoDate): number {
  return Math.round(config.dailyNewLines * dayIntensity(config, date).newMultiplier);
}

export type ForecastInput = {
  config: PlanConfig;
  q: QuranIndex;
  memorized: Uint8Array;
  today: IsoDate;
  /** Lines memorized on recent dates, so the first week's sabqi load is right. */
  recentAdds?: { date: IsoDate; lines: number }[];
  /** New material is paused until (and excluding) this date. */
  pausedUntil?: IsoDate | null;
};

export type Forecast = {
  today: IsoDate;
  totalTargetLines: number;
  memorizedTargetLines: number;
  remainingLines: number;
  remainingAyahs: number;
  done: boolean;
  /** Date the last new portion is memorized; null if done already or never within 25 years. */
  completionDate: IsoDate | null;
  never: boolean;
  daysToComplete: number | null;
  newStudyDays: number;
  studyDaysPerWeek: number;
  dailyNewLines: number;
  avgNewLinesPerNewDay: number;
  /** Typical minutes on a study day over the next 4 weeks. */
  typicalMinutes: number;
  /** Minutes on a study day near the end, when revision load is largest. */
  peakMinutes: number;
  targetFinishDate: IsoDate | null;
  meetsTarget: boolean | null;
  dailyMinutesBudget: number | null;
  withinBudget: boolean | null;
  feasible: boolean;
};

export function forecast(input: ForecastInput): Forecast {
  const { config, q, today } = input;
  const seq = buildSequence(config, q);
  const mem = input.memorized.slice();
  const remaining = seq.filter((i) => !mem[i]);
  const totalTargetLines = q.linesOf(seq);
  const remainingLines = q.linesOf(remaining);
  const memorizedTargetLines = totalTargetLines - remainingLines;

  // Total memorized lines (whole Quran, not just the target) drives revision load.
  let memorizedLines = q.linesOf(indicesOf(mem));
  const window: { date: IsoDate; lines: number }[] = (input.recentAdds ?? []).filter(
    (r) => diffDays(r.date, today) < config.sabqiWindowDays,
  );
  const mpl = config.pace.minutesPerNewLine;
  const mrp = config.pace.minutesPerRevisionPage;

  let pos = 0;
  let left = remaining.length;
  let completionDate: IsoDate | null = null;
  let newStudyDays = 0;
  let newLinesSum = 0;
  let typicalSum = 0;
  let typicalN = 0;
  let peakMinutes = 0;

  for (let d = 0; d < MAX_FORECAST_DAYS && left > 0; d++) {
    const date = addDays(today, d);
    const intensity = dayIntensity(config, date);
    const paused = input.pausedUntil && date < input.pausedUntil;
    const quota = paused ? 0 : Math.round(config.dailyNewLines * intensity.newMultiplier);

    let newLines = 0;
    if (quota > 0) {
      const p = takePortion(seq, mem, quota, q, pos);
      pos = p.endPos;
      for (const i of p.indices) mem[i] = 1;
      left -= p.indices.length;
      newLines = p.lines;
      if (p.indices.length) {
        newStudyDays++;
        newLinesSum += newLines;
        if (left === 0) completionDate = date;
      }
    }

    // Revision estimate for this day.
    while (window.length && diffDays(window[0].date, date) >= config.sabqiWindowDays) window.shift();
    const sabqiLines = window.reduce((s, r) => s + r.lines, 0);
    const olderLines = Math.max(0, memorizedLines - sabqiLines);
    const manzilLines = (olderLines / config.manzilCycleDays) * REVISION_FACTOR[intensity.revision];
    const sabqiFactor = intensity.revision === "none" ? 0 : 1;
    const minutes = newLines * mpl + ((sabqiLines * sabqiFactor + manzilLines) / 15) * mrp;
    if (intensity.active && d < 28) {
      typicalSum += minutes;
      typicalN++;
    }
    if (intensity.active) peakMinutes = Math.max(peakMinutes, minutes);

    if (newLines) {
      memorizedLines += newLines;
      window.push({ date, lines: newLines });
    }
  }

  const done = remaining.length === 0;
  const never = !done && completionDate === null;
  const studyDaysPerWeek = WEEKDAYS.filter((w) => config.studyWeekdays.includes(w)).length;
  const typicalMinutes = Math.round(typicalN ? typicalSum / typicalN : 0);
  const meetsTarget = config.targetFinishDate
    ? done || (completionDate !== null && completionDate <= config.targetFinishDate)
    : null;
  const withinBudget = config.dailyMinutesBudget ? typicalMinutes <= config.dailyMinutesBudget : null;

  return {
    today,
    totalTargetLines,
    memorizedTargetLines,
    remainingLines,
    remainingAyahs: remaining.length,
    done,
    completionDate,
    never,
    daysToComplete: completionDate ? diffDays(today, completionDate) + 1 : null,
    newStudyDays,
    studyDaysPerWeek,
    dailyNewLines: config.dailyNewLines,
    avgNewLinesPerNewDay: newStudyDays ? Math.round((newLinesSum / newStudyDays) * 10) / 10 : 0,
    typicalMinutes,
    peakMinutes: Math.round(peakMinutes),
    targetFinishDate: config.targetFinishDate,
    meetsTarget,
    dailyMinutesBudget: config.dailyMinutesBudget,
    withinBudget,
    feasible: meetsTarget !== false && withinBudget !== false && !never,
  };
}

function indicesOf(mem: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < mem.length; i++) if (mem[i]) out.push(i);
  return out;
}

/* ------------------------------------------------------------------ */
/* Realistic alternatives when a plan is not feasible.                  */
/* ------------------------------------------------------------------ */

export type Alternative = { id: string; label: string; patch: PlanPatch; forecast: Forecast };

function withLines(config: PlanConfig, lines: number): PlanConfig {
  return { ...config, dailyNewLines: lines };
}

/** Smallest daily amount (1-45 lines) that meets the target date, or null. */
export function requiredLinesForTarget(input: ForecastInput): number | null {
  if (!input.config.targetFinishDate) return null;
  const meets = (l: number) => forecast({ ...input, config: withLines(input.config, l) }).meetsTarget === true;
  if (!meets(45)) return null;
  let lo = 1;
  let hi = 45;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (meets(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** Largest daily amount whose typical minutes fit the budget, or null if even 1 line does not. */
export function maxLinesWithinBudget(input: ForecastInput): number | null {
  const budget = input.config.dailyMinutesBudget;
  if (!budget) return null;
  const fits = (l: number) => forecast({ ...input, config: withLines(input.config, l) }).typicalMinutes <= budget;
  if (!fits(1)) return null;
  let lo = 1;
  let hi = 45;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Up to 3 realistic alternatives, each a patch plus its engine forecast. */
export function alternatives(input: ForecastInput): Alternative[] {
  const base = forecast(input);
  const out: Alternative[] = [];
  const add = (id: string, label: string, patch: PlanPatch, config: PlanConfig) => {
    out.push({ id, label, patch, forecast: forecast({ ...input, config }) });
  };
  const { config } = input;

  const budgetLines = maxLinesWithinBudget(input);
  if (base.withinBudget === false && budgetLines) {
    const c = withLines(config, budgetLines);
    add("fit-time", `Keep your ${config.dailyMinutesBudget} minutes a day`, { set: { dailyNewLines: budgetLines } }, c);
  }

  const needLines = requiredLinesForTarget(input);
  if (base.meetsTarget === false && needLines && needLines !== config.dailyNewLines) {
    const c = withLines(config, needLines);
    add("meet-deadline", "Keep your deadline", { set: { dailyNewLines: needLines } }, c);
  }

  if (base.meetsTarget === false && config.studyWeekdays.length < 7) {
    const all: Weekday[] = [...WEEKDAYS];
    const c = { ...config, studyWeekdays: all };
    const lines = budgetLines ? Math.min(config.dailyNewLines, budgetLines) : config.dailyNewLines;
    add("every-day", "Study every day", { set: { studyWeekdays: all, dailyNewLines: lines } }, withLines(c, lines));
  }

  // A realistic deadline: what the budget-respecting pace actually reaches.
  if (base.meetsTarget === false) {
    const lines = budgetLines ? Math.min(config.dailyNewLines, budgetLines) : config.dailyNewLines;
    const f = forecast({ ...input, config: withLines(config, lines) });
    if (f.completionDate) {
      const c = { ...withLines(config, lines), targetFinishDate: f.completionDate };
      add("move-deadline", "Move the deadline", { set: { dailyNewLines: lines, targetFinishDate: f.completionDate } }, c);
    }
  }

  return out.filter((a) => a.forecast.feasible).slice(0, 3);
}
