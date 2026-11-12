/** Calendar-day arithmetic on "YYYY-MM-DD" (the phone's days; no time zones). Pure. */
import type { Day } from "../types.js";

const toUtc = (d: Day): number => {
  const [y, m, dd] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, dd);
};

export function addDays(d: Day, n: number): Day {
  return new Date(toUtc(d) + n * 86_400_000).toISOString().slice(0, 10);
}

/** How many days from `a` to `b` (b - a): 0 for the same day, negative when b is earlier. */
export function daysBetween(a: Day, b: Day): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(d: Day): number {
  return new Date(toUtc(d)).getUTCDay();
}

/** The first day of the person's week (0 = weeks start on Sunday, 1 = Monday) that `d` is in. */
export function weekStartOf(d: Day, weekStart: 0 | 1): Day {
  return addDays(d, -((weekday(d) - weekStart + 7) % 7));
}

export const minDay = (a: Day, b: Day): Day => (a < b ? a : b);
export const maxDay = (a: Day, b: Day): Day => (a > b ? a : b);
