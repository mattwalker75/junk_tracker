/**
 * Craving Crusher's data model, used by the engine (pure), the server (which stores it) and the page.
 * Days are the phone's days ("2026-11-11"); `at` times are the server's ISO clock, the same clock
 * as a log entry's `createdAt`, so the two can be compared.
 */
import type { Day, Id, Size } from "../types.js";
import type { Badge } from "./badges.js";

export type Mode = "normal" | "hardcore";
export type EndReason = "defeated" | "finished" | "abandoned";
/** Steady ×1 (the default deadline), Bold ×1.5 (one day less), Daredevil ×2 (two days less) */
export type Bet = 1 | 1.5 | 2;
export const BETS: readonly Bet[] = [1, 1.5, 2];
export const BET_LABEL: Record<string, string> = { "1": "Steady", "1.5": "Bold", "2": "Daredevil" };
export type PowerUp = "shield" | "potion" | "wind";
export const POWER_UP_LABEL: Record<PowerUp, string> = { shield: "Veggie Shield", potion: "Water Potion", wind: "Second Wind" };

export const START_HEARTS = 3;
export const MAX_HEARTS = 5;
export const MAX_POWER_UPS = 3;

/** A splurge as the engine sees it. No time ("") means "assume the worst" for time-based abilities. */
export interface SplurgeEv { id: Id; what: string; day: Day; time: string; size: Size; planned: boolean; createdAt: string }
/** An activity (a workout) as the engine sees it; minutes or calories missing count as 0. */
export interface ActivityEv { id: Id; what: string; day: Day; time: string; minutes: number | null; calories: number | null; createdAt: string }

/** The person's log, as much of it as the run needs (from the day before the run started to today). */
export interface GameLog {
  splurges: SplurgeEv[];
  activities: ActivityEv[];
  /** log entries (activities, splurges, weigh-ins) created since the run started: +5 points each */
  entriesSinceStart: number;
  /**
   * the days of those entries: a run that ends counts only the ones on or before its last day (an
   * entry made after a defeat but before the next sync is not part of the run)
   */
  entryDays?: Day[];
  /** the person's week start, for the weekly heart */
  weekStart: 0 | 1;
}

export interface RunData {
  id: Id;
  /** 1, 2, 3… per person */
  number: number;
  mode: Mode;
  startedAt: string;
  startedOn: Day;
  endedOn: Day | null;
  endReason: EndReason | null;
  hearts: number;
  shields: number;
  potions: number;
  winds: number;
  /** a Veggie Shield is up: the next heal is blocked */
  shieldArmed: boolean;
  knockbacks: number;
  /** set when a Hardcore run was switched to Normal */
  hardcoreDroppedOn: Day | null;
  logPoints: number;
  score: number;
}

export type FightStatus = "open" | "won" | "struck";
export interface FightData {
  id: Id;
  level: number;
  attempt: number;
  startedOn: Day;
  /**
   * set when the fight began partway through a day (after a KO): the knockout's moment. Which of
   * that day's entries count is decided by the KO event's `used` list (engine.ts `counts`).
   */
  startedAfter: string | null;
  /** the fight ends at midnight at the end of that day */
  deadlineOn: Day;
  bet: Bet;
  status: FightStatus;
  endedOn: Day | null;
  damage: number;
  heals: number;
  points: number;
  flawless: boolean;
  betLocked: boolean;
}

export type EventKind = "run_start" | "fight_start" | "ko" | "strike" | "knockback" | "defeat" | "finish" | "heart" | "powerup_earned" | "powerup_used" | "mode_drop";
export interface EventData {
  id: Id;
  fightId: Id | null;
  day: Day;
  at: string;
  kind: EventKind;
  data: Record<string, unknown>;
}

/** Everything stored about one run: the run, its fights in order, and what happened. */
export interface RunState { run: RunData; fights: FightData[]; events: EventData[] }

/** The moment a change is made: the phone's day and clock, and the server's clock. */
export interface GameClock {
  today: Day;
  /** the phone's time, "HH:MM", or "" */
  nowTime: string;
  /** the server's ISO time */
  nowIso: string;
  newId: () => Id;
}

/** The moment a Veggie Shield went up; "start" = it was already up when this fight began. */
export type ArmPoint = { day: Day; time: string; at: string } | "start";

export interface FightInput {
  level: number;
  startedOn: Day;
  startedAfter: string | null;
  /** on a part-day: the start day's entries the fight before used (they don't count here) */
  usedBefore?: Id[] | null;
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

/** One line of the battle log. */
export interface BattleLine {
  day: Day;
  /** "HH:MM", or "" (no time, or the start / end of the day) */
  time: string;
  /** when the entry behind it was logged (ISO); none for the start or end of a day (a clean-day crit) */
  at?: string;
  kind: "hit" | "heal" | "crit" | "potion" | "blocked" | "ability" | "revive" | "ko" | "note";
  /** damage (a hit, crit or potion) or HP healed (bonus HP included); 0 for a note */
  amount: number;
  /** a heal: how much of `amount` went on as bonus HP (the monster was full) */
  bonus?: number;
  /** a plain sentence for the battle screen */
  text: string;
  /** the log entry it came from, when there is one */
  sourceId?: Id;
}

export interface FightResult {
  level: number;
  hp: number;
  max: number;
  /** all damage dealt (overkill included) */
  damage: number;
  /** HP the monster gained from heals (bonus HP included) */
  heals: number;
  /**
   * bonus HP: a heal past full HP goes on as bonus HP, up to `bonusMax` (20% of max HP); damage
   * takes it off first, so there is bonus HP only while `hp` is at `max`
   */
  bonus: number;
  bonusMax: number;
  /** no heal from a splurge (or a day without a workout) landed */
  flawless: boolean;
  /**
   * the knockout: its day, its moment (null = at midnight, by a clean-day crit or a day-end trick),
   * and the ids of that day's log entries this fight used, up to and including the knockout
   */
  ko: { day: Day; at: string | null; by: "workout" | "potion" | "crit"; used?: Id[] } | null;
  /** a workout or potion did damage (that locks the bet) */
  attacked: boolean;
  lines: BattleLine[];
  /** the heal a newly armed Veggie Shield blocked in this fight (its source id), if any */
  shieldBlocked: string | null;
  /** the activities that counted for this fight, up to the knockout */
  counted: ActivityEv[];
  /** today's damage and heals, for the battle screen */
  todayDamage: number;
  todayHeals: number;
}

// ---------------------------------------------------------------- what GET /api/game returns (stage 2 builds on this)

export interface RunView extends RunData {
  active: boolean;
  /** still Hardcore (×1.25 and the skull) */
  hardcore: boolean;
  /** the score with the log points up to now */
  liveScore: number;
  maxHearts: number;
  maxPowerUps: number;
}

export interface FightView extends Omit<FightData, "points"> {
  name: string;
  slug: string;
  world: number;
  worldName: string;
  boss: boolean;
  ability: { id: string; name: string; text: string };
  /** days left including today (0 once the deadline has passed) */
  daysLeft: number;
  /** the three deadline cards on Choose your fight, while the bet can still change; [] once it is locked */
  betOptions: { bet: Bet; label: string; deadlineOn: Day }[];
  hp: number;
  max: number;
  /** bonus HP on top of a full HP bar (splurges past full), and its cap: 20% of max HP */
  bonus: number;
  bonusMax: number;
  todayDamage: number;
  todayHeals: number;
  lines: BattleLine[];
  /** the "so close" nudge: HP left (bonus HP included), as minutes or as calories */
  finish: { hp: number; minutes: number; calories: number };
  /** false in Bacon Bandit's fight (Stick 'Em Up) */
  powerUpsAllowed: boolean;
  /**
   * The engine's input for this fight (its window, the log it reads, its power-ups), so the page can
   * run the same `preview()` the server would ("this hits Fry Hydra for 66", "heals +35").
   */
  input: FightInput;
}

/**
 * Between fights (Matt, Nov 14 2026): a knockout or a missed deadline closes the fight and nothing
 * opens until the person starts the next one (Choose your fight → Start the fight), or Keep the
 * monsters coming starts it the first time game mode opens on a later day.
 */
export interface NextFightView {
  level: number;
  attempt: number;
  name: string;
  slug: string;
  world: number;
  worldName: string;
  boss: boolean;
  ability: { id: string; name: string; text: string };
  /** its full HP and default deadline in days */
  hp: number;
  days: number;
  /** the same monster again, after a missed deadline (or the start of the world, after a knock-back) */
  rematch: boolean;
  /**
   * started today it gets the rest of the day: a monster went down today, so what that one used
   * stays with it and the deadline counts from tomorrow; otherwise the whole of today counts
   */
  partDay: boolean;
  /** the three deadline cards, for a start now */
  betOptions: { bet: Bet; label: string; deadlineOn: Day }[];
}

export type MapStatus = "beaten" | "current" | "locked";
export interface MapLevel { level: number; status: MapStatus; attempts: number; wins: number; bestPoints: number }

export interface EventView extends Omit<EventData, "id"> { id: Id; text: string }

export interface GameView {
  today: Day;
  /** the person's latest run (going or ended), or null before their first */
  run: RunView | null;
  /** the open fight, worked out from the log; null with no run going, or between fights */
  fight: FightView | null;
  /** between fights in a run that is going: the monster that is up next, waiting to be started */
  next: NextFightView | null;
  /** the person's Keep the monsters coming setting (the between-fights screen says what happens next) */
  autoStart: boolean;
  /** all 60 levels */
  map: MapLevel[];
  /** what happened in the run, newest first (the latest 50) */
  events: EventView[];
  /** a KO, a missed deadline, a heart or a power-up waits to be settled: call POST /api/game/sync */
  needsSync: boolean;
}

export interface SyncResult { happened: EventView[]; view: GameView }
/**
 * POST /api/game/auto: what Keep the monsters coming did — started a run, started the next fight, or
 * nothing — and what came of it (its first look settles the run). `checked`: today's look has been
 * taken (false while the setting is off; then nothing else comes back).
 */
export type AutoResult = { started: false; checked: false } | ({ started: false | "run" | "fight"; checked: true } & SyncResult);

export interface HallRun {
  userId: Id;
  name: string;
  isYou: boolean;
  number: number;
  mode: Mode;
  /** still Hardcore: the skull badge */
  hardcore: boolean;
  /** began as Hardcore and was switched to Normal: shown as "Hardcore → Normal" */
  droppedFromHardcore: boolean;
  startedOn: Day;
  endedOn: Day | null;
  endReason: EndReason | null;
  /** the level the run is at (or ended on) */
  level: number;
  score: number;
}
export interface HallView {
  allTime: HallRun[]; thisMonth: HallRun[]; hardcore: HallRun[]; mine: HallRun[];
  /** the person on screen's badges, from all their runs (badges.ts) */
  badges: Badge[];
}
