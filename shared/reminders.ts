/**
 * Reminders (Matt, Nov 21 2026): when the app opens, a window says it is time to weigh in, or to log an
 * activity, once none has been logged for the person's number of days (7 and 3 to begin with). It comes
 * back every time the app opens until one is logged, or the reminder is turned off in Settings → You.
 *
 * "Not in the last N days" means: nothing today or on the N − 1 days before it. With 3 days, an
 * activity on Monday is still enough on Wednesday; on Thursday the reminder comes up.
 *
 * Pure, so the server and the tests share it.
 */
import { REMINDER_DAYS_MAX, REMINDER_DAYS_MIN, type Day, type UserSettings } from "./types.js";

export type ReminderKind = "weighIn" | "activity";
export interface Reminder {
  kind: ReminderKind;
  /** the person's number of days */
  days: number;
  /** the latest day one was logged (on or before today), or null when there never was one */
  last: Day | null;
  /** whole days from `last` to today, or null when there never was one */
  since: number | null;
  /** the latest activity's name ("Walk"), for the activity reminder */
  what?: string;
}

const utc = (d: Day) => { const [y, m, dd] = d.split("-").map(Number); return Date.UTC(y, m - 1, dd); };
/** whole days from a to b (b later = positive) */
export const daysFrom = (a: Day, b: Day): number => Math.round((utc(b) - utc(a)) / 86_400_000);

/** A number of days the settings may hold: a whole number from 1 to 60, or the fallback. */
export function reminderDays(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number.NaN;
  return Number.isInteger(n) && n >= REMINDER_DAYS_MIN && n <= REMINDER_DAYS_MAX ? n : fallback;
}

/**
 * Which reminders are due today. A person who has never logged one is reminded too — but counted from
 * the day they were added (`since`), so a new person isn't nagged the first time they open the app.
 */
export function remindersDue(
  s: Pick<UserSettings, "weighReminder" | "weighReminderDays" | "activityReminder" | "activityReminderDays">,
  today: Day,
  last: { weighIn: Day | null; activity: Day | null; activityWhat?: string },
  since: Day,
): Reminder[] {
  const due: Reminder[] = [];
  const check = (kind: ReminderKind, on: boolean, days: number, day: Day | null, what?: string) => {
    if (!on) return;
    const gap = daysFrom(day ?? since, today);
    if (gap < days) return;
    due.push({ kind, days, last: day, since: day ? gap : null, ...(day && what ? { what } : {}) });
  };
  check("weighIn", s.weighReminder, s.weighReminderDays, last.weighIn);
  check("activity", s.activityReminder, s.activityReminderDays, last.activity, last.activityWhat);
  return due;
}
