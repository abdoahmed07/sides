/**
 * Builds one day's plan from the config and current memorization state:
 *   - Sabaq:  the next new portion (respecting weekday/exception intensity),
 *             lighter after a new portion that was rated weak.
 *   - Sabqi:  pages that received new material in the last N days, and pages
 *             kept there a few days longer after a weak rating.
 *   - Manzil: pages rated weak or okay come back on the day they're due, on top
 *             of a slice of older pages sized so all of them come round once
 *             per cycle, most overdue (and weak) first.
 * Overdue revision takes priority: a large backlog halves or pauses new work.
 */
import { addDays, diffDays, type IsoDate } from "../dates";
import type { QuranIndex } from "../quran";
import { dayIntensity, type DayIntensity } from "../plan/engine";
import type { PlanConfig, RevisionLevel } from "../plan/schema";
import { buildSequence, takePortion } from "../plan/sequence";
import { OKAY_DAYS, type MemUnit } from "../srs";
import { tx } from "@/i18n";

export type DayPlan = {
  date: IsoDate;
  intensity: DayIntensity;
  sabaq: { indices: number[]; lines: number } | null;
  /** Why the sabaq is smaller than usual (or missing), if it is. */
  sabaqNote: string | null;
  sabqi: number[]; // pages
  manzil: number[]; // pages
  overdueLines: number;
  manzilQuotaLines: number;
};

const MANZIL_FACTOR: Record<RevisionLevel, number> = { normal: 1, light: 0.5, none: 0, extra: 2 };

export function memorizedFromUnits(units: MemUnit[], count: number): Uint8Array {
  const m = new Uint8Array(count);
  for (const u of units) for (const i of u.ayahs) m[i] = 1;
  return m;
}

export function unitLines(u: MemUnit, q: QuranIndex): number {
  return q.linesOf(u.ayahs);
}

/** Whether a page is in sabqi on a day: new material in the last N days, or kept there after a weak rating. */
export function inSabqi(u: MemUnit, date: IsoDate, windowDays: number): boolean {
  if (u.lastAdded >= date) return false;
  return u.lastAdded > addDays(date, -windowDays) || (!!u.holdUntil && u.holdUntil >= date);
}

/** A page rated weak or okay in revision: it comes back on the day it said, ahead of everything else. */
export function comesBack(u: MemUnit, date: IsoDate): boolean {
  return u.lastRevised !== null && (u.strength === "weak" || u.strength === "okay") && u.nextDue <= date;
}

export type DayOptions = {
  /** The last new portion was rated weak: make today's lighter, so it can be made solid first. */
  lighterSabaq?: boolean;
};

export function buildDay(config: PlanConfig, q: QuranIndex, units: MemUnit[], date: IsoDate, opts: DayOptions = {}): DayPlan {
  const intensity = dayIntensity(config, date);
  const memorized = memorizedFromUnits(units, q.count);

  const sabqiUnits = units.filter((u) => inSabqi(u, date, config.sabqiWindowDays));
  const sabqiPages = new Set(sabqiUnits.map((u) => u.page));
  const older = units.filter((u) => !sabqiPages.has(u.page) && u.lastAdded < date);

  // Manzil: quota of lines per day so the whole older portion cycles in manzilCycleDays.
  const olderLines = older.reduce((s, u) => s + unitLines(u, q), 0);
  const manzilQuotaLines = Math.ceil((olderLines / config.manzilCycleDays) * MANZIL_FACTOR[intensity.revision]);
  const byPriority = [...older].sort(
    (a, b) =>
      Number(comesBack(b, date)) - Number(comesBack(a, date)) ||
      a.nextDue.localeCompare(b.nextDue) ||
      weakFirst(a) - weakFirst(b) ||
      a.page - b.page,
  );
  const manzil: number[] = [];
  let taken = 0;
  for (const u of byPriority) {
    const l = unitLines(u, q);
    const isDue = u.nextDue <= date;
    // A page rated weak or okay that's due: always, on top of the day's share (it was promised, and the
    // rest of the round keeps its pace).
    if (comesBack(u, date)) {
      manzil.push(u.page);
      continue;
    }
    // Catch-up day: every due page.
    if (intensity.revision === "extra" && isDue) {
      manzil.push(u.page);
      taken += l;
      continue;
    }
    if (manzilQuotaLines <= 0) break;
    if (taken >= manzilQuotaLines) break;
    // Not due yet and revised in the last few days: don't bring it forward (it comes back when its rating says).
    if (!isDue && u.lastRevised && diffDays(u.lastRevised, date) < OKAY_DAYS) continue;
    manzil.push(u.page);
    taken += l;
  }
  // Backlog = overdue pages that did not fit today.
  const inManzil = new Set(manzil);
  const overdueLines = older
    .filter((u) => u.nextDue < date && !inManzil.has(u.page))
    .reduce((s, u) => s + unitLines(u, q), 0);

  // New material, reduced when revision is behind.
  let quota = Math.round(config.dailyNewLines * intensity.newMultiplier);
  let sabaqNote: string | null = null;
  if (intensity.exception && intensity.newMultiplier < 1) {
    sabaqNote = intensity.newMultiplier === 0 ? tx("No new material today (plan exception).") : tx("Lighter new portion today (plan exception).");
  }
  const backlogUnit = Math.max(15, manzilQuotaLines);
  if (quota > 0 && config.pauseNewUntilCaughtUp && overdueLines > 0) {
    quota = 0;
    sabaqNote = tx("New memorization is paused until overdue revision is caught up.");
  } else if (quota > 0 && overdueLines > 4 * backlogUnit) {
    quota = 0;
    sabaqNote = tx("Revision is far behind, so today is revision only.");
  } else if (quota > 0 && overdueLines > 2 * backlogUnit) {
    quota = Math.max(1, Math.floor(quota / 2));
    sabaqNote = tx("Revision is behind, so today's new portion is halved.");
  }
  // After a weak new portion, a lighter one (unless today's is already smaller for another reason).
  if (opts.lighterSabaq && quota > 1 && !sabaqNote) {
    quota = Math.max(1, Math.floor(quota / 2));
    sabaqNote = tx("Your last new portion felt weak, so today's is lighter. Make it solid in sabqi first.");
  }

  let sabaq: DayPlan["sabaq"] = null;
  if (quota > 0) {
    const p = takePortion(buildSequence(config, q), memorized, quota, q);
    if (p.indices.length) sabaq = { indices: p.indices, lines: p.lines };
  }

  const sabqi = [...sabqiPages].sort((a, b) => a - b);
  if (intensity.revision === "none") {
    return { date, intensity, sabaq, sabaqNote, sabqi: [], manzil: [], overdueLines, manzilQuotaLines: 0 };
  }
  return { date, intensity, sabaq, sabaqNote, sabqi, manzil, overdueLines, manzilQuotaLines };
}

function weakFirst(u: MemUnit) {
  return u.strength === "weak" ? 0 : u.strength === "okay" ? 1 : u.strength === null ? 2 : 3;
}

/** Recent additions (for the forecast's sabqi estimate). */
export function recentAdds(units: MemUnit[], q: QuranIndex, today: IsoDate, windowDays: number) {
  const byDate = new Map<IsoDate, number>();
  for (const u of units) {
    if (diffDays(u.lastAdded, today) < windowDays && u.origin === "plan") {
      byDate.set(u.lastAdded, (byDate.get(u.lastAdded) ?? 0) + unitLines(u, q));
    }
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, lines]) => ({ date, lines }));
}
