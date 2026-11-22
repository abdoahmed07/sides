/**
 * Missed-day handling. New material is never piled up: a missed day's sabaq is
 * simply not carried over. When study days were missed, the user picks one of:
 *   (a) shift: carry on; the completion date moves out by the missed days.
 *   (b) catchup: today is a catch-up day (all due revision, no new material).
 *   (c) pause: no new material until overdue revision is caught up.
 * A simple rule recommends one; the user always chooses.
 */
import { addDays, diffDays, type IsoDate } from "./dates";
import { dayIntensity } from "./plan/engine";
import type { PlanConfig, PlanPatch } from "./plan/schema";
import { tx } from "@/i18n";

export type MissedInfo = { missedDays: IsoDate[]; since: IsoDate | null };

/**
 * Study days strictly between the last active day (or the plan start) and
 * today on which nothing was completed. Days already acknowledged via
 * `handledThrough` are ignored.
 */
export function detectMissed(
  config: PlanConfig,
  activeDates: Set<IsoDate>,
  today: IsoDate,
  handledThrough: IsoDate | null,
): MissedInfo {
  let lastActive: IsoDate | null = null;
  for (const d of activeDates) if (d < today && (!lastActive || d > lastActive)) lastActive = d;
  let from = lastActive ? addDays(lastActive, 1) : config.startDate;
  if (handledThrough && handledThrough >= from) from = addDays(handledThrough, 1);
  const missedDays: IsoDate[] = [];
  const span = diffDays(from, today);
  for (let i = 0; i < span && i < 400; i++) {
    const d = addDays(from, i);
    if (d >= today) break;
    if (dayIntensity(config, d).active && !activeDates.has(d)) missedDays.push(d);
  }
  return { missedDays, since: lastActive };
}

export type MissedChoice = "shift" | "catchup" | "pause";

export function recommendMissed(missedCount: number): MissedChoice {
  if (missedCount <= 2) return "shift";
  if (missedCount <= 7) return "catchup";
  return "pause";
}

export function missedChoicePatch(choice: MissedChoice, today: IsoDate): PlanPatch | null {
  switch (choice) {
    case "shift":
      return null; // nothing to change; the forecast moves on its own
    case "catchup":
      return { addExceptions: [{ from: today, to: today, kind: "catchup", note: tx("Catch-up after missed days") }] };
    case "pause":
      return { set: { pauseNewUntilCaughtUp: true } };
  }
}

/** Rough number of days revision catch-up takes, for the forecast of option (c). */
export function estimatePauseDays(overdueLines: number, manzilQuotaLines: number): number {
  if (overdueLines <= 0) return 0;
  return Math.ceil(overdueLines / Math.max(15, manzilQuotaLines * 2));
}
