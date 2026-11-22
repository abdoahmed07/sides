/**
 * Calendar-date helpers on ISO "YYYY-MM-DD" strings. All math is done in UTC
 * so daylight-saving changes never shift a day. Pure; safe on server and client.
 */
import { locale } from "@/i18n";

export type IsoDate = string;

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const WEEKDAY_LABEL: Record<Weekday, string> = {
  sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat",
};

const DAY_MS = 86_400_000;

export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function toMs(d: IsoDate): number {
  return Date.parse(d + "T00:00:00Z");
}

export function fromMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return fromMs(toMs(d) + n * DAY_MS);
}

/** b - a in whole days. */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toMs(b) - toMs(a)) / DAY_MS);
}

export function weekdayOf(d: IsoDate): Weekday {
  return WEEKDAYS[new Date(toMs(d)).getUTCDay()];
}

/** Today's date in the user's local timezone. */
export function localToday(now: Date = new Date()): IsoDate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a < b ? a : b;
}
export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a > b ? a : b;
}

export function formatDate(d: IsoDate, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  return new Date(toMs(d)).toLocaleDateString(locale(), { ...opts, timeZone: "UTC" });
}

/** Short weekday name in the active language ("Mon", "mån", "الاثنين"). */
export function weekdayLabel(d: Weekday): string {
  // 2026-11-01 is a Sunday.
  return new Date(toMs("2026-11-01") + WEEKDAYS.indexOf(d) * DAY_MS).toLocaleDateString(locale(), { weekday: "short", timeZone: "UTC" });
}

/**
 * First day of Ramadan on or after `from`, computed with the Umm al-Qura
 * calendar built into Intl (no hard-coded table). Returns null if the runtime
 * lacks the calendar.
 */
export function nextRamadanStart(from: IsoDate): IsoDate | null {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { month: "numeric", day: "numeric", timeZone: "UTC" });
  } catch {
    return null;
  }
  for (let i = 0; i < 400; i++) {
    const d = addDays(from, i);
    const parts = fmt.formatToParts(new Date(toMs(d)));
    const month = Number(parts.find((p) => p.type === "month")?.value);
    const day = Number(parts.find((p) => p.type === "day")?.value);
    if (month === 9 && day === 1) return d;
    if (i === 0 && month === 9) continue; // already in Ramadan: look for next year's
  }
  return null;
}
