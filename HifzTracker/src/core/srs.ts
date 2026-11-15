/**
 * Spaced repetition for memorized pages.
 *
 * Each memorized page is one revision unit. After every revision you rate it:
 *   - Strong: the interval grows by the page's ease (≈ ×2.3 at first) and the
 *             ease rises a little, so strong pages come back less often.
 *   - Okay:   the interval grows gently (×1.3); ease drops slightly.
 *   - Weak:   the interval resets to 1 day and the ease drops, so the page
 *             comes back tomorrow and grows more slowly afterwards.
 *
 * Intervals are capped at the manzil cycle length, which guarantees every
 * memorized page is revised at least once per cycle no matter how strong it is.
 */
import { addDays, diffDays, type IsoDate } from "./dates";

export type Strength = "strong" | "okay" | "weak";

export type MemUnit = {
  /** Mushaf page number; one unit per page. */
  page: number;
  /** Memorized ayah global indices on this page, ascending. */
  ayahs: number[];
  firstMemorized: IsoDate;
  /** Last date new ayahs were added on this page (drives the sabqi window). */
  lastAdded: IsoDate;
  lastRevised: IsoDate | null;
  strength: Strength | null;
  intervalDays: number;
  ease: number;
  nextDue: IsoDate;
  origin: "plan" | "prior";
};

export const EASE_START = 2.3;
export const EASE_MIN = 1.3;
export const EASE_MAX = 3.0;

export function newUnit(page: number, ayahs: number[], date: IsoDate, origin: MemUnit["origin"]): MemUnit {
  return {
    page,
    ayahs: [...ayahs].sort((a, b) => a - b),
    firstMemorized: date,
    lastAdded: date,
    lastRevised: null,
    strength: null,
    intervalDays: 1,
    ease: EASE_START,
    nextDue: addDays(date, 1),
    origin,
  };
}

/**
 * Material that was memorized before using the app: spread the first due
 * dates across one manzil cycle so it does not all fall due on the same day.
 */
export function priorUnit(page: number, ayahs: number[], date: IsoDate, slot: number, cycleDays: number): MemUnit {
  const u = newUnit(page, ayahs, date, "prior");
  const offset = (slot % cycleDays) + 1;
  return { ...u, lastAdded: addDays(date, -365), intervalDays: offset, nextDue: addDays(date, offset) };
}

export function applyRating(unit: MemUnit, rating: Strength, date: IsoDate, cycleDays: number): MemUnit {
  let { intervalDays, ease } = unit;
  switch (rating) {
    case "strong":
      intervalDays = Math.max(2, Math.round(intervalDays * ease));
      ease = Math.min(EASE_MAX, ease + 0.1);
      break;
    case "okay":
      intervalDays = Math.max(1, Math.round(intervalDays * 1.3));
      ease = Math.max(EASE_MIN, ease - 0.05);
      break;
    case "weak":
      intervalDays = 1;
      ease = Math.max(EASE_MIN, ease - 0.2);
      break;
  }
  intervalDays = Math.min(intervalDays, cycleDays);
  return { ...unit, intervalDays, ease: round2(ease), strength: rating, lastRevised: date, nextDue: addDays(date, intervalDays) };
}

/** Adds newly memorized ayahs to a page's unit (or creates it). */
export function addAyahs(unit: MemUnit | undefined, page: number, ayahs: number[], date: IsoDate): MemUnit {
  if (!unit) return newUnit(page, ayahs, date, "plan");
  const set = new Set([...unit.ayahs, ...ayahs]);
  return {
    ...unit,
    ayahs: [...set].sort((a, b) => a - b),
    lastAdded: date,
    // Fresh material on the page: see it again tomorrow.
    intervalDays: 1,
    nextDue: addDays(date, 1),
  };
}

export type UnitStatus = "weak" | "due" | "strong" | "memorized";

export function unitStatus(u: MemUnit, today: IsoDate): UnitStatus {
  if (u.strength === "weak") return "weak";
  if (u.nextDue <= today) return "due";
  if (u.strength === "strong") return "strong";
  return "memorized";
}

export function daysOverdue(u: MemUnit, today: IsoDate): number {
  return Math.max(0, diffDays(u.nextDue, today));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
