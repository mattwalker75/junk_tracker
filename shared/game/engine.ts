/**
 * Calorie Crusher's engine: works out a fight from the log, settles a run (KO → the next fight waits to be
 * started, `startNextFight`; strike → a heart and one more day, or at the last heart an extra life, a knock-back
 * or defeat; weekly hearts, power-ups)
 * and builds what the game screens show.
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
  BET_LABEL, BETS, LIFE_EVERY, MAX_HEARTS, MAX_LIVES, MAX_POWER_UPS, START_HEARTS,
  type ActivityEv, type ArmPoint, type BattleLine, type Bet, type EventData, type EventKind, type EventView, type FightData, type FightInput, type FightResult, type FightView,
  type GameClock, type GameLog, type GameView, type MapLevel, type Mode, type NextFightView, type PowerUp, type RunData, type RunState, type SplurgeEv,
} from "./types.js";

export const HEAL: Record<Size, number> = { snack: 10, meal: 25, feast: 60 };
export const CRIT = 25;
/** a heal past full HP goes on as bonus HP, up to this share of max HP (Matt, Nov 14 2026) */
export const BONUS_SHARE = 0.2;
/** The most bonus HP a monster can hold: a fifth of its max HP, or its ability's own share (pass its level). */
export const bonusMaxOf = (max: number, level?: number): number => Math.round(max * (level ? abilityFor(level).bonusShare ?? BONUS_SHARE : BONUS_SHARE));
/** The sentence a heal's battle line ends with when some of it went on as bonus HP (the page strips it to find the ability's name). */
export const bonusNote = (extra: number, gain: number, full: boolean): string =>
  `${gain ? `It fills up, and the extra ${extra} is bonus HP` : `It was at full HP, so that's +${extra} bonus HP`}${full ? " (the bonus bar is full)" : ""}.`;
export const POTION_DAMAGE = 50;
/** a workout this long earns a Water Potion */
export const POTION_MINUTES = 60;
/** clean days in a row that earn a Veggie Shield */
export const SHIELD_STREAK = 3;
/** active days in a week that earn a heart */
export const WEEK_ACTIVE_DAYS = 5;

/** A rule the person ran into ("The bet is locked"): the server turns it into a plain 409. */
export class GameRuleError extends Error {}

/** A monster's full HP: its level's, times the toughness its fight started with (Standard 1, Tough 1.5, Brutal 2). */
export const monsterHp = (level: number, hpMult = 1): number => Math.round(levelInfo(level).hp * hpMult);

export function abilityFor(level: number): Ability {
  return ABILITIES[levelInfo(level).ability];
}

/** Days a bet takes off the deadline: Steady 0, Bold 1, Daredevil 2. */
export const betDays = (bet: Bet): number => (bet === 2 ? 2 : bet === 1.5 ? 1 : 0);

/**
 * A fight's last day. The start day is day 1 — unless the fight began partway through it (after a
 * KO), when that part-day is a bonus and the days count from the next one.
 */
/** a level's deadline in days before any bet, its ability's extra days included (Long Haul) — what every screen says */
export const fightDays = (level: number): number => levelInfo(level).days + (abilityFor(level).extraDays ?? 0);

export function deadlineFor(level: number, startedOn: Day, partDay: boolean, bet: Bet = 1): Day {
  const days = fightDays(level) - betDays(bet);
  return addDays(startedOn, partDay ? days : days - 1);
}

/** Minutes + calories ÷ 10, rounded; missing ones count as 0. */
export const rawDamage = (a: Pick<ActivityEv, "minutes" | "calories">): number => (a.minutes ?? 0) + Math.round((a.calories ?? 0) / 10);
const half = (n: number) => Math.ceil(n / 2);

// ================================================================ one fight

/**
 * Does an entry count for a fight: its day is in the window. On a part-day (the fight began after a
 * KO that day) it counts unless the fight before used it: `usedBefore` holds the ids of that day's
 * entries the knocked-out fight read, in the fight's own order up to the knockout. So every entry of
 * the KO day counts for exactly one of the two fights, whatever order they were made in. Fights
 * stored before that list existed fall back to "made after the knockout".
 */
export function counts(e: { id?: Id; day: Day; createdAt: string }, f: { startedOn: Day; startedAfter: string | null; deadlineOn: Day; usedBefore?: Id[] | null }, today: Day): boolean {
  if (e.day < f.startedOn || e.day > minDay(f.deadlineOn, today)) return false;
  if (!f.startedAfter || e.day !== f.startedOn) return true;
  if (f.usedBefore) return e.id === undefined || !f.usedBefore.includes(e.id);
  return e.createdAt > f.startedAfter;
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
  const max = monsterHp(inp.level, inp.hpMult);
  const name = level.name;
  const bonusMax = bonusMaxOf(max, inp.level);
  let hp = max, bonus = 0, damage = 0, heals = 0, landed = 0, attacked = false, revives = 0, thresholdDone = false;
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
  const isCounted = (e: { id: Id; day: Day; createdAt: string }) => counts(e, inp, inp.today);

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
    const usedToday: Id[] = [];
    const cx: Cx = {
      level, hp, max, bonus, day: d, deadlineOn: inp.deadlineOn, lastDay: d === inp.deadlineOn, damageToday: 0, healsToday: 0,
      // the start day is day 1 — or day 0, a bonus, when the fight began partway through it (after a KO)
      fightDay: daysBetween(inp.startedOn, d) + (inp.startedAfter ? 0 : 1),
      splurgesToday: spl, splurgedYesterday: !!splByDay.get(yesterday)?.length, workoutsToday: act, workedOutToday: act.length > 0,
      index: 0, restedYesterday: false, comeback: false, raw: rawDamage, base: baseOf, state,
      later: (h, note, inDays = 1) => {
        const amount = curPlanned && !ab.plannedFull ? half(h) : h;
        const next = addDays(d, inDays);
        const l = scheduled.get(next) ?? [];
        // one id per day it lands on, so a Veggie Shield blocks just that one (tomorrow's keeps the old ":later")
        l.push({ amount, note, sourceId: `${curId}:later${inDays === 1 ? "" : inDays}` });
        scheduled.set(next, l);
      },
    };
    const refresh = () => { cx.hp = hp; cx.bonus = bonus; cx.damageToday = dmgToday; cx.healsToday = healToday; };

    const heal = (amount: number, sourceId: string, where: Where, time: string, text: (gain: number) => string, blockedText: string) => {
      if (amount <= 0) return;
      const at = where.phase === "item" ? { at: where.stamp } : {};
      if (blocked.has(sourceId)) { lines.push({ day: d, time, ...at, kind: "blocked", amount, text: blockedText, sourceId }); return; }
      if (shield && afterArm(shield, d, where)) {
        shield = null; shieldBlocked = sourceId;
        lines.push({ day: d, time, ...at, kind: "blocked", amount, text: blockedText, sourceId });
        return;
      }
      // a heal fills the HP bar first; past full it goes on as bonus HP, up to 20% of max HP
      const gain = Math.min(amount, max - hp);
      const extra = Math.min(amount - gain, bonusMax - bonus);
      const total = gain + extra;
      hp += gain; bonus += extra; heals += total; healToday += total; landed += 1;
      lines.push({
        day: d, time, ...at, kind: "heal", amount: total, ...(extra ? { bonus: extra } : {}), sourceId,
        text: !total ? `${name} is at full HP with a full bonus bar, so that heals nothing.`
          : extra ? `${text(total)} ${bonusNote(extra, gain, bonus >= bonusMax)}`
          : text(total),
      });
    };

    const hit = (amount: number, by: "workout" | "potion" | "crit", at: string | null, time: string, text: string, sourceId?: string) => {
      // the line's time: the entry's own, and when it was logged (a clean-day crit has neither)
      const when = at ? { time, at } : { time };
      if (amount <= 0) { lines.push({ day: d, ...when, kind: "note", amount: 0, text, sourceId }); return; }
      if (by !== "crit") attacked = true;
      damage += amount; dmgToday += amount;
      // bonus HP goes first
      const off = Math.min(bonus, amount);
      bonus -= off; hp -= amount - off;
      lines.push({ day: d, ...when, kind: by === "workout" ? "hit" : by, amount, text, sourceId });
      refresh();
      if (hp <= 0) {
        cx.hp = 0;
        const back = ab.revive ? ab.revive(cx, revives) ?? 0 : 0;
        if (ab.canFinish && !ab.canFinish(d, cx)) {
          hp = 1;
          lines.push({ day: d, ...when, kind: "ability", amount: 0, text: `${ab.name}: ${name} hangs on at 1 HP — ${ab.holdText ?? "it can't go down yet"}.` });
        } else if (back > 0) {
          revives += 1;
          hp = Math.min(max, back);
          lines.push({ day: d, ...when, kind: "revive", amount: hp, text: `${ab.name}: ${name} gets back up with ${hp} HP!` });
        } else {
          hp = 0;
          ko = { day: d, at, by };
          lines.push({ day: d, ...when, kind: "ko", amount: 0, text: `${name} goes down!` });
        }
      } else if (ab.threshold && !thresholdDone) {
        const t = ab.threshold(cx);
        if (t) {
          thresholdDone = true;
          const gain = Math.min(t.heal, max - hp);
          hp += gain;
          lines.push({ day: d, ...when, kind: "ability", amount: gain, text: t.note });
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
      if (it.k !== "p") usedToday.push(it.id);
      if (it.k === "s") {
        const s = it.s;
        cx.index = spl.indexOf(s); curPlanned = s.planned; curId = s.id;
        const base = HEAL[s.size];
        let h = ab.heal ? ab.heal(base, s, cx) : base;
        const plannedHalf = s.planned && !ab.plannedFull;
        if (plannedHalf) h = half(h);
        h = Math.max(0, Math.round(h));
        const changed = (plannedHalf ? half(base) : base) !== h;
        // an ability that holds the heal back for later (Freeze-Dried): say so where the splurge is
        if (h <= 0 && base > 0 && !blocked.has(s.id)) lines.push({ day: d, time: s.time, at: s.createdAt, kind: "note", amount: 0, text: `${s.what} heals ${name} nothing now (${ab.name}).`, sourceId: s.id });
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
    // a knockout during the day: the next fight gets the rest of the day, without what this one used
    if (ko) (ko as NonNullable<FightResult["ko"]>).used = usedToday;

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
  return { level: inp.level, hp, max, bonus, bonusMax, damage, heals, flawless: landed === 0, ko, attacked, lines, shieldBlocked, counted, todayDamage, todayHeals };
}

/** What logging one more splurge or workout would do to the fight (the page's "this hits for 66"). */
export function preview(inp: FightInput, extra: { splurge?: SplurgeEv; activity?: ActivityEv }): { before: FightResult; after: FightResult; change: number } {
  const before = simulateFight(inp);
  const after = simulateFight({
    ...inp,
    splurges: extra.splurge ? [...inp.splurges.filter((s) => s.id !== extra.splurge!.id), extra.splurge] : inp.splurges,
    activities: extra.activity ? [...inp.activities.filter((a) => a.id !== extra.activity!.id), extra.activity] : inp.activities,
  });
  return { before, after, change: after.hp + after.bonus - (before.hp + before.bonus) };
}

// ================================================================ a run

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const openFightOf = (st: RunState) => st.fights.find((f) => f.status === "open") ?? null;
const isUse = (e: EventData, kind: PowerUp, action?: string) => e.kind === "powerup_used" && e.data.kind === kind && (action === undefined || e.data.action === action);

/** A Veggie Shield going up: put up from the battle screen ("arm"), or up again because the heal it blocked no longer counts ("back"). */
const isRaise = (e: EventData) => isUse(e, "shield", "arm") || isUse(e, "shield", "back");

/** On a part-day, the start day's entries the fights before this one used (the KO event of the one just before keeps the whole day's list). */
function usedBeforeOf(st: RunState, f: FightData): Id[] | null {
  if (!f.startedAfter) return null;
  const i = st.fights.findIndex((x) => x.id === f.id);
  const prev = i > 0 ? st.fights[i - 1] : null;
  const ko = prev && st.events.find((e) => e.kind === "ko" && e.fightId === prev.id);
  return ko && Array.isArray(ko.data.used) ? (ko.data.used as unknown[]).map(String) : null;
}

/**
 * The Veggie Shield in one fight: the heals it blocked that still count, where it went up (when it
 * is up), and `voided` — the block whose heal was deleted or moved out of the fight since, which
 * puts the shield back up (it was never really used).
 */
function shieldIn(st: RunState, f: FightData, log: GameLog, today: Day, usedBefore: Id[] | null): { blocked: string[]; shieldFrom: ArmPoint | null; voided: { block: EventData; from: ArmPoint } | null } {
  const blocks = st.events.filter((e) => e.fightId === f.id && isUse(e, "shield", "block"));
  // a block still counts while the heal it blocked would still happen: the fight is worked out again with every
  // block in place, and each one must still meet its heal. Looking up the blocked splurge missed the monster's own
  // heals (a midnight +5, a "then 5 more" the next day) that a later change made go away (review, Nov 22 2026).
  const happens = new Set<string>();
  if (blocks.length) {
    const sim = simulateFight({
      level: f.level, startedOn: f.startedOn, startedAfter: f.startedAfter, usedBefore, deadlineOn: f.deadlineOn, today, hpMult: f.hpMult ?? 1,
      splurges: log.splurges, activities: log.activities, potions: potionsOf(st, f), shieldFrom: null, blocked: blocks.map((b) => String(b.data.healId)),
    });
    for (const l of sim.lines) if (l.kind === "blocked" && l.sourceId) happens.add(l.sourceId);
  }
  const stillCounts = (healId: string) => happens.has(healId);
  const pointOf = (raise: EventData | undefined): ArmPoint => {
    if (!raise) return "start";
    if (isUse(raise, "shield", "back")) return (raise.data.from as ArmPoint | undefined) ?? "start";
    return raise.fightId === f.id ? { day: raise.day, time: String(raise.data.time ?? ""), at: raise.at } : "start";
  };
  const live = blocks.filter((b) => stillCounts(String(b.data.healId)));
  let lastRaise: EventData | undefined, lastRaiseAt = -1;
  st.events.forEach((e, i) => { if (isRaise(e)) { lastRaise = e; lastRaiseAt = i; } });
  const lastBlock = blocks[blocks.length - 1];
  const voided = lastBlock && !live.includes(lastBlock) && st.events.indexOf(lastBlock) > lastRaiseAt ? { block: lastBlock, from: pointOf(lastRaise) } : null;
  let shieldFrom: ArmPoint | null = null;
  if (st.run.shieldArmed) shieldFrom = pointOf(lastRaise);
  else if (voided) shieldFrom = voided.from;
  return { blocked: live.map((b) => String(b.data.healId)), shieldFrom, voided };
}

/** The engine's input for one fight of a run: its window, the log, and its power-ups. */
const potionsOf = (st: RunState, f: FightData) => st.events.filter((e) => e.fightId === f.id && isUse(e, "potion")).map((e) => ({ id: e.id, day: e.day, time: String(e.data.time ?? ""), at: e.at }));

export function fightInputFor(st: RunState, f: FightData, log: GameLog, today: Day): FightInput {
  const potions = potionsOf(st, f);
  const usedBefore = usedBeforeOf(st, f);
  const { blocked, shieldFrom } = shieldIn(st, f, log, today, usedBefore);
  return { level: f.level, startedOn: f.startedOn, startedAfter: f.startedAfter, usedBefore, deadlineOn: f.deadlineOn, today, hpMult: f.hpMult ?? 1, splurges: log.splurges, activities: log.activities, potions, shieldFrom, blocked };
}

/** A new run: number N, 3 hearts, no power-ups, fight 1 (Crumbs) started today at Steady. `auto`: started by Keep the monsters coming. `hpMult`: the person's Monster toughness. */
export function newRun(number: number, mode: Mode, clock: GameClock, auto = false, hpMult = 1): { state: RunState; added: EventData[] } {
  const run: RunData = {
    id: clock.newId(), number, mode, startedAt: clock.nowIso, startedOn: clock.today, endedOn: null, endReason: null,
    hearts: START_HEARTS, lives: 0, shields: 0, potions: 0, winds: 0, shieldArmed: false, knockbacks: 0, hardcoreDroppedOn: null, logPoints: 0, score: 0,
  };
  const st: RunState = { run, fights: [], events: [] };
  openFight(st, 1, clock.today, null, clock, hpMult);
  const e: EventData = { id: clock.newId(), fightId: st.fights[0].id, day: clock.today, at: clock.nowIso, kind: "run_start", data: { number, mode, ...(auto ? { auto: true } : {}) } };
  st.events.push(e);
  return { state: st, added: [e] };
}

function openFight(st: RunState, level: number, startedOn: Day, startedAfter: string | null, clock: GameClock, hpMult = 1): FightData {
  const f: FightData = {
    id: clock.newId(), level, attempt: st.fights.filter((x) => x.level === level).length + 1, startedOn, startedAfter,
    deadlineOn: deadlineFor(level, startedOn, !!startedAfter), bet: 1, status: "open", endedOn: null,
    damage: 0, heals: 0, points: 0, flawless: true, betLocked: false, hpMult,
  };
  st.fights.push(f);
  return f;
}

/**
 * Between fights: the level that is up next, or null (a fight is open, or the run is over). After a
 * KO it is the next level; after a knock-back the world's first; after an extra life was spent the
 * same level again (a strike that left hearts keeps its fight open, so nothing is pending).
 */
export function pendingLevel(st: RunState): number | null {
  if (st.run.endReason || openFightOf(st)) return null;
  const last = st.fights[st.fights.length - 1];
  if (!last) return 1;
  if (last.status === "won") return Math.min(LEVEL_COUNT, last.level + 1);
  const kb = st.events.find((e) => e.kind === "knockback" && e.fightId === last.id);
  return kb ? Number(kb.data.to) : last.level;
}

/** The knockout of the last fight when it happened today partway through the day (it used some of today's entries). */
function koToday(st: RunState, today: Day): EventData | null {
  const last = st.fights[st.fights.length - 1];
  if (!last || last.status !== "won" || last.endedOn !== today) return null;
  const ko = st.events.find((e) => e.kind === "ko" && e.fightId === last.id);
  return ko && Array.isArray(ko.data.used) ? ko : null;
}

/** The last fight ended (won or struck) before this day — Keep the monsters coming starts the next one only then. */
export function lastEndedBefore(st: RunState, today: Day): boolean {
  const last = st.fights[st.fights.length - 1];
  return !last || (last.status !== "open" && !!last.endedOn && last.endedOn < today);
}

/**
 * Start the fight that is up next, today. After a knockout today it gets the rest of the day (the
 * entries the beaten monster didn't use; its deadline counts from tomorrow), otherwise the whole of
 * today — as fight 1 of a new run does. Then it is settled at once: today's entries may already
 * knock it out. `auto`: started by Keep the monsters coming.
 */
export function startNextFight(input: RunState, log: GameLog, clock: GameClock, bet: Bet = 1, auto = false): { state: RunState; added: EventData[] } {
  const st = clone(input);
  if (st.run.endReason) throw new GameRuleError("That run is over. Start a new one.");
  const level = pendingLevel(st);
  if (level === null) throw new GameRuleError("A fight is already going. Beat it first.");
  const ko = koToday(st, clock.today);
  const f = openFight(st, level, clock.today, ko ? ko.at : null, clock, log.hpMult ?? 1);
  f.deadlineOn = addDays(f.deadlineOn, -betDays(bet));
  f.bet = bet;
  const e: EventData = { id: clock.newId(), fightId: f.id, day: clock.today, at: clock.nowIso, kind: "fight_start", data: { level, name: levelInfo(level).name, attempt: f.attempt, ...(auto ? { auto: true } : {}) } };
  st.events.push(e);
  const out = settle(st, log, clock);
  return { state: out.state, added: [e, ...out.added] };
}

/** The monster that is up next, for the between-fights screens. */
function nextView(st: RunState, today: Day, hpMult: number): NextFightView | null {
  const level = pendingLevel(st);
  if (level === null || !st.fights.length) return null;
  const lv = levelInfo(level);
  const ab = abilityFor(level);
  const last = st.fights[st.fights.length - 1];
  const partDay = !!koToday(st, today);
  return {
    level, attempt: st.fights.filter((x) => x.level === level).length + 1, name: lv.name, slug: lv.slug, world: lv.world, worldName: lv.worldName, boss: lv.boss,
    ability: { id: ab.id, name: ab.name, text: ab.text }, hp: monsterHp(level, hpMult), days: fightDays(level),
    rematch: last.status === "struck", partDay,
    betOptions: BETS.map((b) => ({ bet: b, label: BET_LABEL[String(b)], deadlineOn: deadlineFor(level, today, partDay, b) })),
  };
}

/** Starting a new run while one is going ends that one as abandoned. */
export function abandonRun(input: RunState, clock: GameClock): RunState {
  const st = clone(input);
  if (!st.run.endReason) { st.run.endedOn = clock.today; st.run.endReason = "abandoned"; }
  return st;
}

/**
 * Settle a run up to today, in order: a knockout closes the fight (the next one waits to be
 * started); a deadline that has passed is a strike (a heart, and the same fight goes on one more day
 * with its HP as it was — or at the last heart a knock-back on Normal, defeat on Hardcore); weekly hearts, Veggie Shields and Water Potions are given as they are earned. Running
 * it again with nothing new changes nothing.
 */
export function settle(input: RunState, log: GameLog, clock: GameClock): { state: RunState; added: EventData[] } {
  const st = clone(input);
  const added: EventData[] = [];
  const run = st.run;
  const ev = (kind: EventKind, day: Day, fightId: Id | null, data: Record<string, unknown>, at = clock.nowIso) => {
    const e: EventData = { id: clock.newId(), fightId, day, at, kind, data };
    st.events.push(e); added.push(e);
  };
  // the game grew since this run beat its last monster: it carries on, with its score, hearts and
  // power-ups, and the next new monster waits to be started (Matt, Nov 21 2026)
  if (canCarryOn(st)) {
    const from = lastWonLevel(st) + 1;
    run.endReason = null; run.endedOn = null;
    ev("run_continues", clock.today, null, { level: from, name: levelInfo(from).name, world: levelInfo(from).world, worldName: levelInfo(from).worldName, levels: LEVEL_COUNT });
  }
  if (run.endReason) return { state: st, added };
  const hardcore = () => run.mode === "hardcore";
  const award = awarder(st, log, ev);

  // each pass ends a fight, moves its deadline on a day (a strike) or stops, so the days bound it
  const first = openFightOf(st);
  const passes = first ? (LEVEL_COUNT + 1) * (Math.max(0, daysBetween(first.startedOn, clock.today)) + 2) : 0;
  for (let guard = 0; guard < passes; guard++) {
    const f = openFightOf(st);
    if (!f) break;
    const lv = levelInfo(f.level);
    // the heal a Veggie Shield blocked was deleted (or moved out of the fight): the shield is up again
    const sh = shieldIn(st, f, log, clock.today, usedBeforeOf(st, f));
    if (sh.voided && !run.shieldArmed) {
      run.shieldArmed = true;
      ev("powerup_used", sh.voided.block.day, f.id, { kind: "shield", action: "back", healId: sh.voided.block.data.healId, from: sh.voided.from });
    }
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
      // everything the day's earlier fights used stays used: the list grows through the day, so a
      // workout that KO'd one monster can't come back for the one after next
      const before = f.startedAfter && k.day === f.startedOn ? usedBeforeOf(st, f) ?? [] : [];
      const used = k.used ? [...before, ...k.used] : undefined;
      award(addDays(k.day, -1));
      f.status = "won"; f.endedOn = k.day; f.betLocked = true;
      const max = monsterHp(f.level, f.hpMult);
      f.points = wonPoints({ damage: f.damage, max, koDay: k.day, deadlineOn: f.deadlineOn, flawless: f.flawless, boss: lv.boss, bet: f.bet, hardcore: hardcore() });
      ev("ko", k.day, f.id, { level: f.level, name: lv.name, max, points: f.points, damage: f.damage, flawless: f.flawless, bet: f.bet, daysLeft: Math.max(0, daysBetween(k.day, f.deadlineOn)), boss: lv.boss, ...(k.at && used ? { used } : {}) }, k.at ?? clock.nowIso);
      if (lv.boss) {
        const heart = run.hearts < MAX_HEARTS;
        if (heart) run.hearts += 1;
        ev("heart", k.day, f.id, { reason: "boss", name: lv.name, gained: heart });
        const wind = run.winds < MAX_POWER_UPS;
        if (wind) run.winds += 1;
        ev("powerup_earned", k.day, f.id, { kind: "wind", reason: "boss", name: lv.name, gained: wind });
      }
      // an extra life for every 20 monsters beaten in the run (Normal only; 2 held at most)
      const wins = st.fights.filter((x) => x.status === "won").length;
      if (run.mode === "normal" && f.level < LEVEL_COUNT && wins % LIFE_EVERY === 0) {
        const gained = run.lives < MAX_LIVES;
        if (gained) run.lives += 1;
        ev("life", k.day, f.id, { wins, gained });
      }
      if (f.level === LEVEL_COUNT) {
        run.endedOn = k.day; run.endReason = "finished";
        ev("finish", k.day, f.id, { levels: LEVEL_COUNT, worlds: Math.ceil(LEVEL_COUNT / 10), name: lv.name });
        break;
      }
      // between fights: the next monster waits to be started (startNextFight), by hand or by Keep
      // the monsters coming on a later day (Matt, Nov 14 2026)
      break;
    }

    if (clock.today > f.deadlineOn) {
      const missed = f.deadlineOn;
      award(missed);
      f.betLocked = true;
      run.hearts -= 1;
      // a heart, and one more day: the fight stays open and the monster's HP stays where it is
      // (Matt, Nov 15 2026). Every further missed day costs another heart, until the last one.
      if (run.hearts > 0) {
        f.deadlineOn = addDays(missed, 1);
        ev("strike", missed, f.id, { level: f.level, name: lv.name, max: sim.max, hpLeft: sim.hp + sim.bonus, hearts: run.hearts, extended: true, deadlineOn: f.deadlineOn });
        continue;
      }
      // the last heart: the fight is over. What comes next (the same monster again after an extra
      // life, the start of the world after a knock-back) waits to be started.
      f.status = "struck"; f.endedOn = missed;
      f.points = struckPoints({ damage: f.damage, hardcore: hardcore() });
      ev("strike", missed, f.id, { level: f.level, name: lv.name, max: sim.max, hpLeft: sim.hp + sim.bonus, hearts: 0, points: f.points });
      if (run.mode === "normal" && run.lives > 0) {
        // an extra life: a full set of hearts, and the same monster again at full HP with its full time
        run.lives -= 1; run.hearts = START_HEARTS;
        ev("life_used", missed, f.id, { level: f.level, name: lv.name, lives: run.lives });
      } else if (run.mode === "normal") {
        run.knockbacks += 1; run.hearts = START_HEARTS;
        const to = firstLevelOfWorld(f.level);
        ev("knockback", missed, f.id, { from: f.level, to, world: lv.world, worldName: lv.worldName, points: -250 });
      } else {
        run.hearts = 0; run.endedOn = missed; run.endReason = "defeated";
        ev("defeat", missed, f.id, { level: f.level, name: lv.name });
      }
      break;
    }
    break;
  }
  if (!run.endReason) award(addDays(clock.today, -1));
  // a run that ended counts only the entries up to its last day
  const ended = run.endReason && run.endedOn && log.entryDays;
  run.logPoints = logPoints(ended ? log.entryDays!.filter((d) => d <= run.endedOn!).length : log.entriesSinceStart);
  run.score = scoreOf(st);
  if (run.endReason === "defeated") added[added.length - 1].data.score = run.score;
  return { state: st, added };
}

/** The highest level this run has beaten (0 = none yet). */
const lastWonLevel = (st: RunState): number => st.fights.reduce((m, f) => (f.status === "won" ? Math.max(m, f.level) : m), 0);

/** A run that finished (beat the last monster there was) before the game grew: it carries on at the first new level. */
export const canCarryOn = (st: RunState): boolean => st.run.endReason === "finished" && lastWonLevel(st) < LEVEL_COUNT;

/** The run is over for good: ended, and not one that carries on now the game has more levels. */
export const runOver = (st: RunState): boolean => !!st.run.endReason && !canCarryOn(st);

const scoreOf = (st: RunState) => runScore(st.fights.filter((f) => f.status !== "open").map((f) => f.points), st.run.logPoints, st.run.knockbacks);

/**
 * Weekly hearts and Veggie Shields earned on finished days: `award(upTo)` gives what is due up to
 * that day. It carries on from where the last call stopped (one settle calls it again and again,
 * always further on), so a long time away costs one pass over the days, not one per fight.
 */
function awarder(st: RunState, log: GameLog, ev: (kind: EventKind, day: Day, fightId: Id | null, data: Record<string, unknown>) => void): (upTo: Day) => void {
  const run = st.run;
  const active = new Set(log.activities.map((a) => a.day));
  const splurged = new Set(log.splurges.map((s) => s.day));
  // weeks already given a heart (by their first day); a week that overlaps one of them is skipped,
  // so changing the week start mid-run can't pay the same days twice
  const paid = st.events.filter((e) => e.kind === "heart" && e.data.reason === "week").map((e) => String(e.data.week));
  let ws = weekStartOf(run.startedOn, log.weekStart);
  // a run that carried on after the game grew earns nothing for the days it sat finished
  const resumed = st.events.filter((e) => e.kind === "run_continues").map((e) => e.day).sort().pop() ?? null;
  // clean days in a row: each time they reach 3, a Veggie Shield, and the count starts again
  const lastShield = st.events.filter((e) => e.kind === "powerup_earned" && e.data.kind === "shield").map((e) => String(e.data.day)).sort().pop();
  let sd = lastShield ? addDays(lastShield, 1) : run.startedOn;
  if (resumed && sd < resumed) sd = resumed;
  let streak = 0;
  return (upTo) => {
    if (upTo < run.startedOn) return;
    // a week (the person's own week start) with 5+ active days inside the run: +1 heart when it ends
    for (; addDays(ws, 6) <= upTo; ws = addDays(ws, 7)) {
      if (paid.some((w) => Math.abs(daysBetween(w, ws)) < 7) || (resumed && ws < resumed)) continue;
      let n = 0;
      for (let i = 0; i < 7; i++) { const d = addDays(ws, i); if (d >= run.startedOn && active.has(d)) n += 1; }
      if (n < WEEK_ACTIVE_DAYS) continue;
      const gained = run.hearts < MAX_HEARTS;
      if (gained) run.hearts += 1;
      paid.push(ws);
      ev("heart", addDays(ws, 6), null, { reason: "week", week: ws, activeDays: n, gained });
    }
    for (; sd <= upTo; sd = addDays(sd, 1)) {
      if (splurged.has(sd)) { streak = 0; continue; }
      if (++streak < SHIELD_STREAK) continue;
      streak = 0;
      const gained = run.shields < MAX_POWER_UPS;
      if (gained) run.shields += 1;
      ev("powerup_earned", sd, null, { kind: "shield", day: sd, gained });
    }
  };
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
    case "fight_start": return d.auto
      ? `${d.name} showed up by itself: Keep the monsters coming is on. The fight is on!`
      : `${d.name}: the fight is on!`;
    case "run_start": return d.auto
      ? `Run #${d.number} started by itself (${d.mode === "hardcore" ? "Hardcore" : "Normal"}): Keep the monsters coming is on. Crumbs is first.`
      : `Run #${d.number} started (${d.mode === "hardcore" ? "Hardcore" : "Normal"}). Crumbs is first.`;
    case "ko": return `${d.name} went down! +${Number(d.points).toLocaleString("en-US")} points.`;
    case "strike": return `${d.name} struck: the deadline passed with ${d.hpLeft} HP left. You lost a heart${d.extended ? ", and the fight goes on one more day" : ""}.`;
    case "knockback": return `Knocked back to level ${d.to}, the start of ${d.worldName}. −250 points, and 3 hearts again.`;
    case "defeat": return `Defeated by ${d.name}. The run is over${d.score !== undefined ? ` with ${Number(d.score).toLocaleString("en-US")} points` : ""}.`;
    case "finish": return `All ${d.levels ?? 60} monsters crushed! The run is complete.`;
    case "run_continues": return `More monsters! The run carries on at level ${d.level}: ${d.name}, in ${d.worldName}. Your score, hearts and power-ups come along.`;
    case "life": return `An extra life for ${d.wins} monsters beaten.${d.gained === false ? " You already hold 2." : ""}`;
    case "life_used": return `An extra life spent: 3 hearts again, and ${d.name} is up for a rematch at full HP.`;
    case "heart": return (d.reason === "boss" ? `A heart for beating ${d.name}.` : `A heart for ${d.activeDays} active days in a week.`) + keep;
    case "powerup_earned":
      return (d.kind === "shield" ? "A Veggie Shield for 3 clean days in a row." : d.kind === "potion" ? `A Water Potion for ${d.what ?? "a workout"} (${d.minutes} min).` : `A Second Wind for beating ${d.name}.`) + keep;
    case "powerup_used":
      if (d.kind === "shield") return d.action === "block" ? "The Veggie Shield blocked a heal." : d.action === "back" ? "The Veggie Shield is up again: the heal it blocked no longer counts." : "Veggie Shield up: the next heal is blocked.";
      return d.kind === "potion" ? `Water Potion: ${POTION_DAMAGE} damage.` : "Second Wind: one more day on the deadline.";
    case "mode_drop": return "Switched from Hardcore to Normal.";
  }
}

export const toEventView = (e: EventData): EventView => ({ ...e, text: eventText(e) });

/** Everything GET /api/game returns, from a stored run (or none) and the log. */
export function buildView(st: RunState | null, log: GameLog | null, today: Day, needsSync: boolean, autoStart = false, hpMult = log?.hpMult ?? 1): GameView {
  if (!st) return { today, run: null, fight: null, next: null, autoStart, hpMult, map: LEVELS.map((l) => ({ level: l.level, status: "locked", attempts: 0, wins: 0, strikes: 0, bestPoints: 0 })), events: [], needsSync: false };
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
    const input = fightInputFor(st, open, lg, today);
    const sim = simulateFight(input);
    const locked = open.betLocked || today > open.startedOn || sim.attacked;
    const { points: _p, ...rest } = open;
    fight = {
      ...rest, damage: sim.damage, heals: sim.heals, flawless: sim.flawless, betLocked: locked,
      name: lv.name, slug: lv.slug, world: lv.world, worldName: lv.worldName, boss: lv.boss,
      ability: { id: ab.id, name: ab.name, text: ab.text },
      daysLeft: Math.max(0, daysBetween(today, open.deadlineOn) + 1),
      betOptions: locked ? [] : BETS.map((b) => ({ bet: b, label: BET_LABEL[String(b)], deadlineOn: addDays(open.deadlineOn, betDays(open.bet) - betDays(b)) })),
      hp: sim.hp, max: sim.max, bonus: sim.bonus, bonusMax: sim.bonusMax, todayDamage: sim.todayDamage, todayHeals: sim.todayHeals, lines: sim.lines,
      finish: { hp: sim.hp + sim.bonus, minutes: sim.hp + sim.bonus, calories: (sim.hp + sim.bonus) * 10 },
      powerUpsAllowed: !ab.noPowerUps,
      input,
    };
  }
  const next = active && !open ? nextView(st, today, hpMult) : null;
  const at = run.endReason === "finished" ? lastWonLevel(st) + 1 : next?.level ?? (open ?? st.fights[st.fights.length - 1])?.level ?? 1;
  const strikes = st.events.filter((e) => e.kind === "strike");
  const map: MapLevel[] = LEVELS.map((l) => {
    const fs = st.fights.filter((f) => f.level === l.level);
    const won = fs.filter((f) => f.status === "won");
    return {
      level: l.level,
      status: l.level < at ? "beaten" : l.level === at && (open || next) ? "current" : "locked",
      attempts: fs.length, wins: won.length, strikes: strikes.filter((e) => Number(e.data.level) === l.level).length, bestPoints: won.reduce((m, f) => Math.max(m, f.points), 0),
    };
  });
  return {
    today,
    run: { ...run, active, hardcore: run.mode === "hardcore", liveScore, maxHearts: MAX_HEARTS, maxLives: MAX_LIVES, maxPowerUps: MAX_POWER_UPS },
    fight, next, autoStart, hpMult, map,
    events: st.events.slice(-50).reverse().map(toEventView),
    needsSync,
  };
}
