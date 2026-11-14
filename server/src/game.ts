/**
 * Calorie Crusher on the server: loads a person's run from the database, hands it to the pure
 * engine (shared/game) and stores what comes back. Every call names the owner and every query
 * filters by it, as in log.ts — one person never reads or changes another's run (the Hall of
 * Heroes, which lists everyone's, only reads).
 *
 * Reads never write (CLAUDE.md rule 7): GET works the open fight out from the log and says
 * `needsSync` when a KO, a missed deadline, a heart or a power-up waits; POST /api/game/sync settles
 * them. Days and the clock come from the phone (rule 3); `at` times are the server's clock, the
 * same clock as a log entry's created_at.
 */
import type Database from "better-sqlite3";
import { z } from "zod";
import type { Day, Id } from "../../shared/types.js";
import {
  abandonRun, addDays, badgesFor, daysBetween, BETS, buildView, dropToNormal, GameRuleError, lastEndedBefore, newRun, pendingLevel, setBet, settle, startNextFight, toEventView, usePowerUp,
  type ActivityEv, type Bet, type EventData, type FightData, type GameClock, type GameLog, type GameView, type HallRun, type HallView,
  type AutoResult, type Mode, type RunData, type RunState, type SplurgeEv, type SyncResult,
} from "../../shared/game/index.js";
import type { Users } from "./users.js";
import { newId, now, parse, realDay, UserError } from "./util.js";

interface RunRow {
  id: Id; user_id: Id; number: number; mode: Mode; started_at: string; started_on: Day; ended_on: Day | null; end_reason: RunData["endReason"];
  hearts: number; shields: number; potions: number; winds: number; shield_armed: number; knockbacks: number; hardcore_dropped_on: Day | null; log_points: number; score: number;
}
interface FightRow {
  id: Id; run_id: Id; user_id: Id; level: number; attempt: number; started_on: Day; started_after: string | null; deadline_on: Day; bet: number;
  status: FightData["status"]; ended_on: Day | null; damage: number; heals: number; points: number; flawless: number; bet_locked: number; seq: number;
}
interface EventRow { id: Id; run_id: Id; fight_id: Id | null; day: Day; at: string; kind: EventData["kind"]; data_json: string; seq: number }

const toRun = (r: RunRow): RunData => ({
  id: r.id, number: r.number, mode: r.mode, startedAt: r.started_at, startedOn: r.started_on, endedOn: r.ended_on, endReason: r.end_reason,
  hearts: r.hearts, shields: r.shields, potions: r.potions, winds: r.winds, shieldArmed: !!r.shield_armed, knockbacks: r.knockbacks,
  hardcoreDroppedOn: r.hardcore_dropped_on, logPoints: r.log_points, score: r.score,
});
const toFight = (r: FightRow): FightData => ({
  id: r.id, level: r.level, attempt: r.attempt, startedOn: r.started_on, startedAfter: r.started_after, deadlineOn: r.deadline_on, bet: r.bet as Bet,
  status: r.status, endedOn: r.ended_on, damage: r.damage, heals: r.heals, points: r.points, flawless: !!r.flawless, betLocked: !!r.bet_locked,
});
const toEvent = (r: EventRow): EventData => {
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(r.data_json); } catch {}
  return { id: r.id, fightId: r.fight_id, day: r.day, at: r.at, kind: r.kind, data };
};

/**
 * The phone's day, as everywhere (CLAUDE.md rule 3). It must be within two days of this computer's
 * own date: not to work out "today" (time zones put the two a day apart), only to refuse a phone
 * whose clock is far off — a day years ahead would settle years of missed deadlines at once.
 */
export const DAY_SLACK = 2;
const daySchema = (serverDay: () => Day) => z.string({ error: "Which day is it?" }).refine(realDay, "Which day is it?")
  .refine((d) => Math.abs(daysBetween(serverDay(), d)) <= DAY_SLACK, "Your phone's date looks wrong: it is more than two days away from this computer's date. Check the date on your phone, then try again.");
const utcDay = (): Day => new Date().toISOString().slice(0, 10);
const nowTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "The time looks wrong.").or(z.literal("")).default("");
function schemas(serverDay: () => Day) {
  const today = daySchema(serverDay);
  const clock = z.object({ today, now: nowTime });
  return {
    today, clock,
    run: clock.extend({ mode: z.enum(["normal", "hardcore"], { error: "Pick Normal or Hardcore." }) }),
    bet: clock.extend({ bet: z.union(BETS.map((b) => z.literal(b)) as [z.ZodLiteral<1>, z.ZodLiteral<1.5>, z.ZodLiteral<2>], { error: "Pick Steady, Bold or Daredevil." }) }),
    power: clock.extend({ kind: z.enum(["shield", "potion", "wind"], { error: "Pick a Veggie Shield, a Water Potion or a Second Wind." }) }),
    mode: clock.extend({ to: z.literal("normal", { error: "A run can only switch from Hardcore to Normal." }) }),
  };
}

export class Game {
  private readonly sc: ReturnType<typeof schemas>;
  /** `serverDay` is this computer's UTC date, only for the sanity check on the phone's day (tests pass a fixed one) */
  constructor(private readonly db: Database.Database, private readonly users: Users, serverDay: () => Day = utcDay) {
    this.sc = schemas(serverDay);
  }

  // ---------------------------------------------------------------- loading and storing
  private latestRun(owner: Id): RunRow | undefined {
    return this.db.prepare("SELECT * FROM game_runs WHERE user_id = ? ORDER BY number DESC LIMIT 1").get(owner) as RunRow | undefined;
  }

  private load(owner: Id): RunState | null {
    const r = this.latestRun(owner);
    if (!r) return null;
    const fights = (this.db.prepare("SELECT * FROM game_fights WHERE run_id = ? AND user_id = ? ORDER BY seq").all(r.id, owner) as FightRow[]).map(toFight);
    const events = (this.db.prepare("SELECT * FROM game_events WHERE run_id = ? ORDER BY seq").all(r.id) as EventRow[]).map(toEvent);
    return { run: toRun(r), fights, events };
  }

  /** The log the run needs: from the day before it started to today, and the entries made since it started. */
  private gameLog(owner: Id, run: RunData, t: Day): GameLog {
    const from = addDays(run.startedOn, -1);
    const splurges = (this.db.prepare("SELECT id, what, day, time, size, planned, created_at FROM splurges WHERE user_id = ? AND day BETWEEN ? AND ?").all(owner, from, t) as
      { id: Id; what: string; day: Day; time: string; size: SplurgeEv["size"]; planned: number; created_at: string }[])
      .map((s): SplurgeEv => ({ id: s.id, what: s.what, day: s.day, time: s.time, size: s.size, planned: !!s.planned, createdAt: s.created_at }));
    const activities = (this.db.prepare("SELECT id, what, day, time, minutes, calories, created_at FROM activities WHERE user_id = ? AND day BETWEEN ? AND ?").all(owner, from, t) as
      { id: Id; what: string; day: Day; time: string; minutes: number | null; calories: number | null; created_at: string }[])
      .map((a): ActivityEv => ({ id: a.id, what: a.what, day: a.day, time: a.time, minutes: a.minutes, calories: a.calories, createdAt: a.created_at }));
    const made = (table: string) => (this.db.prepare(`SELECT day FROM ${table} WHERE user_id = ? AND created_at >= ?`).all(owner, run.startedAt) as { day: Day }[]).map((r) => r.day);
    const entryDays = [...made("splurges"), ...made("activities"), ...made("weigh_ins")];
    return { splurges, activities, entriesSinceStart: entryDays.length, entryDays, weekStart: this.users.settings(owner).weekStart };
  }

  /** Write a run as the engine left it: the run row, every fight (new ones added), and the new events. */
  private store(owner: Id, st: RunState, added: EventData[], isNew = false): void {
    const r = st.run;
    if (isNew) {
      this.db.prepare(`INSERT INTO game_runs (id, user_id, number, mode, started_at, started_on, hearts) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(r.id, owner, r.number, r.mode, r.startedAt, r.startedOn, r.hearts);
    }
    const u = this.db.prepare(`UPDATE game_runs SET mode = ?, ended_on = ?, end_reason = ?, hearts = ?, shields = ?, potions = ?, winds = ?, shield_armed = ?,
      knockbacks = ?, hardcore_dropped_on = ?, log_points = ?, score = ? WHERE id = ? AND user_id = ?`)
      .run(r.mode, r.endedOn, r.endReason, r.hearts, r.shields, r.potions, r.winds, r.shieldArmed ? 1 : 0, r.knockbacks, r.hardcoreDroppedOn, r.logPoints, r.score, r.id, owner);
    if (!u.changes) throw new UserError("That run no longer exists.", 404);
    const have = new Set((this.db.prepare("SELECT id FROM game_fights WHERE run_id = ?").all(r.id) as { id: Id }[]).map((x) => x.id));
    const ins = this.db.prepare(`INSERT INTO game_fights (id, run_id, user_id, level, attempt, started_on, started_after, deadline_on, bet, status, ended_on, damage, heals, points, flawless, bet_locked, seq)
      VALUES (@id, @run_id, @user_id, @level, @attempt, @started_on, @started_after, @deadline_on, @bet, @status, @ended_on, @damage, @heals, @points, @flawless, @bet_locked, @seq)`);
    const upd = this.db.prepare(`UPDATE game_fights SET deadline_on = @deadline_on, bet = @bet, status = @status, ended_on = @ended_on, damage = @damage, heals = @heals,
      points = @points, flawless = @flawless, bet_locked = @bet_locked WHERE id = @id AND user_id = @user_id`);
    st.fights.forEach((f, seq) => {
      const row = { id: f.id, run_id: r.id, user_id: owner, level: f.level, attempt: f.attempt, started_on: f.startedOn, started_after: f.startedAfter, deadline_on: f.deadlineOn,
        bet: f.bet, status: f.status, ended_on: f.endedOn, damage: f.damage, heals: f.heals, points: f.points, flawless: f.flawless ? 1 : 0, bet_locked: f.betLocked ? 1 : 0, seq };
      if (have.has(f.id)) upd.run(row); else ins.run(row);
    });
    let seq = (this.db.prepare("SELECT COALESCE(MAX(seq), -1) AS n FROM game_events WHERE run_id = ?").get(r.id) as { n: number }).n;
    const ev = this.db.prepare("INSERT INTO game_events (id, run_id, fight_id, day, at, kind, data_json, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    for (const e of added) ev.run(e.id, r.id, e.fightId, e.day, e.at, e.kind, JSON.stringify(e.data), ++seq);
  }

  private clock(t: Day, time = ""): GameClock {
    return { today: t, nowTime: time, nowIso: now(), newId };
  }

  /** Engine rules the person ran into become a plain 409. */
  private rule<T>(fn: () => T): T {
    try { return fn(); } catch (e) { if (e instanceof GameRuleError) throw new UserError(e.message, 409); throw e; }
  }

  /** Settle the latest run (when one is going) and store it; returns it with what happened. */
  private settleAndStore(owner: Id, c: GameClock): { st: RunState | null; happened: EventData[] } {
    const st = this.load(owner);
    if (!st || st.run.endReason) return { st, happened: [] };
    const out = settle(st, this.gameLog(owner, st.run, c.today), c);
    this.store(owner, out.state, out.added);
    return { st: out.state, happened: out.added };
  }

  private result(owner: Id, st: RunState | null, happened: EventData[], t: Day): SyncResult {
    return { happened: happened.map(toEventView), view: buildView(st, st ? this.gameLog(owner, st.run, t) : null, t, false, this.users.settings(owner).autoStart) };
  }

  // ---------------------------------------------------------------- the routes
  /** GET /api/game: everything the game screens need. Never writes; `needsSync` says a POST /sync would change something. */
  view(owner: Id, q: { today?: unknown; now?: unknown }): GameView {
    const t = parse(this.sc.today, q.today);
    if (q.now !== undefined && q.now !== "") parse(nowTime, q.now);
    const st = this.load(owner);
    const autoStart = this.users.settings(owner).autoStart;
    if (!st) return buildView(null, null, t, false, autoStart);
    const log = this.gameLog(owner, st.run, t);
    let n = 0;
    const needsSync = !st.run.endReason && settle(st, log, { today: t, nowTime: "", nowIso: now(), newId: () => `dry${n++}` }).added.length > 0;
    return buildView(st, log, t, needsSync, autoStart);
  }

  /** POST /api/game/sync: settle KOs, strikes, weekly hearts and power-ups up to today. */
  sync(owner: Id, body: unknown): SyncResult {
    const v = parse(this.sc.clock, body);
    const c = this.clock(v.today, v.now);
    return this.db.transaction(() => { const { st, happened } = this.settleAndStore(owner, c); return this.result(owner, st, happened, v.today); })();
  }

  /** POST /api/game/run: start run N+1 (a run still going is settled, then ends as abandoned). */
  start(owner: Id, body: unknown): SyncResult {
    const v = parse(this.sc.run, body);
    const c = this.clock(v.today, v.now);
    return this.db.transaction(() => {
      const { st: old } = this.settleAndStore(owner, c);
      if (old && !old.run.endReason) this.store(owner, abandonRun(old, c), []);
      return this.begin(owner, (old?.run.number ?? 0) + 1, v.mode, c, false);
    })();
  }

  /** Run N: stored, then settled at once (fight 1 counts the whole of today, so it may already be over). */
  private begin(owner: Id, number: number, mode: Mode, c: GameClock, auto: boolean): SyncResult {
    const fresh = newRun(number, mode, c, auto);
    this.store(owner, fresh.state, fresh.added, true);
    const out = settle(fresh.state, this.gameLog(owner, fresh.state.run, c.today), c);
    this.store(owner, out.state, out.added);
    return this.result(owner, out.state, [...fresh.added, ...out.added], c.today);
  }

  /**
   * POST /api/game/auto — Keep the monsters coming (Matt, Nov 14 2026). The game page calls it before
   * its first read each day. With the setting on, the first call of the person's day (on any phone)
   * settles the run, then:
   * - between fights in a run that is going, when the last fight ended on an earlier day (a KO or a
   *   missed deadline before today): the next fight starts, with the whole of today. A monster that
   *   went down today means nothing starts until tomorrow (or until it is started by hand);
   * - no run going: run N+1 starts, in the last run's mode (Normal for a first run) — but only when
   *   the run had already ended before this look. A run that ends in this very settle (a missed
   *   deadline that was its last heart) gets its Defeated screen, and the new run starts the next day.
   * Later calls that day settle nothing and start nothing. With the setting off nothing is stamped.
   */
  auto(owner: Id, body: unknown): AutoResult {
    const v = parse(this.sc.clock, body);
    const c = this.clock(v.today, v.now);
    return this.db.transaction((): AutoResult => {
      if (!this.users.settings(owner).autoStart) return { started: false, checked: false };
      const u = this.db.prepare("UPDATE users SET game_checked_on = ? WHERE id = ? AND (game_checked_on IS NULL OR game_checked_on <> ?)").run(v.today, owner, v.today);
      const stored = this.load(owner);
      const endedBefore = !stored || !!stored.run.endReason;
      const { st, happened } = this.settleAndStore(owner, c);
      if (!u.changes) return { started: false, checked: true, ...this.result(owner, st, happened, v.today) };
      if (endedBefore) {
        return { started: "run", checked: true, ...this.begin(owner, (stored?.run.number ?? 0) + 1, stored?.run.mode ?? "normal", c, true) };
      }
      if (st && !st.run.endReason && pendingLevel(st) !== null && lastEndedBefore(st, v.today)) {
        const out = startNextFight(st, this.gameLog(owner, st.run, v.today), c, 1, true);
        this.store(owner, out.state, out.added);
        return { started: "fight", checked: true, ...this.result(owner, out.state, [...happened, ...out.added], v.today) };
      }
      return { started: false, checked: true, ...this.result(owner, st, happened, v.today) };
    })();
  }

  /** POST /api/game/next: start the fight that is up next, now (Choose your fight → Start the fight), at a bet. */
  next(owner: Id, body: unknown): SyncResult {
    const v = parse(this.sc.bet.partial({ bet: true }), body);
    const c = this.clock(v.today, v.now);
    return this.db.transaction(() => {
      const { st, happened } = this.settleAndStore(owner, c);
      if (!st) throw new UserError("Start a run first.", 409);
      const out = this.rule(() => startNextFight(st, this.gameLog(owner, st.run, v.today), c, (v.bet ?? 1) as Bet));
      this.store(owner, out.state, out.added);
      return this.result(owner, out.state, [...happened, ...out.added], v.today);
    })();
  }

  /** POST /api/game/bet: Steady, Bold or Daredevil, until the bet locks. */
  bet(owner: Id, body: unknown): SyncResult {
    const v = parse(this.sc.bet, body);
    const c = this.clock(v.today, v.now);
    return this.db.transaction(() => {
      const { st, happened } = this.settleAndStore(owner, c);
      if (!st) throw new UserError("Start a run first.", 409);
      const next = this.rule(() => setBet(st, this.gameLog(owner, st.run, v.today), c, v.bet as Bet));
      this.store(owner, next, []);
      return this.result(owner, next, happened, v.today);
    })();
  }

  /** POST /api/game/powerup: put up a Veggie Shield, drink a Water Potion or take a Second Wind. */
  powerUp(owner: Id, body: unknown): SyncResult {
    const v = parse(this.sc.power, body);
    const c = this.clock(v.today, v.now);
    return this.db.transaction(() => {
      const { st, happened } = this.settleAndStore(owner, c);
      if (!st) throw new UserError("Start a run first.", 409);
      const out = this.rule(() => usePowerUp(st, this.gameLog(owner, st.run, v.today), c, v.kind));
      this.store(owner, out.state, out.added);
      return this.result(owner, out.state, [...happened, ...out.added], v.today);
    })();
  }

  /** POST /api/game/mode: Hardcore → Normal (one way). */
  mode(owner: Id, body: unknown): SyncResult {
    const v = parse(this.sc.mode, body);
    const c = this.clock(v.today, v.now);
    return this.db.transaction(() => {
      const { st, happened } = this.settleAndStore(owner, c);
      if (!st) throw new UserError("Start a run first.", 409);
      const out = this.rule(() => dropToNormal(st, c));
      this.store(owner, out.state, out.added);
      return this.result(owner, out.state, [...happened, ...out.added], v.today);
    })();
  }

  /** GET /api/game/hall: everyone's runs (several users = separation, not privacy). Reads only. */
  hall(owner: Id, q: { today?: unknown }): HallView {
    const t = parse(this.sc.today, q.today);
    const rows = this.db.prepare(`SELECT r.*, u.name AS user_name,
        (SELECT level FROM game_fights f WHERE f.run_id = r.id ORDER BY seq DESC LIMIT 1) AS at_level
      FROM game_runs r JOIN users u ON u.id = r.user_id ORDER BY r.score DESC, r.started_at`).all() as (RunRow & { user_name: string; at_level: number | null })[];
    const month = t.slice(0, 7);
    const runs: (HallRun & { _month: boolean })[] = rows.map((r) => ({
      userId: r.user_id, name: r.user_name, isYou: r.user_id === owner, number: r.number, mode: r.mode, hardcore: r.mode === "hardcore",
      droppedFromHardcore: r.mode === "normal" && !!r.hardcore_dropped_on, startedOn: r.started_on, endedOn: r.ended_on, endReason: r.end_reason, level: r.at_level ?? 1, score: r.score,
      // played this month: still going, or started or ended in it
      _month: !r.end_reason || r.started_on.slice(0, 7) === month || (r.ended_on ?? "").slice(0, 7) === month,
    }));
    const clean = (l: typeof runs): HallRun[] => l.slice(0, 50).map(({ _month: _m, ...x }) => x);
    const fights = this.db.prepare(`SELECT r.number AS run, f.seq, f.level, f.status, f.bet, f.flawless, f.ended_on
      FROM game_fights f JOIN game_runs r ON r.id = f.run_id WHERE f.user_id = ? AND r.user_id = ?`).all(owner, owner) as
      { run: number; seq: number; level: number; status: FightData["status"]; bet: number; flawless: number; ended_on: Day | null }[];
    const badges = badgesFor(fights.map((f) => ({ run: f.run, seq: f.seq, level: f.level, status: f.status, bet: f.bet as Bet, flawless: !!f.flawless, endedOn: f.ended_on })));
    return { allTime: clean(runs), thisMonth: clean(runs.filter((r) => r._month)), hardcore: clean(runs.filter((r) => r.hardcore)), mine: clean(runs.filter((r) => r.isYou)), badges };
  }
}
