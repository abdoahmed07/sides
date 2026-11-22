/**
 * Plain-language facts about revision for the Today screen: how long a page
 * stays in sabqi, and how far the manzil round has come. Uses the same rules
 * as buildDay (day.ts), so what it says matches what the schedule does.
 */
import { addDays, diffDays, type IsoDate } from "../dates";
import type { PlanConfig } from "../plan/schema";
import type { QuranIndex } from "../quran";
import type { MemUnit } from "../srs";
import { unitLines } from "./day";

export type SabqiDay = {
  /** 1 = the day after it was memorized. */
  day: number;
  /** Days a page is revised in sabqi. */
  of: number;
  /** First day it is part of manzil instead. */
  manzilFrom: IsoDate;
};

/** Where a page is in its sabqi days (it shows on days 1 … window−1 after it was memorized). */
export function sabqiDay(u: MemUnit, windowDays: number, today: IsoDate): SabqiDay {
  const of = Math.max(1, windowDays - 1);
  return { day: Math.min(of, Math.max(1, diffDays(u.lastAdded, today))), of, manzilFrom: addDays(u.lastAdded, windowDays) };
}

export type ManzilRound = {
  /** Days in the round (the plan's manzil cycle). */
  cycleDays: number;
  /** Pages that are part of manzil now. */
  total: number;
  /** Of those, revised within the last `cycleDays` days (newest first). */
  revised: { page: number; date: IsoDate }[];
  /** Not revised in that time, in the order they will come up. */
  coming: number[];
  /** Roughly how many pages a day manzil gives (0 when there is no manzil yet). */
  pagesPerDay: number;
};

const strengthOrder = (u: MemUnit) => (u.strength === "weak" ? 0 : u.strength === "okay" ? 1 : u.strength === null ? 2 : 3);

export function manzilRound(config: PlanConfig, units: MemUnit[], q: QuranIndex, today: IsoDate): ManzilRound {
  const windowStart = addDays(today, -config.sabqiWindowDays);
  const pool = units.filter((u) => u.lastAdded < today && !(u.lastAdded > windowStart));
  const cycleDays = config.manzilCycleDays;
  const recent = (u: MemUnit) => u.lastRevised !== null && diffDays(u.lastRevised, today) < cycleDays;

  const revised = pool
    .filter(recent)
    .map((u) => ({ page: u.page, date: u.lastRevised! }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.page - b.page);
  const coming = pool
    .filter((u) => !recent(u))
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue) || strengthOrder(a) - strengthOrder(b) || a.page - b.page)
    .map((u) => u.page);

  const lines = pool.reduce((s, u) => s + unitLines(u, q), 0);
  const pagesPerDay = lines ? Math.max(0.5, Math.round((lines / cycleDays / 15) * 2) / 2) : 0;
  return { cycleDays, total: pool.length, revised, coming, pagesPerDay };
}
