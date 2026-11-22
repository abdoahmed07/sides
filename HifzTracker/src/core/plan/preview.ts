/**
 * Previewing a plan change: apply a patch (and memorized selections) in
 * memory, run the engine before and after, and describe what changed.
 * Pure, so it runs both in the browser and in the AI route (as the
 * `preview_plan` tool the model uses to see real numbers).
 */
import { addDays, formatDate, WEEKDAY_LABEL, WEEKDAYS, type IsoDate, type Weekday } from "../dates";
import { markPrior } from "../memorize";
import { estimatePauseDays } from "../missed";
import type { QuranIndex } from "../quran";
import { buildDay, recentAdds } from "../schedule/day";
import type { MemUnit } from "../srs";
import { totals } from "../stats";
import { alternatives, forecast, projectMemorized, requiredLinesForTarget, type Forecast, type ForecastInput } from "./engine";
import { applyPatch } from "./patch";
import type { MemorizedSelection, PlanConfig, PlanPatch } from "./schema";
import { selectionIndices } from "./sequence";
import { alternativeFacts, keyNumbers, type KeyNumbers } from "./summary";

export function memorizedArray(units: MemUnit[], q: QuranIndex): Uint8Array {
  const m = new Uint8Array(q.count);
  for (const u of units) for (const i of u.ayahs) m[i] = 1;
  return m;
}

function forecastInput(config: PlanConfig, units: MemUnit[], q: QuranIndex, today: IsoDate): ForecastInput {
  let pausedUntil: IsoDate | null = null;
  if (config.pauseNewUntilCaughtUp) {
    const day = buildDay(config, q, units, today);
    const days = estimatePauseDays(day.overdueLines, day.manzilQuotaLines);
    if (days > 0) pausedUntil = addDays(today, days);
  }
  return { config, q, memorized: memorizedArray(units, q), today, recentAdds: recentAdds(units, q, today, config.sabqiWindowDays), pausedUntil };
}

export function forecastFor(config: PlanConfig, units: MemUnit[], q: QuranIndex, today: IsoDate): Forecast {
  return forecast(forecastInput(config, units, q, today));
}

/** What will be memorized at each date if the plan is kept (same assumptions as forecastFor). */
export function projectionFor(config: PlanConfig, units: MemUnit[], q: QuranIndex, today: IsoDate, dates: IsoDate[]): Uint8Array[] {
  return projectMemorized(forecastInput(config, units, q, today), dates);
}

/** Key numbers plus, when a target date is set, the daily amount that finishes exactly by it. */
export function numbersFor(config: PlanConfig, units: MemUnit[], q: QuranIndex, today: IsoDate): KeyNumbers {
  const k = keyNumbers(config, forecastFor(config, units, q, today));
  const t = totals(units, q);
  k.memorizedPages = t.fullPages;
  k.memorizedPartPages = t.partialPages;
  if (config.targetFinishDate && !k.done) {
    k.linesToFinishByTarget = requiredLinesForTarget({ config, q, memorized: memorizedArray(units, q), today });
  }
  return k;
}

export type Preview = {
  ok: true;
  before: KeyNumbers | null;
  after: KeyNumbers;
  config: PlanConfig;
  units: MemUnit[];
  changed: string[];
  /** Plain-language list of what this change does, generated from the patch (never from the AI's words). */
  changes: string[];
  alternatives: { id: string; label: string; patch: PlanPatch; numbers: KeyNumbers }[];
};

export function evaluateChange(opts: {
  base: PlanConfig;
  hasPlan: boolean;
  patch: PlanPatch | null;
  markMemorized?: MemorizedSelection[] | null;
  units: MemUnit[];
  today: IsoDate;
  q: QuranIndex;
}): Preview | { ok: false; errors: string[] } {
  const { base, today, q } = opts;
  let config = base;
  let changed: string[] = [];
  if (opts.patch) {
    const r = applyPatch(base, opts.patch, today);
    if (!r.ok) return r;
    config = r.config;
    changed = r.changed;
  }
  let units = opts.units;
  if (opts.markMemorized?.length) {
    const idx = opts.markMemorized.flatMap((s) => selectionIndices(s, q));
    units = markPrior(units, idx, q, today, config.manzilCycleDays);
    changed.push("memorized");
  }
  const before = opts.hasPlan ? numbersFor(base, opts.units, q, today) : null;
  const after = numbersFor(config, units, q, today);
  const rawAlts = alternatives({ config, q, memorized: memorizedArray(units, q), today });
  const alts = alternativeFacts(config, rawAlts).map((a, k) => ({ ...a, patch: rawAlts[k].patch }));
  const changes = describeChanges(opts.hasPlan ? base : null, config, opts.markMemorized ?? [], q);
  return { ok: true, before, after, config, units, changed, changes, alternatives: alts };
}

/**
 * Short label for a list of surahs: Juz 30 (An-Naba to An-Nas) is named as
 * such, other runs of 3+ consecutive surahs become "X to Y".
 */
export function surahListLabel(surahs: number[], q: QuranIndex): string {
  const sorted = [...new Set(surahs)].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const n of sorted) {
    const last = runs[runs.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else runs.push([n, n]);
  }
  const name = (n: number) => q.surah(n).nameEn;
  const parts: string[] = [];
  const run = (a: number, b: number) => {
    if (b - a >= 2) parts.push(`${name(a)} to ${name(b)}`);
    else for (let n = a; n <= b; n++) parts.push(name(n));
  };
  for (const [a, b] of runs) {
    if (a <= 78 && b === 114) {
      if (a < 78) run(a, 77);
      parts.push("Juz 30");
    } else run(a, b);
  }
  return parts.join(", ");
}

function targetLabel(c: PlanConfig, q: QuranIndex): string {
  const t = c.target;
  const startName = `${q.surah(c.start.surah).nameEn} ${c.start.ayah}`;
  const what =
    t.type === "quran"
      ? "the whole Quran"
      : t.type === "juz"
        ? `Juz ${t.juz.join(", ")}`
        : t.type === "surah"
          ? surahListLabel(t.surahs, q)
          : `pages ${t.from}–${t.to}`;
  return `${what}, starting at ${startName} (${c.direction})`;
}

function selectionLabel(s: MemorizedSelection, q: QuranIndex): string {
  switch (s.type) {
    case "surah":
      return surahListLabel(s.surahs, q);
    case "juz":
      return `Juz ${s.juz.join(", ")}`;
    case "pages":
      return `pages ${s.from}–${s.to}`;
    case "ayahs":
      return `${q.surah(s.surah).nameEn} ${s.from}–${s.to}`;
  }
}

/** Human-readable diff between two configs (or a description of a new one). */
export function describeChanges(before: PlanConfig | null, after: PlanConfig, marked: MemorizedSelection[], q: QuranIndex): string[] {
  const out: string[] = [];
  const days = (c: PlanConfig) =>
    c.studyWeekdays.length === 7 ? "every day" : WEEKDAYS.filter((d) => c.studyWeekdays.includes(d)).map((d) => WEEKDAY_LABEL[d]).join(", ");
  const diff = (label: string, get: (c: PlanConfig) => string) => {
    const a = get(after);
    if (!before) out.push(`${label}: ${a}`);
    else if (get(before) !== a) out.push(`${label}: ${get(before)} → ${a}`);
  };
  diff("Memorize", (c) => targetLabel(c, q));
  diff("New per study day", (c) => `${c.dailyNewLines} lines`);
  diff("Study days", days);
  diff("Target date", (c) => (c.targetFinishDate ? formatDate(c.targetFinishDate) : "none"));
  diff("Time available", (c) => (c.dailyMinutesBudget ? `${c.dailyMinutesBudget} min/day` : "not set"));
  diff("Sabqi window", (c) => `${c.sabqiWindowDays} days`);
  diff("Manzil cycle", (c) => `${c.manzilCycleDays} days`);
  diff("Experience", (c) => c.experience);
  diff("Lighter weekdays", (c) =>
    Object.entries(c.weekdayOverrides)
      .map(([d, o]) => `${WEEKDAY_LABEL[d as keyof typeof WEEKDAY_LABEL]} ${o?.revisionOnly ? "revision only" : `×${o?.newMultiplier}`}`)
      .join(", ") || "none",
  );
  diff("Weekly reading", (c) => {
    const r = c.weeklyReadings ?? [];
    if (!r.length) return "none";
    // One entry per surah: "Al-Mulk daily", "Al-Kahf on Fri", "Al-Waqiah on Mon, Thu".
    const bySurah = new Map<number, Weekday[]>();
    for (const x of r) bySurah.set(x.surah, [...(bySurah.get(x.surah) ?? []), x.day]);
    return [...bySurah]
      .map(([surah, days]) => {
        const name = q.surah(surah).nameEn;
        if (days.length === 7) return `${name} daily`;
        return `${name} on ${WEEKDAYS.filter((d) => days.includes(d)).map((d) => WEEKDAY_LABEL[d]).join(", ")}`;
      })
      .join(", ");
  });
  diff("New memorization paused", (c) => (c.pauseNewUntilCaughtUp ? "until revision is caught up" : "no"));
  const exKey = (c: PlanConfig) => c.exceptions.map((e) => `${e.kind} ${formatDate(e.from)}–${formatDate(e.to)}`).join("; ") || "none";
  diff("Exceptions", exKey);
  for (const s of marked) out.push(`Mark as already memorized: ${selectionLabel(s, q)}`);
  return out;
}

/** Compact ranges of memorized ayah indices, e.g. [[7, 230], [5673, 6235]]. */
export function memorizedRanges(units: MemUnit[], q: QuranIndex): [number, number][] {
  const m = memorizedArray(units, q);
  const out: [number, number][] = [];
  for (let i = 0; i < m.length; i++) {
    if (!m[i]) continue;
    let j = i;
    while (j + 1 < m.length && m[j + 1]) j++;
    out.push([i, j]);
    i = j;
  }
  return out;
}

/** Rebuilds approximate units from memorized ranges (used server-side for the AI's preview tool). */
export function unitsFromRanges(ranges: [number, number][], q: QuranIndex, today: IsoDate, cycleDays: number): MemUnit[] {
  const idx: number[] = [];
  for (const [a, b] of ranges) for (let i = Math.max(0, a); i <= Math.min(q.count - 1, b); i++) idx.push(i);
  return markPrior([], idx, q, today, cycleDays);
}
