/**
 * Streak logic. Pure: no UI, no database, no clock. Everything is derived from
 * the check-in history, the habit's settings and "today", so edits, backfills
 * and settings changes can never leave a stale number.
 */
import { BACKFILL_DAYS, MILESTONE_DAYS } from '../config';
import { addDays, monthKey, weekStart, type ISODate } from './dates';

export type CheckinStatus = 'done' | 'rest' | 'excused' | 'rescued';

export interface Entry {
  date: ISODate;
  status: CheckinStatus;
}

export interface HabitRules {
  schedule_type: 'daily' | 'weekly';
  weekly_target: number | null;
  rest_days_per_month: number;
  start_date: ISODate;
}

export interface HabitStats {
  /** Days for daily habits, weeks for weekly habits. */
  unit: 'days' | 'weeks';
  current: number;
  best: number;
  /** Count of `done` entries. */
  totalDone: number;
  /** Weekly habits only: progress in the current Monday–Sunday week. */
  thisWeek: { count: number; target: number } | null;
  /** Steps left to the milestone (current streak for daily, total done for weekly). */
  toMilestone: number;
}

/** Entries that count toward a weekly target. `rescued` is reserved for the coach feature. */
const WEEKLY_COUNTS: ReadonlySet<CheckinStatus> = new Set(['done', 'excused', 'rescued']);

function weeklyTarget(rules: HabitRules): number {
  return Math.min(7, Math.max(1, rules.weekly_target ?? 1));
}

/** Entries inside [start_date, today], keyed by date. Later duplicates win. */
function indexEntries(rules: HabitRules, entries: Entry[], today: ISODate): Map<ISODate, CheckinStatus> {
  const map = new Map<ISODate, CheckinStatus>();
  for (const e of entries) {
    if (e.date >= rules.start_date && e.date <= today) map.set(e.date, e.status);
  }
  return map;
}

/**
 * Rest entries that fit within the monthly allowance (earliest first). Rest days
 * beyond the allowance, e.g. after the allowance was lowered, count as misses.
 */
function validRestDays(rules: HabitRules, byDate: Map<ISODate, CheckinStatus>): Set<ISODate> {
  const used = new Map<string, number>();
  const valid = new Set<ISODate>();
  const restDates = [...byDate].filter(([, s]) => s === 'rest').map(([d]) => d).sort();
  for (const d of restDates) {
    const m = monthKey(d);
    const n = used.get(m) ?? 0;
    if (n < rules.rest_days_per_month) {
      valid.add(d);
      used.set(m, n + 1);
    }
  }
  return valid;
}

function dailyStreaks(rules: HabitRules, byDate: Map<ISODate, CheckinStatus>, today: ISODate) {
  const rest = validRestDays(rules, byDate);
  let run = 0;
  let best = 0;
  for (let d = rules.start_date; d <= today; d = addDays(d, 1)) {
    const s = byDate.get(d);
    if (s === undefined && d === today) break; // today is a grace day
    if (s === 'done') run += 1;
    else if (s === 'excused' || s === 'rescued' || (s === 'rest' && rest.has(d))) {
      // bridges the chain without adding to it
    } else run = 0;
    if (run > best) best = run;
  }
  return { current: run, best };
}

function weeklyStreaks(rules: HabitRules, byDate: Map<ISODate, CheckinStatus>, today: ISODate) {
  const thisMonday = weekStart(today);
  let run = 0;
  let best = 0;
  let thisWeek = { count: 0, target: weeklyTarget(rules) };
  for (let monday = weekStart(rules.start_date); monday <= thisMonday; monday = addDays(monday, 7)) {
    const { count, target } = weekProgress(rules, byDate, monday);
    const met = count >= target;
    if (monday === thisMonday) {
      thisWeek = { count, target };
      if (met) run += 1; // an in-progress week only ever adds
    } else {
      run = met ? run + 1 : 0;
    }
    if (run > best) best = run;
  }
  return { current: run, best, thisWeek };
}

/**
 * Count and target for the week starting `monday`. In the habit's first week the
 * target is capped at the days actually available, so starting on a Saturday
 * with a target of 4 is not an instant miss.
 */
function weekProgress(rules: HabitRules, byDate: Map<ISODate, CheckinStatus>, monday: ISODate) {
  const sunday = addDays(monday, 6);
  let count = 0;
  let available = 0;
  for (let d = monday; d <= sunday; d = addDays(d, 1)) {
    if (d < rules.start_date) continue;
    available += 1;
    const s = byDate.get(d);
    if (s && WEEKLY_COUNTS.has(s)) count += 1;
  }
  return { count, target: Math.min(weeklyTarget(rules), available) };
}

export function computeStats(rules: HabitRules, entries: Entry[], today: ISODate): HabitStats {
  const byDate = indexEntries(rules, entries, today);
  let totalDone = 0;
  for (const s of byDate.values()) if (s === 'done') totalDone += 1;

  if (rules.start_date > today) {
    return {
      unit: rules.schedule_type === 'weekly' ? 'weeks' : 'days',
      current: 0,
      best: 0,
      totalDone: 0,
      thisWeek: rules.schedule_type === 'weekly' ? { count: 0, target: weeklyTarget(rules) } : null,
      toMilestone: MILESTONE_DAYS,
    };
  }

  if (rules.schedule_type === 'weekly') {
    const w = weeklyStreaks(rules, byDate, today);
    return {
      unit: 'weeks',
      current: w.current,
      best: w.best,
      totalDone,
      thisWeek: w.thisWeek,
      toMilestone: Math.max(0, MILESTONE_DAYS - totalDone),
    };
  }

  const d = dailyStreaks(rules, byDate, today);
  return {
    unit: 'days',
    current: d.current,
    best: d.best,
    totalDone,
    thisWeek: null,
    toMilestone: Math.max(0, MILESTONE_DAYS - d.current),
  };
}

/* ---------- Day display ---------- */

export type DayState = 'done' | 'rest' | 'excused' | 'rescued' | 'missed' | 'open' | 'future' | 'before';

/**
 * How one calendar day looks for a habit: an entry's status, `missed` for a past
 * day with no entry, `open` for today without an entry, `future`, or `before`
 * the habit's start date.
 */
export function dayState(rules: HabitRules, status: CheckinStatus | undefined, day: ISODate, today: ISODate): DayState {
  if (day > today) return 'future';
  if (day < rules.start_date) return 'before';
  if (status) return status;
  return day === today ? 'open' : 'missed';
}

/* ---------- Check-in rules ---------- */

/** Earliest day that can still be checked in or changed. */
export function earliestEditableDay(rules: HabitRules, today: ISODate): ISODate {
  const back = addDays(today, -BACKFILL_DAYS);
  return back > rules.start_date ? back : rules.start_date;
}

/** Days before `start_date`, future days and days past the backfill window are locked. */
export function canEditDay(rules: HabitRules, day: ISODate, today: ISODate): boolean {
  return day <= today && day >= earliestEditableDay(rules, today);
}

/** Rest days still free in the calendar month containing `day`. Always 0 for weekly habits. */
export function restDaysLeft(rules: HabitRules, entries: Entry[], day: ISODate): number {
  if (rules.schedule_type !== 'daily') return 0;
  const m = monthKey(day);
  const used = entries.filter((e) => e.status === 'rest' && monthKey(e.date) === m).length;
  return Math.max(0, rules.rest_days_per_month - used);
}

/** Whether `day` may be marked as a rest day (a day already marked rest stays allowed). */
export function canMarkRest(rules: HabitRules, entries: Entry[], day: ISODate): boolean {
  if (entries.some((e) => e.date === day && e.status === 'rest')) return true;
  return restDaysLeft(rules, entries, day) > 0;
}
