/**
 * Plain-language facts about revision for the Today screen: how long a page
 * stays in sabqi, and how far the manzil round has come. Uses the same rules
 * as buildDay (day.ts), so what it says matches what the schedule does.
 */
import { addDays, diffDays, type IsoDate } from "../dates";
import type { PlanConfig } from "../plan/schema";
import type { MemUnit } from "../srs";
import { comesBack, inSabqi } from "./day";

export type SabqiDay = {
  /** 1 = the day after it was memorized. */
  day: number;
  /** Days a page is revised in sabqi. */
  of: number;
  /** First day it is part of manzil instead. */
  manzilFrom: IsoDate;
  /** Kept in sabqi past its usual days, after a weak rating. */
  kept: boolean;
};

/** Where a page is in its sabqi days (it shows on days 1 … window−1 after it was memorized). */
export function sabqiDay(u: MemUnit, windowDays: number, today: IsoDate): SabqiDay {
  const of = Math.max(1, windowDays - 1);
  const usual = addDays(u.lastAdded, windowDays);
  const kept = !!u.holdUntil && u.holdUntil >= today && today >= usual;
  const manzilFrom = u.holdUntil && u.holdUntil >= usual ? addDays(u.holdUntil, 1) : usual;
  return { day: Math.min(of, Math.max(1, diffDays(u.lastAdded, today))), of, manzilFrom, kept };
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
};

const strengthOrder = (u: MemUnit) => (u.strength === "weak" ? 0 : u.strength === "okay" ? 1 : u.strength === null ? 2 : 3);

export function manzilRound(config: PlanConfig, units: MemUnit[], today: IsoDate): ManzilRound {
  const pool = units.filter((u) => u.lastAdded < today && !inSabqi(u, today, config.sabqiWindowDays));
  const cycleDays = config.manzilCycleDays;
  const recent = (u: MemUnit) => u.lastRevised !== null && diffDays(u.lastRevised, today) < cycleDays;

  const revised = pool
    .filter(recent)
    .map((u) => ({ page: u.page, date: u.lastRevised! }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.page - b.page);
  const coming = pool
    .filter((u) => !recent(u))
    .sort(
      (a, b) =>
        Number(comesBack(b, today)) - Number(comesBack(a, today)) ||
        a.nextDue.localeCompare(b.nextDue) ||
        strengthOrder(a) - strengthOrder(b) ||
        a.page - b.page,
    )
    .map((u) => u.page);

  return { cycleDays, total: pool.length, revised, coming };
}
