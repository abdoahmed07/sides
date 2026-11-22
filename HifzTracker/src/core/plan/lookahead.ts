/**
 * The Progress page's "look ahead" slider: steps from now to the end of the
 * plan (weekly for short plans, monthly or slower for long ones), and page
 * counts for a memorized array.
 */
import { addDays, diffDays, type IsoDate } from "../dates";
import type { QuranIndex } from "../quran";

export type Stop = { date: IsoDate; label: string; end: boolean };

const MAX_STOPS = 14;

function inWords(days: number): string {
  if (days < 14) return "in 1 week";
  if (days < 56) return `in ${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30.44);
  if (months < 18) return `in ${months} month${months === 1 ? "" : "s"}`;
  const years = Math.round((days / 365.25) * 2) / 2;
  return `in ${years} years`;
}

/** Future steps up to and including the finish date (now itself is not a stop). */
export function lookAheadStops(today: IsoDate, finish: IsoDate | null): Stop[] {
  if (!finish) return [];
  const span = diffDays(today, finish);
  if (span <= 0) return [];
  let step = 7;
  if (span / 7 > MAX_STOPS) step = 28;
  if (span / 28 > MAX_STOPS) step = Math.ceil(span / MAX_STOPS / 28) * 28;
  const stops: Stop[] = [];
  for (let d = step; d < span - step / 3; d += step) stops.push({ date: addDays(today, d), label: inWords(d), end: false });
  stops.push({ date: finish, label: "End of plan", end: true });
  return stops;
}

function perPage(memorized: Uint8Array, q: QuranIndex): Map<number, number> {
  const per = new Map<number, number>();
  for (let i = 0; i < memorized.length; i++) if (memorized[i]) per.set(q.pageOf[i], (per.get(q.pageOf[i]) ?? 0) + 1);
  return per;
}

/** Pages fully memorized in `memorized`. */
export function fullPagesOf(memorized: Uint8Array, q: QuranIndex): Set<number> {
  return new Set([...perPage(memorized, q)].filter(([page, n]) => n >= q.ayahsOnPage(page)).map(([page]) => page));
}

/** Whole pages memorized, and pages started but not finished. */
export function pageCounts(memorized: Uint8Array, q: QuranIndex): { full: number; partial: number } {
  const per = perPage(memorized, q);
  const full = fullPagesOf(memorized, q).size;
  return { full, partial: per.size - full };
}
