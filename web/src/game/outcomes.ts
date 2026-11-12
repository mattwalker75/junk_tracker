/**
 * What a sync (or any game change) just settled, turned into the screens that tell about it: the
 * big results (Victory, Strike, Knocked back, Defeated, the finish) shown one after another, and
 * the small news (a heart, a power-up earned) shown as toasts. Plus the Victory screen's score
 * breakdown, worked back from the KO's own numbers. Pure (tested in test/game3.test.ts).
 */
import { levelInfo, POINTS, type EventView } from "../../../shared/game";

export type Result =
  | { kind: "victory"; id: string; ko: EventView; rewards: EventView[] }
  | { kind: "finish"; id: string; ko: EventView; rewards: EventView[] }
  | { kind: "strike"; id: string; strike: EventView }
  | { kind: "knockback"; id: string; strike: EventView; knockback: EventView }
  | { kind: "defeat"; id: string; strike: EventView; defeat: EventView };

/** The kinds told as a toast (a shield going up shows on the shield itself; a potion on the HP bar). */
const TOAST = new Set(["heart", "powerup_earned", "mode_drop"]);

/**
 * In the order they happened: a KO is a Victory (a boss's heart and Second Wind go on its screen, not
 * in toasts), and the KO of level 60 is the finish; a strike is a Strike, unless it took the last
 * heart: then it is a Knocked back (Normal) or Defeated (Hardcore) screen instead.
 */
export function planResults(events: readonly EventView[]): { results: Result[]; toasts: EventView[] } {
  const results: Result[] = [];
  const toasts: EventView[] = [];
  const used = new Set<string>();
  events.forEach((e, i) => {
    if (used.has(e.id)) return;
    const later = events.slice(i + 1).filter((x) => !used.has(x.id));
    if (e.kind === "ko") {
      const rewards = later.filter((x) => x.fightId === e.fightId && (x.kind === "heart" || x.kind === "powerup_earned") && x.data.reason === "boss");
      const finish = later.find((x) => x.kind === "finish" && x.fightId === e.fightId);
      for (const x of [...rewards, ...(finish ? [finish] : [])]) used.add(x.id);
      results.push({ kind: finish ? "finish" : "victory", id: e.id, ko: e, rewards });
    } else if (e.kind === "strike") {
      const end = later.find((x) => (x.kind === "knockback" || x.kind === "defeat") && x.fightId === e.fightId);
      if (end) used.add(end.id);
      if (end?.kind === "knockback") results.push({ kind: "knockback", id: e.id, strike: e, knockback: end });
      else if (end?.kind === "defeat") results.push({ kind: "defeat", id: e.id, strike: e, defeat: end });
      else results.push({ kind: "strike", id: e.id, strike: e });
    } else if (e.kind === "finish") {
      // a finish without its KO in the same batch still gets its screen
      results.push({ kind: "finish", id: e.id, ko: e, rewards: [] });
    } else if (TOAST.has(e.kind)) {
      toasts.push(e);
    }
    used.add(e.id);
  });
  return { results, toasts };
}

export interface ScoreRow { label: string; sub: string; value: string }
export interface Breakdown { rows: ScoreRow[]; total: number }

const fmt = (n: number) => n.toLocaleString("en-US");
const mult = (n: number) => `×${String(n)}`;

/**
 * The Victory screen's "Score breakdown": damage, kill, speed, flawless, boss, then the bet and
 * Hardcore multipliers. The total is the KO's points as the server worked them out; Hardcore shows
 * when the multipliers alone don't reach it.
 */
export function victoryBreakdown(ko: EventView): Breakdown {
  const d = ko.data;
  const level = Number(d.level);
  const lv = levelInfo(level);
  const damage = Number(d.damage ?? 0), daysLeft = Number(d.daysLeft ?? 0), bet = Number(d.bet ?? 1), points = Number(d.points ?? 0);
  const flawless = d.flawless === true, boss = d.boss === true;
  const rows: ScoreRow[] = [
    { label: "Damage dealt", sub: "1 point per damage, the whole fight", value: fmt(damage) },
    { label: "Kill", sub: `${lv.name}'s max HP`, value: `+${fmt(lv.hp)}` },
  ];
  if (daysLeft > 0) rows.push({ label: "Speed bonus", sub: `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left on the deadline × ${POINTS.speedPerDay}`, value: `+${fmt(daysLeft * POINTS.speedPerDay)}` });
  if (flawless) rows.push({ label: "Flawless", sub: "No heal landed in the whole fight", value: `+${POINTS.flawless}` });
  if (boss) rows.push({ label: "Boss kill", sub: `${lv.name} ruled ${lv.worldName}`, value: `+${POINTS.boss}` });
  const base = damage + lv.hp + daysLeft * POINTS.speedPerDay + (flawless ? POINTS.flawless : 0) + (boss ? POINTS.boss : 0);
  if (bet !== 1) rows.push({ label: "Deadline bet", sub: bet === 2 ? "Daredevil: two days less" : "Bold: one day less", value: mult(bet) });
  if (points !== Math.round(base * bet) && points === Math.round(base * bet * POINTS.hardcore)) rows.push({ label: "Hardcore", sub: "No checkpoints, more glory", value: mult(POINTS.hardcore) });
  return { rows, total: points };
}

/** The count-up on the Victory screen: the value shown `t` ms into a `ms` long count (eased). */
export function countUp(total: number, t: number, ms = 1200): number {
  if (t >= ms) return total;
  if (t <= 0) return 0;
  const p = t / ms;
  return Math.round(total * (1 - (1 - p) ** 3));
}
