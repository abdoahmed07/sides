/**
 * Previewing a plan change: apply a patch (and memorized selections) in
 * memory, run the engine before and after, and describe what changed.
 * Pure, so it runs both in the browser and in the AI route (as the
 * `preview_plan` tool the model uses to see real numbers).
 */
import { addDays, formatDate, weekdayLabel, WEEKDAYS, type IsoDate, type Weekday } from "../dates";
import { markPrior } from "../memorize";
import { estimatePauseDays } from "../missed";
import type { QuranIndex } from "../quran";
import { buildDay, recentAdds } from "../schedule/day";
import type { MemUnit } from "../srs";
import { totals } from "../stats";
import { alternatives, forecast, memorizeDays, requiredLinesForTarget, type Forecast, type ForecastInput } from "./engine";
import { applyPatch } from "./patch";
import { EXCEPTION_DEFAULTS, type MemorizedSelection, type PlanConfig, type PlanPatch, type WeeklyReading } from "./schema";
import { buildSequence, selectionIndices } from "./sequence";
import { alternativeFacts, keyNumbers, type KeyNumbers } from "./summary";
import { isRtl, t, tp, tx } from "@/i18n";

const EXPERIENCE_LABEL: Record<string, string> = { beginner: tx("First time"), intermediate: tx("Yes, some"), advanced: tx("Yes, a lot") };

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

/** The day (0 = today) each ayah gets memorized if the plan is kept (same assumptions as forecastFor). */
export function memorizeDaysFor(config: PlanConfig, units: MemUnit[], q: QuranIndex, today: IsoDate): Int32Array {
  return memorizeDays(forecastInput(config, units, q, today));
}

/** Key numbers plus, when a target date is set, the daily amount that finishes exactly by it. */
export function numbersFor(config: PlanConfig, units: MemUnit[], q: QuranIndex, today: IsoDate): KeyNumbers {
  const k = keyNumbers(config, forecastFor(config, units, q, today));
  const t = totals(units, q);
  k.memorizedPages = t.fullPages;
  k.memorizedPartPages = t.partialPages;
  k.pagesLeft = pagesLeft(config, units, q);
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
  const name = (n: number) => q.surahName(n);
  const parts: string[] = [];
  const run = (a: number, b: number) => {
    if (b - a >= 2) parts.push(t("{from} to {to}", { from: name(a), to: name(b) }));
    else for (let n = a; n <= b; n++) parts.push(name(n));
  };
  for (const [a, b] of runs) {
    if (a <= 78 && b === 114) {
      if (a < 78) run(a, 77);
      parts.push(t("Juz {n}", { n: 30 }));
    } else run(a, b);
  }
  return parts.join(", ");
}

function targetLabel(c: PlanConfig, q: QuranIndex): string {
  const tg = c.target;
  const startName = `${q.surahName(c.start.surah)} ${c.start.ayah}`;
  const what =
    tg.type === "quran"
      ? t("the whole Quran")
      : tg.type === "juz"
        ? t("Juz {n}", { n: tg.juz.join(", ") })
        : tg.type === "surah"
          ? surahListLabel(tg.surahs, q)
          : t("pages {from}–{to}", { from: tg.from, to: tg.to });
  return t("{what}, starting at {start} ({direction})", {
    what,
    start: startName,
    direction: c.direction === "backward" ? t("from the end") : t("from the beginning"),
  });
}

function selectionLabel(s: MemorizedSelection, q: QuranIndex): string {
  switch (s.type) {
    case "surah":
      return surahListLabel(s.surahs, q);
    case "juz":
      return t("Juz {n}", { n: s.juz.join(", ") });
    case "pages":
      return t("pages {from}–{to}", { from: s.from, to: s.to });
    case "ayahs":
      return `${q.surahName(s.surah)} ${s.from}–${s.to}`;
  }
}

/** Human-readable diff between two configs (or a description of a new one). */
export function describeChanges(before: PlanConfig | null, after: PlanConfig, marked: MemorizedSelection[], q: QuranIndex): string[] {
  const out: string[] = [];
  const days = (c: PlanConfig) =>
    c.studyWeekdays.length === 7 ? t("every day") : WEEKDAYS.filter((d) => c.studyWeekdays.includes(d)).map((d) => weekdayLabel(d)).join(", ");
  const diff = (label: string, get: (c: PlanConfig) => string) => {
    const a = get(after);
    if (!before) out.push(`${t(label)}: ${a}`);
    else if (get(before) !== a) out.push(`${t(label)}: ${get(before)} ${isRtl() ? "←" : "→"} ${a}`);
  };
  const none = t("none");
  diff(tx("Memorize"), (c) => targetLabel(c, q));
  diff(tx("New per study day"), (c) => tp({ one: "{n} line", other: "{n} lines" }, c.dailyNewLines));
  diff(tx("Study days"), days);
  diff(tx("Target date"), (c) => (c.targetFinishDate ? formatDate(c.targetFinishDate) : none));
  diff(tx("Time available"), (c) => (c.dailyMinutesBudget ? t("{n} min/day", { n: c.dailyMinutesBudget }) : t("not set")));
  diff(tx("Sabqi window"), (c) => tp({ one: "{n} day", other: "{n} days" }, c.sabqiWindowDays));
  diff(tx("Manzil cycle"), (c) => tp({ one: "{n} day", other: "{n} days" }, c.manzilCycleDays));
  diff(tx("Experience"), (c) => t(EXPERIENCE_LABEL[c.experience] ?? c.experience));
  diff(tx("Lighter weekdays"), (c) =>
    Object.entries(c.weekdayOverrides)
      .map(([d, o]) => `${weekdayLabel(d as Weekday)} ${o?.revisionOnly ? t("revision only") : `×${o?.newMultiplier}`}`)
      .join(", ") || none,
  );
  diff(tx("Weekly reading"), (c) => readingsLabel(c.weeklyReadings ?? [], q) || none);
  diff(tx("New memorization paused"), (c) => (c.pauseNewUntilCaughtUp ? t("until revision is caught up") : t("no")));
  const exKey = (c: PlanConfig) =>
    c.exceptions.map((e) => `${t(EXCEPTION_DEFAULTS[e.kind].label)} ${formatDate(e.from)}${e.to !== e.from ? `–${formatDate(e.to)}` : ""}`).join("; ") || none;
  diff(tx("Travel, exams, Ramadan"), exKey);
  for (const s of marked) out.push(t("Mark as already memorized: {what}", { what: selectionLabel(s, q) }));
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

/** Pages of the target with anything still to memorize (whole pages, as people count them). */
export function pagesLeft(config: PlanConfig, units: MemUnit[], q: QuranIndex): number {
  const mem = memorizedArray(units, q);
  const pages = new Set<number>();
  for (const i of buildSequence(config, q)) if (!mem[i]) pages.add(q.pageOf[i]);
  return pages.size;
}

/** "Al-Mulk daily, Al-Kahf on Fri, Al-Waqi'ah on Mon, Thu"; "" when there are none. */
export function readingsLabel(r: WeeklyReading[], q: QuranIndex): string {
  const bySurah = new Map<number, Weekday[]>();
  for (const x of r) bySurah.set(x.surah, [...(bySurah.get(x.surah) ?? []), x.day]);
  return [...bySurah]
    .map(([surah, days]) => {
      const name = q.surahName(surah);
      if (days.length === 7) return t("{surah} daily", { surah: name });
      return t("{surah} on {days}", { surah: name, days: WEEKDAYS.filter((d) => days.includes(d)).map((d) => weekdayLabel(d)).join(", ") });
    })
    .join(", ");
}
