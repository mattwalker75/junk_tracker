/**
 * Days as the person lives them: "2026-10-15", always in this device's own time zone. Arithmetic
 * goes through UTC so a daylight-saving change never makes a day 23 or 25 hours long.
 */
import type { Day } from "../../../shared/types";

const pad = (n: number) => String(n).padStart(2, "0");

export function today(now = new Date()): Day {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
export function nowTime(now = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
const utc = (d: Day) => { const [y, m, dd] = d.split("-").map(Number); return Date.UTC(y, m - 1, dd); };
export function addDays(d: Day, n: number): Day {
  return new Date(utc(d) + n * 86_400_000).toISOString().slice(0, 10);
}
/** whole days from a to b (b later = positive) */
export function daysBetween(a: Day, b: Day): number {
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}
/** 0 = Sunday … 6 = Saturday */
export function weekday(d: Day): number {
  return new Date(utc(d)).getUTCDay();
}
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_TINY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
export const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const dayNum = (d: Day) => Number(d.slice(8, 10));
export const monthOf = (d: Day) => d.slice(0, 7);
export function monthStart(ym: string): Day { return `${ym}-01`; }
export function monthEnd(ym: string): Day { const [y, m] = ym.split("-").map(Number); return `${ym}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`; }
export function addMonths(ym: string, n: number): string { const [y, m] = ym.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`; }
export function monthLabel(ym: string): string { const [y, m] = ym.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; }

/** "Saturday, Oct 11" (with the year when it is not this year's) */
export function longDay(d: Day, ref: Day): string {
  const [y, m, dd] = d.split("-").map(Number);
  return `${WEEKDAY_LONG[weekday(d)]}, ${MON3[m - 1]} ${dd}${d.slice(0, 4) !== ref.slice(0, 4) ? `, ${y}` : ""}`;
}
/** "Sat Oct 11" */
export function shortDay(d: Day, ref: Day): string {
  const [y, m, dd] = d.split("-").map(Number);
  return `${WEEKDAY_SHORT[weekday(d)]} ${MON3[m - 1]} ${dd}${d.slice(0, 4) !== ref.slice(0, 4) ? ` ${y}` : ""}`;
}
/** "today", "yesterday", "4 days ago", "in 2 days" */
export function ago(d: Day, ref: Day): string {
  const n = daysBetween(d, ref);
  if (n === 0) return "today";
  if (n === 1) return "yesterday";
  if (n === -1) return "tomorrow";
  return n > 0 ? `${n} days ago` : `in ${-n} days`;
}
/** "12:30" → "12:30 PM" in the device's own style */
export function clock(t: string): string {
  if (!/^\d{2}:\d{2}$/.test(t)) return "";
  const [h, m] = t.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
