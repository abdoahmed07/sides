/**
 * The Progress page's "look ahead" slider: one step per day from now to the
 * end of the plan. Works from the day each page gets finished, so moving the
 * slider is instant even for plans of several years.
 */
import type { QuranIndex } from "../quran";
import { NEVER } from "./engine";
import { t, tp } from "@/i18n";

/**
 * Day (0 = today) on which each page becomes fully memorized: -1 = already,
 * NEVER = not in the plan. Index = page number (0 unused).
 */
export function pageDoneDays(ayahDays: Int32Array, q: QuranIndex): Int32Array {
  const out = new Int32Array(605).fill(-1);
  for (let i = 0; i < ayahDays.length; i++) {
    const p = q.pageOf[i];
    if (ayahDays[i] > out[p]) out[p] = ayahDays[i];
  }
  return out;
}

/** Pages fully memorized by the end of `day` (day −1 = now). */
export function pagesBy(doneDays: Int32Array, day: number): number {
  let n = 0;
  for (let p = 1; p < doneDays.length; p++) if (doneDays[p] !== NEVER && doneDays[p] <= day) n++;
  return n;
}

/** "tomorrow", "in 5 days", "in 3 weeks", "in 4 months", "in 2.5 years". */
export function inWords(days: number): string {
  if (days <= 1) return t("tomorrow");
  if (days < 14) return tp({ one: "in {n} day", other: "in {n} days" }, days);
  if (days < 60) return tp({ one: "in {n} week", other: "in {n} weeks" }, Math.round(days / 7));
  const months = Math.round(days / 30.44);
  if (months < 18) return tp({ one: "in {n} month", other: "in {n} months" }, months);
  return tp({ one: "in {n} year", other: "in {n} years" }, Math.round((days / 365.25) * 2) / 2);
}
