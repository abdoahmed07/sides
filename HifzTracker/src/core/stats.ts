/**
 * Progress statistics: streaks, heatmap, totals, per-juz/per-surah progress
 * and the colour status of each Mushaf page. Pure.
 */
import { addDays, diffDays, type IsoDate } from "./dates";
import { dayIntensity } from "./plan/engine";
import type { PlanConfig } from "./plan/schema";
import { TOTAL_PAGES, type QuranIndex } from "./quran";
import { unitStatus, type MemUnit, type Strength } from "./srs";

/**
 * A streak counts consecutive scheduled days with at least one completed item.
 * Unscheduled days (rest days, non-study weekdays) neither break nor extend it.
 * Today not yet done does not break the current streak.
 */
export function streaks(config: PlanConfig | null, activeDates: Set<IsoDate>, today: IsoDate) {
  if (activeDates.size === 0) return { current: 0, longest: 0 };
  const dates = [...activeDates].sort();
  const first = dates[0];
  const scheduled = (d: IsoDate) => (config ? dayIntensity(config, d).active : true);
  let longest = 0;
  let run = 0;
  const span = diffDays(first, today);
  for (let i = 0; i <= span; i++) {
    const d = addDays(first, i);
    if (activeDates.has(d)) {
      run++;
      longest = Math.max(longest, run);
    } else if (scheduled(d) && d !== today) {
      run = 0;
    }
  }
  return { current: run, longest };
}

export type PageStatus = "none" | "partial" | "memorized" | "strong" | "due" | "weak";

/**
 * Status of every page for the mushaf map. `pendingToday` is the pages still
 * left to revise on today's list: when given, only those count as "due". (The
 * plan spreads manzil over its cycle, so a page can be past its review date
 * yet deliberately left for a later day.)
 */
export function pageStatuses(units: MemUnit[], q: QuranIndex, today: IsoDate, pendingToday?: ReadonlySet<number>): PageStatus[] {
  const out: PageStatus[] = new Array(TOTAL_PAGES + 1).fill("none");
  for (const u of units) {
    let s = unitStatus(u, today);
    if (pendingToday && s === "due") s = u.strength === "strong" ? "strong" : "memorized";
    if (pendingToday?.has(u.page) && s !== "weak") s = "due";
    const full = u.ayahs.length >= q.ayahsOnPage(u.page);
    out[u.page] = s === "memorized" && !full ? "partial" : s;
  }
  return out;
}

export function totals(units: MemUnit[], q: QuranIndex) {
  let ayahs = 0;
  let fullPages = 0;
  let lines = 0;
  for (const u of units) {
    ayahs += u.ayahs.length;
    if (u.ayahs.length >= q.ayahsOnPage(u.page)) fullPages++;
    lines += q.linesOf(u.ayahs);
  }
  return { ayahs, fullPages, pagesEquivalent: Math.round((lines / 15) * 10) / 10, pagesTouched: units.length };
}

export function juzProgress(units: MemUnit[], q: QuranIndex) {
  const memorized = new Uint8Array(q.count);
  for (const u of units) for (const i of u.ayahs) memorized[i] = 1;
  return Array.from({ length: 30 }, (_, k) => {
    const [a, b] = q.juzRange(k + 1);
    let n = 0;
    for (let i = a; i <= b; i++) n += memorized[i];
    return { juz: k + 1, memorized: n, total: b - a + 1 };
  });
}

export function surahProgress(units: MemUnit[], q: QuranIndex) {
  const memorized = new Uint8Array(q.count);
  for (const u of units) for (const i of u.ayahs) memorized[i] = 1;
  return q.surahs.map((s) => {
    const [a, b] = q.surahRange(s.n);
    let n = 0;
    for (let i = a; i <= b; i++) n += memorized[i];
    return { surah: s.n, name: s.nameEn, arabic: s.name, memorized: n, total: s.ayahs };
  });
}

export type DayLogLike = { date: IsoDate; items: { done: boolean; rating?: Strength | null; kind: string }[] };

export function activeDatesOf(logs: DayLogLike[]): Set<IsoDate> {
  return new Set(logs.filter((l) => l.items.some((i) => i.done)).map((l) => l.date));
}

/** Completed items per day, for the calendar heatmap. */
export function heatmap(logs: DayLogLike[]): Map<IsoDate, number> {
  const m = new Map<IsoDate, number>();
  for (const l of logs) {
    const n = l.items.filter((i) => i.done).length;
    if (n) m.set(l.date, n);
  }
  return m;
}

/** Compact aggregate stats for the weekly check-in (the only thing sent to the AI). */
export function weeklySummary(
  config: PlanConfig,
  logs: DayLogLike[],
  units: MemUnit[],
  q: QuranIndex,
  today: IsoDate,
) {
  const from = addDays(today, -7);
  const week = logs.filter((l) => l.date >= from && l.date < today);
  const items = week.flatMap((l) => l.items);
  const done = items.filter((i) => i.done);
  const ratings = { strong: 0, okay: 0, weak: 0 };
  for (const i of done) if (i.rating) ratings[i.rating]++;
  let scheduledDays = 0;
  for (let k = 0; k < 7; k++) if (dayIntensity(config, addDays(from, k)).active) scheduledDays++;
  const overduePages = units.filter((u) => u.nextDue < today).length;
  const weakPages = units.filter((u) => u.strength === "weak").length;
  const s = streaks(config, activeDatesOf(logs), today);
  const kinds = (k: string) => {
    const all = items.filter((i) => i.kind === k);
    return { assigned: all.length, done: all.filter((i) => i.done).length };
  };
  return {
    period: { from, to: addDays(today, -1) },
    scheduledDays,
    activeDays: week.filter((l) => l.items.some((i) => i.done)).length,
    completionRate: items.length ? Math.round((done.length / items.length) * 100) : 0,
    sabaq: kinds("sabaq"),
    sabqi: kinds("sabqi"),
    manzil: kinds("manzil"),
    ratings,
    overduePages,
    weakPages,
    memorizedPages: totals(units, q).pagesEquivalent,
    currentStreak: s.current,
  };
}
export type WeeklySummary = ReturnType<typeof weeklySummary>;
