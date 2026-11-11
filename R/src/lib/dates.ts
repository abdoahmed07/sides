/**
 * Calendar-day helpers. A "day" is always a plain `YYYY-MM-DD` string in the
 * user's own timezone. Arithmetic is done on the date parts only (via UTC
 * internally), so daylight-saving changes can never shift a day.
 */

export type ISODate = string; // 'YYYY-MM-DD'

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar date of a moment, e.g. today on this device. */
export function localISODate(d: Date = new Date()): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toUTC(day: ISODate): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const DAY_MS = 86_400_000;

export function addDays(day: ISODate, n: number): ISODate {
  return fromUTC(toUTC(day) + n * DAY_MS);
}

/** Whole days from `a` to `b` (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayMon0(day: ISODate): number {
  return (new Date(toUTC(day)).getUTCDay() + 6) % 7;
}

/** The Monday that starts the week containing `day` (weeks run Monday to Sunday). */
export function weekStart(day: ISODate): ISODate {
  return addDays(day, -weekdayMon0(day));
}

/** 'YYYY-MM' of a day, used for per-calendar-month allowances. */
export function monthKey(day: ISODate): string {
  return day.slice(0, 7);
}

export function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUTC(toUTC(s)) === s;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const monthAbbr = (month1: number) => MONTHS[month1 - 1];

/** e.g. "3 Nov" */
export function shortDate(day: ISODate): string {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "today", "tomorrow", "yesterday", "3 Nov", or "3 Nov 2027" in another year. */
export function relativeDay(day: ISODate, today: ISODate): string {
  const diff = daysBetween(today, day);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return day.slice(0, 4) === today.slice(0, 4) ? shortDate(day) : `${shortDate(day)} ${day.slice(0, 4)}`;
}

/** e.g. "Wednesday, 11 November" */
export function formatLongDate(day: ISODate): string {
  return new Date(toUTC(day)).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}
