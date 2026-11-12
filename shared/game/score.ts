/** Craving Crusher's points (Docs/game/ARCHITECTURE.md, "Points"). Pure. */
import type { Day } from "../types.js";
import { daysBetween } from "./days.js";
import type { Bet } from "./types.js";

export const POINTS = {
  /** per full day left on the deadline when the monster goes down */
  speedPerDay: 50,
  flawless: 100,
  boss: 500,
  /** every log entry made during the run: activity, splurge or weigh-in */
  perLogEntry: 5,
  knockback: 250,
  /** Hardcore, while the run is still Hardcore */
  hardcore: 1.25,
} as const;

/** A won fight: (damage + max HP + 50 a day left + 100 flawless + 500 boss) × bet, then × 1.25 on Hardcore. */
export function wonPoints(f: { damage: number; max: number; koDay: Day; deadlineOn: Day; flawless: boolean; boss: boolean; bet: Bet; hardcore: boolean }): number {
  const daysLeft = Math.max(0, daysBetween(f.koDay, f.deadlineOn));
  const p = (f.damage + f.max + POINTS.speedPerDay * daysLeft + (f.flawless ? POINTS.flawless : 0) + (f.boss ? POINTS.boss : 0)) * f.bet;
  return Math.round(f.hardcore ? p * POINTS.hardcore : p);
}

/** A struck fight: its damage only, with no bet (× 1.25 on Hardcore). */
export function struckPoints(f: { damage: number; hardcore: boolean }): number {
  return Math.round(f.hardcore ? f.damage * POINTS.hardcore : f.damage);
}

export function logPoints(entries: number): number {
  return entries * POINTS.perLogEntry;
}

/** Run score = the fights' points + log points − 250 for each knock-back. */
export function runScore(fightPoints: readonly number[], logPts: number, knockbacks: number): number {
  return fightPoints.reduce((a, b) => a + b, 0) + logPts - POINTS.knockback * knockbacks;
}
