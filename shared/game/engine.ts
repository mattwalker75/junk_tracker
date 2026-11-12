/**
 * Craving Crusher's engine: works out a fight from the log, settles a run (KO → next fight, strike →
 * rematch, knock-back or defeat, weekly hearts, power-ups) and builds what the game screens show.
 * Pure: it never reads a clock or a database. The server (server/src/game.ts) loads a run, calls
 * these and stores what comes back; the page uses the same functions for its live previews.
 *
 * The rules are in Docs/game/ARCHITECTURE.md; the readings chosen where the docs left a rule
 * open are listed there and in MONSTERS.md under "Decisions made while building".
 */
import type { Day, Id, Size } from "../types.js";
import { ABILITIES, type Ability, type Cx } from "./abilities.js";
import { addDays, daysBetween, minDay, weekStartOf } from "./days.js";
import { firstLevelOfWorld, LEVEL_COUNT, LEVELS, levelInfo } from "./levels.js";
import { logPoints, runScore, struckPoints, wonPoints } from "./score.js";
import {
  BET_LABEL, BETS, MAX_HEARTS, MAX_POWER_UPS, START_HEARTS,
  type ActivityEv, type BattleLine, type Bet, type EventData, type EventKind, type EventView, type FightData, type FightResult, type FightView,
  type GameClock, type GameLog, type GameView, type MapLevel, type Mode, type PowerUp, type RunData, type RunState, type SplurgeEv,
} from "./types.js";

export const HEAL: Record<Size, number> = { snack: 10, meal: 25, feast: 60 };
export const CRIT = 25;
export const POTION_DAMAGE = 50;
/** a workout this long earns a Water Potion */
export const POTION_MINUTES = 60;
/** clean days in a row that earn a Veggie Shield */
export const SHIELD_STREAK = 3;
/** active days in a week that earn a heart */
export const WEEK_ACTIVE_DAYS = 5;

/** A rule the person ran into ("The bet is locked"): the server turns it into a plain 409. */
export class GameRuleError extends Error {}

export function abilityFor(level: number): Ability {
  return ABILITIES[levelInfo(level).ability];
}

/** Days a bet takes off the deadline: Steady 0, Bold 1, Daredevil 2. */
export const betDays = (bet: Bet): number => (bet === 2 ? 2 : bet === 1.5 ? 1 : 0);

/**
 * A fight's last day. The start day is day 1 — unless the fight began partway through it (after a
 * KO), when that part-day is a bonus and the days count from the next one.
 */
export function deadlineFor(level: number, startedOn: Day, partDay: boolean, bet: Bet = 1): Day {
  const days = levelInfo(level).days + (abilityFor(level).extraDays ?? 0) - betDays(bet);
  return addDays(startedOn, partDay ? days : days - 1);
}

/** Minutes + calories ÷ 10, rounded; missing ones count as 0. */
export const rawDamage = (a: Pick<ActivityEv, "minutes" | "calories">): number => (a.minutes ?? 0) + Math.round((a.calories ?? 0) / 10);
const half = (n: number) => Math.ceil(n / 2);

// ================================================================ one fight

/** The moment a Veggie Shield went up; "start" = it was already up when this fight began. */
export type ArmPoint = { day: Day; time: string; at: string } | "start";

export interface FightInput {
  level: number;
  startedOn: Day;
  startedAfter: string | null;
  deadlineOn: Day;
  today: Day;
  /** the log from the day before the fight started (the comeback and "yesterday" look there) to today */
  splurges: SplurgeEv[];
  activities: ActivityEv[];
  /** Water Potions used in this fight */
  potions?: { id: Id; day: Day; time: string; at: string }[];
  /** a Veggie Shield that is up: it blocks the first heal after this point */
  shieldFrom?: ArmPoint | null;
  /** heals a shield already blocked in this fight (their source ids) */
  blocked?: string[];
}

/** Does an entry count for a fight: its day is in the window, and on a part-day it was made after the fight began. */
export function counts(e: { day: Day; createdAt: string }, f: { startedOn: Day; startedAfter: string | null; deadlineOn: Day }, today: Day): boolean {
  if (e.day < f.startedOn || e.day > minDay(f.deadlineOn, today)) return false;
  return !(f.startedAfter && e.day === f.startedOn && e.createdAt <= f.startedAfter);
}

/** Within a day: entries with a time first, by time; then the ones with no time, in the order they were made. */
interface Ordered { time: string; stamp: string; id: Id }
function byOrder(x: Ordered, y: Ordered): number {
  if (!x.time !== !y.time) return x.time ? -1 : 1;
  if (x.time !== y.time) return x.time < y.time ? -1 : 1;
  if (x.stamp !== y.stamp) return x.stamp < y.stamp ? -1 : 1;
  return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
}
const entryOrder = (x: SplurgeEv | ActivityEv, y: SplurgeEv | ActivityEv) => byOrder({ time: x.time, stamp: x.createdAt, id: x.id }, { time: y.time, stamp: y.createdAt, id: y.id });
type Item = Ordered & ({ k: "s"; s: SplurgeEv } | { k: "a"; a: ActivityEv } | { k: "p" });

function groupByDay<T extends { day: Day }>(list: T[]): Map<Day, T[]> {
  const m = new Map<Day, T[]>();
  for (const e of list) { const l = m.get(e.day); if (l) l.push(e); else m.set(e.day, [e]); }
  return m;
}

type Where = { phase: "start" | "end" } | { phase: "item"; time: string; stamp: string };
function afterArm(arm: ArmPoint, day: Day, w: Where): boolean {
  if (arm === "start") return true;
  if (day !== arm.day) return day > arm.day;
  if (w.phase !== "item") return w.phase === "end";
  if (w.time && arm.time && w.time !== arm.time) return w.time > arm.time;
  return w.stamp > arm.at;
}

/** Work out a fight from the log: every counted entry in order, the clean-day crits, the abilities. */
export function simulateFight(inp: FightInput): FightResult {
  const level = levelInfo(inp.level);
  const ab = abilityFor(inp.level);
  const max = level.hp;
  const name = level.name;
  let hp = max, damage = 0, heals = 0, landed = 0, attacked = false, revived = false, thresholdDone = false;
  let ko: FightResult["ko"] = null;
  let shield: ArmPoint | null = ab.noPowerUps ? null : inp.shieldFrom ?? null;
  let shieldBlocked: string | null = null;
  let todayDamage = 0, todayHeals = 0;
  const blocked = new Set(inp.blocked ?? []);
  const lines: BattleLine[] = [];
  const counted: ActivityEv[] = [];
  const state: Record<string, number> = {};
  const scheduled = new Map<Day, { amount: number; note: string; sourceId: string }[]>();
  const last = minDay(inp.deadlineOn, inp.today);
  const splByDay = groupByDay(inp.splurges);
  const actByDay = groupByDay(inp.activities);
  const isCounted = (e: { day: Day; createdAt: string }) => counts(e, inp, inp.today);

  for (let d = inp.startedOn; d <= last && !ko; d = addDays(d, 1)) {
    const allSpl = [...(splByDay.get(d) ?? [])].sort(entryOrder);
    const allAct = [...(actByDay.get(d) ?? [])].sort(entryOrder);
    const spl = allSpl.filter(isCounted);
    const act = allAct.filter(isCounted);
    const yesterday = addDays(d, -1);
    const restedY = !(actByDay.get(yesterday)?.length);
    const firstId = allAct[0]?.id;
    const comebackOf = (a: ActivityEv) => !ab.noComeback && a.id === firstId && restedY;
    const baseOf = (a: ActivityEv) => rawDamage(a) * (comebackOf(a) ? 2 : 1);
    let dmgToday = 0, healToday = 0;
    let curPlanned = false, curId = "";
    const cx: Cx = {
      level, hp, max, day: d, deadlineOn: inp.deadlineOn, lastDay: d === inp.deadlineOn, damageToday: 0, healsToday: 0,
      splurgesToday: spl, splurgedYesterday: !!splByDay.get(yesterday)?.length, workoutsToday: act, workedOutToday: act.length > 0,
      index: 0, restedYesterday: false, comeback: false, raw: rawDamage, base: baseOf, state,
      later: (h, note) => {
        const amount = curPlanned && !ab.plannedFull ? half(h) : h;
        const next = addDays(d, 1);
        const l = scheduled.get(next) ?? [];
        l.push({ amount, note, sourceId: `${curId}:later` });
        scheduled.set(next, l);
      },
    };
    const refresh = () => { cx.hp = hp; cx.damageToday = dmgToday; cx.healsToday = healToday; };

    const heal = (amount: number, sourceId: string, where: Where, time: string, text: (gain: number) => string, blockedText: string) => {
      if (amount <= 0) return;
      if (blocked.has(sourceId)) { lines.push({ day: d, time, kind: "blocked", amount, text: blockedText, sourceId }); return; }
      if (shield && afterArm(shield, d, where)) {
        shield = null; shieldBlocked = sourceId;
        lines.push({ day: d, time, kind: "blocked", amount, text: blockedText, sourceId });
        return;
      }
      const gain = Math.min(amount, max - hp);
      hp += gain; heals += gain; healToday += gain; landed += 1;
      lines.push({ day: d, time, kind: "heal", amount: gain, text: gain ? text(gain) + (gain < amount ? " (it was nearly full)" : "") : `${name} is already at full HP, so that heals nothing.`, sourceId });
    };

    const hit = (amount: number, by: "workout" | "potion" | "crit", at: string | null, time: string, text: string, sourceId?: string) => {
      if (amount <= 0) { lines.push({ day: d, time, kind: "note", amount: 0, text, sourceId }); return; }
      if (by !== "crit") attacked = true;
      damage += amount; dmgToday += amount; hp -= amount;
      lines.push({ day: d, time, kind: by === "workout" ? "hit" : by, amount, text, sourceId });
      refresh();
      if (hp <= 0) {
        cx.hp = 0;
        if (ab.canFinish && !ab.canFinish(d, cx)) {
          hp = 1;
          lines.push({ day: d, time, kind: "ability", amount: 0, text: `${ab.name}: ${name} hangs on at 1 HP — it can't go down on a day you splurged.` });
        } else if (ab.revive && !revived && (ab.revive(cx) ?? 0) > 0) {
          revived = true;
          hp = Math.min(max, ab.revive(cx) ?? 0);
          lines.push({ day: d, time, kind: "revive", amount: hp, text: `${ab.name}: ${name} gets back up with ${hp} HP!` });
        } else {
          hp = 0;
          ko = { day: d, at, by };
          lines.push({ day: d, time, kind: "ko", amount: 0, text: `${name} goes down!` });
        }
      } else if (ab.threshold && !thresholdDone) {
        const t = ab.threshold(cx);
        if (t) {
          thresholdDone = true;
          const gain = Math.min(t.heal, max - hp);
          hp += gain;
          lines.push({ day: d, time, kind: "ability", amount: gain, text: t.note });
        }
      }
      refresh();
    };

    // the start of the day: heals left over from yesterday ("then 5 more the next day")
    for (const h of scheduled.get(d) ?? []) { refresh(); heal(h.amount, h.sourceId, { phase: "start" }, "", () => h.note, `The Veggie Shield blocks ${ab.name}'s extra heal.`); }

    const pots = ab.noPowerUps ? [] : (inp.potions ?? []).filter((p) => p.day === d);
    const items: Item[] = [
      ...spl.map((s): Item => ({ k: "s", s, time: s.time, stamp: s.createdAt, id: s.id })),
      ...act.map((a): Item => ({ k: "a", a, time: a.time, stamp: a.createdAt, id: a.id })),
      ...pots.map((p): Item => ({ k: "p", time: p.time, stamp: p.at, id: p.id })),
    ].sort(byOrder);
    for (const it of items) {
      if (ko) break;
      refresh();
      if (it.k === "s") {
        const s = it.s;
        cx.index = spl.indexOf(s); curPlanned = s.planned; curId = s.id;
        const base = HEAL[s.size];
        let h = ab.heal ? ab.heal(base, s, cx) : base;
        const plannedHalf = s.planned && !ab.plannedFull;
        if (plannedHalf) h = half(h);
        h = Math.max(0, Math.round(h));
        const changed = (plannedHalf ? half(base) : base) !== h;
        heal(h, s.id, { phase: "item", time: s.time, stamp: s.createdAt }, s.time,
          (gain) => `${s.what} heals ${name} +${gain}${s.planned ? (ab.plannedFull ? " (a planned treat, in full)" : " (a planned treat: half)") : ""}${changed ? ` (${ab.name})` : ""}.`,
          `The Veggie Shield blocks ${s.what}'s heal.`);
      } else if (it.k === "a") {
        const a = it.a;
        counted.push(a);
        cx.index = act.indexOf(a); cx.comeback = comebackOf(a); cx.restedYesterday = a.id === firstId && restedY;
        const base = baseOf(a);
        const dmg = Math.max(0, Math.round(ab.damage ? ab.damage(base, a, cx) : base));
        const why = dmg !== base ? ` (${ab.name})` : "";
        const text = rawDamage(a) === 0 ? `${a.what}: no minutes or calories, so no damage — still +5 points for logging it.`
          : dmg === 0 ? `${a.what} does no damage${why}.`
          : `${a.what} hits ${name} for ${dmg}${cx.comeback ? " (comeback ×2)" : ""}${why}.`;
        hit(dmg, "workout", a.createdAt, a.time, text, a.id);
      } else {
        hit(POTION_DAMAGE, "potion", it.stamp, it.time, `Water Potion: ${POTION_DAMAGE} damage.`, it.id);
      }
    }

    // the end of a finished day: a clean day's crit, then the monster's own day-end tricks
    if (!ko && d < inp.today) {
      refresh();
      if (!allSpl.length) {
        const c = Math.max(0, Math.round(ab.crit ? ab.crit(CRIT, d, cx) : CRIT));
        hit(c, "crit", null, "", c ? `A clean day: critical hit for ${c}${c !== CRIT ? ` (${ab.name})` : ""}!` : `A clean day, but ${ab.name} stops the crit.`);
      }
      if (!ko && ab.dayEnd) {
        refresh();
        for (const e of ab.dayEnd(d, cx)) {
          if (e.heal) heal(e.heal, `${ab.id}:${d}`, { phase: "end" }, "", () => e.note, `The Veggie Shield blocks ${ab.name}.`);
          if (e.damage && !ko) hit(e.damage, "crit", null, "", e.note);
        }
      }
    }
    if (d === inp.today) { todayDamage = dmgToday; todayHeals = healToday; }
  }
  return { level: inp.level, hp, max, damage, heals, flawless: landed === 0, ko, attacked, lines, shieldBlocked, counted, todayDamage, todayHeals };
}

/** What logging one more splurge or workout would do to the fight (the page's "this hits for 66"). */
export function preview(inp: FightInput, extra: { splurge?: SplurgeEv; activity?: ActivityEv }): { before: FightResult; after: FightResult; change: number } {
  const before = simulateFight(inp);
  const after = simulateFight({
    ...inp,
    splurges: extra.splurge ? [...inp.splurges.filter((s) => s.id !== extra.splurge!.id), extra.splurge] : inp.splurges,
    activities: extra.activity ? [...inp.activities.filter((a) => a.id !== extra.activity!.id), extra.activity] : inp.activities,
  });
  return { before, after, change: after.hp - before.hp };
}

// ================================================================ a run

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const openFightOf = (st: RunState) => st.fights.find((f) => f.status === "open") ?? null;
const isUse = (e: EventData, kind: PowerUp, action?: string) => e.kind === "powerup_used" && e.data.kind === kind && (action === undefined || e.data.action === action);

/** The engine's input for one fight of a run: its window, the log, and its power-ups. */
export function fightInputFor(st: RunState, f: FightData, log: GameLog, today: Day): FightInput {
  const mine = st.events.filter((e) => e.fightId === f.id);
  const potions = mine.filter((e) => isUse(e, "potion")).map((e) => ({ id: e.id, day: e.day, time: String(e.data.time ?? ""), at: e.at }));
  const blocked = mine.filter((e) => isUse(e, "shield", "block")).map((e) => String(e.data.healId));
  let shieldFrom: ArmPoint | null = null;
  if (st.run.shieldArmed) {
    const arm = [...st.events].reverse().find((e) => isUse(e, "shield", "arm"));
    shieldFrom = arm && arm.fightId === f.id ? { day: arm.day, time: String(arm.data.time ?? ""), at: arm.at } : "start";
  }
  return { level: f.level, startedOn: f.startedOn, startedAfter: f.startedAfter, deadlineOn: f.deadlineOn, today, splurges: log.splurges, activities: log.activities, potions, shieldFrom, blocked };
}

/** A new run: number N, 3 hearts, no power-ups, fight 1 (Crumbs) started today at Steady. */
export function newRun(number: number, mode: Mode, clock: GameClock): { state: RunState; added: EventData[] } {
  const run: RunData = {
    id: clock.newId(), number, mode, startedAt: clock.nowIso, startedOn: clock.today, endedOn: null, endReason: null,
    hearts: START_HEARTS, shields: 0, potions: 0, winds: 0, shieldArmed: false, knockbacks: 0, hardcoreDroppedOn: null, logPoints: 0, score: 0,
  };
  const st: RunState = { run, fights: [], events: [] };
  openFight(st, 1, clock.today, null, clock);
  const e: EventData = { id: clock.newId(), fightId: st.fights[0].id, day: clock.today, at: clock.nowIso, kind: "run_start", data: { number, mode } };
  st.events.push(e);
  return { state: st, added: [e] };
}

function openFight(st: RunState, level: number, startedOn: Day, startedAfter: string | null, clock: GameClock): FightData {
  const f: FightData = {
    id: clock.newId(), level, attempt: st.fights.filter((x) => x.level === level).length + 1, startedOn, startedAfter,
    deadlineOn: deadlineFor(level, startedOn, !!startedAfter), bet: 1, status: "open", endedOn: null,
    damage: 0, heals: 0, points: 0, flawless: true, betLocked: false,
  };
  st.fights.push(f);
  return f;
}

/** Starting a new run while one is going ends that one as abandoned. */
export function abandonRun(input: RunState, clock: GameClock): RunState {
  const st = clone(input);
  if (!st.run.endReason) { st.run.endedOn = clock.today; st.run.endReason = "abandoned"; }
  return st;
}

/**
 * Settle a run up to today, in order: a knockout opens the next fight at once; a deadline that has
 * passed is a strike (a heart, then a rematch — or at 0 hearts a knock-back on Normal, defeat on
 * Hardcore); weekly hearts, Veggie Shields and Water Potions are given as they are earned. Running
 * it again with nothing new changes nothing.
 */
export function settle(input: RunState, log: GameLog, clock: GameClock): { state: RunState; added: EventData[] } {
  const st = clone(input);
  const added: EventData[] = [];
  const run = st.run;
  if (run.endReason) return { state: st, added };
  const ev = (kind: EventKind, day: Day, fightId: Id | null, data: Record<string, unknown>, at = clock.nowIso) => {
    const e: EventData = { id: clock.newId(), fightId, day, at, kind, data };
    st.events.push(e); added.push(e);
  };
  const hardcore = () => run.mode === "hardcore";

  for (let guard = 0; guard < 5000; guard++) {
    const f = openFightOf(st);
    if (!f) break;
    const lv = levelInfo(f.level);
    const sim = simulateFight(fightInputFor(st, f, log, clock.today));
    // a Water Potion for every 60-minute workout that counted
    for (const a of sim.counted) {
      if ((a.minutes ?? 0) < POTION_MINUTES || st.events.some((e) => e.kind === "powerup_earned" && e.data.activityId === a.id)) continue;
      const gained = run.potions < MAX_POWER_UPS;
      if (gained) run.potions += 1;
      ev("powerup_earned", a.day, f.id, { kind: "potion", activityId: a.id, what: a.what, minutes: a.minutes, gained });
    }
    if (sim.shieldBlocked) {
      run.shieldArmed = false;
      const line = sim.lines.find((l) => l.kind === "blocked" && l.sourceId === sim.shieldBlocked);
      ev("powerup_used", line?.day ?? clock.today, f.id, { kind: "shield", action: "block", healId: sim.shieldBlocked, amount: line?.amount ?? 0 });
    }
    f.damage = sim.damage; f.heals = sim.heals; f.flawless = sim.flawless;
    if (!f.betLocked && (sim.attacked || clock.today > f.startedOn)) f.betLocked = true;

    if (sim.ko) {
      const k = sim.ko;
      award(st, log, addDays(k.day, -1), ev);
      f.status = "won"; f.endedOn = k.day; f.betLocked = true;
      f.points = wonPoints({ damage: f.damage, max: lv.hp, koDay: k.day, deadlineOn: f.deadlineOn, flawless: f.flawless, boss: lv.boss, bet: f.bet, hardcore: hardcore() });
      ev("ko", k.day, f.id, { level: f.level, name: lv.name, points: f.points, damage: f.damage, flawless: f.flawless, bet: f.bet, daysLeft: Math.max(0, daysBetween(k.day, f.deadlineOn)), boss: lv.boss }, k.at ?? clock.nowIso);
      if (lv.boss) {
        const heart = run.hearts < MAX_HEARTS;
        if (heart) run.hearts += 1;
        ev("heart", k.day, f.id, { reason: "boss", name: lv.name, gained: heart });
        const wind = run.winds < MAX_POWER_UPS;
        if (wind) run.winds += 1;
        ev("powerup_earned", k.day, f.id, { kind: "wind", reason: "boss", name: lv.name, gained: wind });
      }
      if (f.level === LEVEL_COUNT) {
        run.endedOn = k.day; run.endReason = "finished";
        ev("finish", k.day, f.id, {});
        break;
      }
      // the next monster at once: the same day, counting only what is logged after the knockout
      // (a knockout by a clean-day crit lands at midnight, so the next fight starts the next morning)
      openFight(st, f.level + 1, k.at ? k.day : addDays(k.day, 1), k.at, clock);
      continue;
    }

    if (clock.today > f.deadlineOn) {
      award(st, log, f.deadlineOn, ev);
      f.status = "struck"; f.endedOn = f.deadlineOn; f.betLocked = true;
      f.points = struckPoints({ damage: f.damage, hardcore: hardcore() });
      run.hearts -= 1;
      ev("strike", f.deadlineOn, f.id, { level: f.level, name: lv.name, hpLeft: sim.hp, hearts: Math.max(0, run.hearts), points: f.points });
      const next = addDays(f.deadlineOn, 1);
      if (run.hearts <= 0) {
        if (run.mode === "normal") {
          run.knockbacks += 1; run.hearts = START_HEARTS;
          const to = firstLevelOfWorld(f.level);
          ev("knockback", f.deadlineOn, f.id, { from: f.level, to, world: lv.world, worldName: lv.worldName, points: -250 });
          openFight(st, to, next, null, clock);
        } else {
          run.hearts = 0; run.endedOn = f.deadlineOn; run.endReason = "defeated";
          ev("defeat", f.deadlineOn, f.id, { level: f.level, name: lv.name });
          break;
        }
      } else {
        openFight(st, f.level, next, null, clock);
      }
      continue;
    }
    break;
  }
  if (!run.endReason) award(st, log, addDays(clock.today, -1), ev);
  run.logPoints = logPoints(log.entriesSinceStart);
  run.score = scoreOf(st);
  if (run.endReason === "defeated") added[added.length - 1].data.score = run.score;
  return { state: st, added };
}

const scoreOf = (st: RunState) => runScore(st.fights.filter((f) => f.status !== "open").map((f) => f.points), st.run.logPoints, st.run.knockbacks);

/** Weekly hearts and Veggie Shields earned on finished days up to `upTo`. */
function award(st: RunState, log: GameLog, upTo: Day, ev: (kind: EventKind, day: Day, fightId: Id | null, data: Record<string, unknown>) => void): void {
  const run = st.run;
  if (upTo < run.startedOn) return;
  // a week (the person's own week start) with 5+ active days inside the run: +1 heart when it ends
  const active = new Set(log.activities.map((a) => a.day));
  const done = new Set(st.events.filter((e) => e.kind === "heart" && e.data.reason === "week").map((e) => String(e.data.week)));
  for (let ws = weekStartOf(run.startedOn, log.weekStart); addDays(ws, 6) <= upTo; ws = addDays(ws, 7)) {
    if (done.has(ws)) continue;
    let n = 0;
    for (let i = 0; i < 7; i++) { const d = addDays(ws, i); if (d >= run.startedOn && active.has(d)) n += 1; }
    if (n < WEEK_ACTIVE_DAYS) continue;
    const gained = run.hearts < MAX_HEARTS;
    if (gained) run.hearts += 1;
    ev("heart", addDays(ws, 6), null, { reason: "week", week: ws, activeDays: n, gained });
  }
  // clean days in a row: each time they reach 3, a Veggie Shield, and the count starts again
  const splurged = new Set(log.splurges.map((s) => s.day));
  const lastShield = st.events.filter((e) => e.kind === "powerup_earned" && e.data.kind === "shield").map((e) => String(e.data.day)).sort().pop();
  let streak = 0;
  for (let d = lastShield ? addDays(lastShield, 1) : run.startedOn; d <= upTo; d = addDays(d, 1)) {
    if (splurged.has(d)) { streak = 0; continue; }
    if (++streak < SHIELD_STREAK) continue;
    streak = 0;
    const gained = run.shields < MAX_POWER_UPS;
    if (gained) run.shields += 1;
    ev("powerup_earned", d, null, { kind: "shield", day: d, gained });
  }
}

/** Change the bet on Choose your fight — only until the first attack lands or the start day ends. */
export function setBet(input: RunState, log: GameLog, clock: GameClock, bet: Bet): RunState {
  const st = clone(input);
  const f = st.run.endReason ? null : openFightOf(st);
  if (!f) throw new GameRuleError("There is no fight going. Start a run first.");
  if (betLocked(st, f, log, clock.today)) throw new GameRuleError("The bet is locked: it can only change before your first attack lands, on the fight's first day.");
  f.deadlineOn = addDays(f.deadlineOn, betDays(f.bet) - betDays(bet));
  f.bet = bet;
  return st;
}

function betLocked(st: RunState, f: FightData, log: GameLog, today: Day): boolean {
  return f.betLocked || today > f.startedOn || simulateFight(fightInputFor(st, f, log, today)).attacked;
}

/** Use a power-up: a Veggie Shield goes up (it blocks the next heal), a Water Potion hits for 50, a Second Wind adds a day. */
export function usePowerUp(input: RunState, log: GameLog, clock: GameClock, kind: PowerUp): { state: RunState; added: EventData[] } {
  const st = clone(input);
  const run = st.run;
  const f = run.endReason ? null : openFightOf(st);
  if (!f) throw new GameRuleError("There is no fight going. Start a run first.");
  const ab = abilityFor(f.level);
  if (ab.noPowerUps) throw new GameRuleError(`${levelInfo(f.level).name}'s ${ab.name}: no power-ups work in this fight. You keep them for the next one.`);
  const count = kind === "shield" ? run.shields : kind === "potion" ? run.potions : run.winds;
  if (count < 1) throw new GameRuleError(kind === "shield" ? "You have no Veggie Shield. Three clean days in a row earn one." : kind === "potion" ? "You have no Water Potion. A 60-minute workout earns one." : "You have no Second Wind. Beating a boss earns one.");
  const e: EventData = { id: clock.newId(), fightId: f.id, day: clock.today, at: clock.nowIso, kind: "powerup_used", data: { kind, time: clock.nowTime } };
  if (kind === "shield") {
    if (run.shieldArmed) throw new GameRuleError("A Veggie Shield is already up. It blocks the next heal.");
    run.shields -= 1; run.shieldArmed = true; e.data.action = "arm";
  } else if (kind === "potion") {
    run.potions -= 1;
  } else {
    run.winds -= 1;
    f.deadlineOn = addDays(f.deadlineOn, 1);
    e.data.deadlineOn = f.deadlineOn;
  }
  st.events.push(e);
  const after = settle(st, log, clock);
  return { state: after.state, added: [e, ...after.added] };
}

/** Hardcore → Normal, at any time; it can't go back. */
export function dropToNormal(input: RunState, clock: GameClock): { state: RunState; added: EventData[] } {
  const st = clone(input);
  if (st.run.endReason) throw new GameRuleError("That run is over. Start a new one.");
  if (st.run.mode !== "hardcore") throw new GameRuleError("This run is already Normal. A Normal run can't switch to Hardcore.");
  st.run.mode = "normal";
  st.run.hardcoreDroppedOn = clock.today;
  const e: EventData = { id: clock.newId(), fightId: openFightOf(st)?.id ?? null, day: clock.today, at: clock.nowIso, kind: "mode_drop", data: {} };
  st.events.push(e);
  return { state: st, added: [e] };
}

// ================================================================ what the screens show

/** A plain sentence for each thing that happened. */
export function eventText(e: EventData): string {
  const d = e.data;
  const keep = d.gained === false ? (e.kind === "heart" ? " Your hearts were already full." : " You already hold 3.") : "";
  switch (e.kind) {
    case "run_start": return `Run #${d.number} started (${d.mode === "hardcore" ? "Hardcore" : "Normal"}). Crumbs is first.`;
    case "ko": return `${d.name} went down! +${Number(d.points).toLocaleString("en-US")} points.`;
    case "strike": return `${d.name} struck: the deadline passed with ${d.hpLeft} HP left. You lost a heart.`;
    case "knockback": return `Knocked back to level ${d.to}, the start of ${d.worldName}. −250 points, and 3 hearts again.`;
    case "defeat": return `Defeated by ${d.name}. The run is over${d.score !== undefined ? ` with ${Number(d.score).toLocaleString("en-US")} points` : ""}.`;
    case "finish": return "All 60 monsters crushed! The run is complete.";
    case "heart": return (d.reason === "boss" ? `A heart for beating ${d.name}.` : `A heart for ${d.activeDays} active days in a week.`) + keep;
    case "powerup_earned":
      return (d.kind === "shield" ? "A Veggie Shield for 3 clean days in a row." : d.kind === "potion" ? `A Water Potion for ${d.what ?? "a workout"} (${d.minutes} min).` : `A Second Wind for beating ${d.name}.`) + keep;
    case "powerup_used":
      if (d.kind === "shield") return d.action === "block" ? "The Veggie Shield blocked a heal." : "Veggie Shield up: the next heal is blocked.";
      return d.kind === "potion" ? `Water Potion: ${POTION_DAMAGE} damage.` : "Second Wind: one more day on the deadline.";
    case "mode_drop": return "Switched from Hardcore to Normal.";
  }
}

export const toEventView = (e: EventData): EventView => ({ ...e, text: eventText(e) });

/** Everything GET /api/game returns, from a stored run (or none) and the log. */
export function buildView(st: RunState | null, log: GameLog | null, today: Day, needsSync: boolean): GameView {
  if (!st) return { today, run: null, fight: null, map: LEVELS.map((l) => ({ level: l.level, status: "locked", attempts: 0, wins: 0, bestPoints: 0 })), events: [], needsSync: false };
  const run = st.run;
  const active = !run.endReason;
  const lg: GameLog = log ?? { splurges: [], activities: [], entriesSinceStart: 0, weekStart: 0 };
  const settled = st.fights.filter((f) => f.status !== "open").map((f) => f.points);
  const liveScore = active ? runScore(settled, logPoints(lg.entriesSinceStart), run.knockbacks) : run.score;
  const open = active ? openFightOf(st) : null;
  let fight: FightView | null = null;
  if (open) {
    const lv = levelInfo(open.level);
    const ab = abilityFor(open.level);
    const sim = simulateFight(fightInputFor(st, open, lg, today));
    const locked = open.betLocked || today > open.startedOn || sim.attacked;
    const { points: _p, ...rest } = open;
    fight = {
      ...rest, damage: sim.damage, heals: sim.heals, flawless: sim.flawless, betLocked: locked,
      name: lv.name, slug: lv.slug, world: lv.world, worldName: lv.worldName, boss: lv.boss,
      ability: { id: ab.id, name: ab.name, text: ab.text },
      daysLeft: Math.max(0, daysBetween(today, open.deadlineOn) + 1),
      betOptions: locked ? [] : BETS.map((b) => ({ bet: b, label: BET_LABEL[String(b)], deadlineOn: addDays(open.deadlineOn, betDays(open.bet) - betDays(b)) })),
      hp: sim.hp, max: sim.max, todayDamage: sim.todayDamage, todayHeals: sim.todayHeals, lines: sim.lines,
      finish: { hp: sim.hp, minutes: sim.hp, calories: sim.hp * 10 },
      powerUpsAllowed: !ab.noPowerUps,
    };
  }
  const at = run.endReason === "finished" ? LEVEL_COUNT + 1 : (open ?? st.fights[st.fights.length - 1])?.level ?? 1;
  const map: MapLevel[] = LEVELS.map((l) => {
    const fs = st.fights.filter((f) => f.level === l.level);
    const won = fs.filter((f) => f.status === "won");
    return {
      level: l.level,
      status: l.level < at ? "beaten" : l.level === at && open ? "current" : "locked",
      attempts: fs.length, wins: won.length, bestPoints: won.reduce((m, f) => Math.max(m, f.points), 0),
    };
  });
  return {
    today,
    run: { ...run, active, hardcore: run.mode === "hardcore", liveScore, maxHearts: MAX_HEARTS, maxPowerUps: MAX_POWER_UPS },
    fight, map,
    events: st.events.slice(-50).reverse().map(toEventView),
    needsSync,
  };
}
