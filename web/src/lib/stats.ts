/**
 * The numbers on the home screen, worked out from the log. Pure functions (tested in
 * test/stats.test.ts).
 */
import { KG, type Day, type Size, type Splurge, type WeighIn } from "../../../shared/types";
import { addDays, daysBetween, weekday } from "./dates";

const RANK: Record<Size, number> = { snack: 1, meal: 2, feast: 3 };

/** The biggest splurge of a day decides its colour. */
export function worstSize(list: Pick<Splurge, "size">[]): Size | null {
  let best: Size | null = null;
  for (const s of list) if (!best || RANK[s.size] > RANK[best]) best = s.size;
  return best;
}

/** Splurges grouped by day. */
export function byDay(list: Splurge[]): Map<Day, Splurge[]> {
  const out = new Map<Day, Splurge[]>();
  for (const s of list) { const a = out.get(s.day); if (a) a.push(s); else out.set(s.day, [s]); }
  return out;
}

/** Days since the last splurge (0 = today), or null when there has never been one. */
export function daysClean(last: Pick<Splurge, "day"> | null, today: Day): number | null {
  return last ? Math.max(0, daysBetween(last.day, today)) : null;
}

/** The first day of the week that holds `d`. */
export function startOfWeek(d: Day, weekStart: 0 | 1): Day {
  return addDays(d, -((weekday(d) - weekStart + 7) % 7));
}

/** How many splurges from `from` to `to` (both included), and how many of them were feasts. */
export function countBetween(list: Splurge[], from: Day, to: Day): { all: number; feasts: number } {
  let all = 0, feasts = 0;
  for (const s of list) if (s.day >= from && s.day <= to) { all++; if (s.size === "feast") feasts++; }
  return { all, feasts };
}

export interface Trend {
  latest: WeighIn | null;
  /** pounds gained (+) or lost (−) over the trend period, or null when there is nothing to compare */
  change: number | null;
  /** the average of the weigh-ins in the last 7 days */
  avg7: number | null;
  /** the weigh-ins inside the trend period, oldest first (the line) */
  points: WeighIn[];
}

/**
 * The weight trend over `days`: the latest weigh-in against the one at the start of the period —
 * the last weigh-in on or before (today − days), or failing that the first one inside the period.
 */
export function trend(weighIns: WeighIn[], today: Day, days: number): Trend {
  const sorted = [...weighIns].filter((w) => w.day <= today).sort((a, b) => a.day.localeCompare(b.day));
  const latest = sorted.at(-1) ?? null;
  const start = addDays(today, -days);
  const points = sorted.filter((w) => w.day >= start);
  const before = sorted.filter((w) => w.day <= start).at(-1);
  const base = before ?? points[0];
  const change = latest && base && base.day !== latest.day ? Math.round((latest.pounds - base.pounds) * 10) / 10 : null;
  const week = sorted.filter((w) => w.day > addDays(today, -7));
  const avg7 = week.length ? Math.round((week.reduce((a, w) => a + w.pounds, 0) / week.length) * 10) / 10 : null;
  return { latest, change, avg7, points: before && points[0]?.day !== before.day ? [before, ...points] : points };
}

/** pounds shown in the person's unit, one decimal */
export function inUnit(pounds: number, unit: "lb" | "kg"): number {
  return Math.round((unit === "kg" ? pounds * KG : pounds) * 10) / 10;
}
export const periodLabel = (days: number) => (days === 7 ? "1 week" : days === 14 ? "2 weeks" : days === 30 ? "1 month" : `${days} days`);
