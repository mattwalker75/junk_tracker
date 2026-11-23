/**
 * Start over (Matt, Nov 22 2026; canvas round 18): for someone back after a break — their log is cleared and they
 * begin again, their settings kept. Nothing is destroyed: the log is MOVED OUT OF THE WAY into set_aside, so Undo
 * brings it all back (Matt: "they will be able to restore it if need be"). Only the latest start over is held.
 *
 * - What goes: the person's splurges, activities, weigh-ins, goals and Calorie Crusher runs (with their fights and
 *   events, so the Hall of Heroes too). What stays: their settings, and every other person's log (web app).
 * - Workouts brought in from the phone's health app don't come back by themselves: health_imports still remembers
 *   them, and the health import starts again from the day of the start over.
 * - Undo merges: everything set aside comes back, and what was logged since stays too (a weigh-in on the same day:
 *   the newer one stays; goals set aside go after the ones added since). Calorie Crusher goes back to where it was:
 *   runs started since are removed (their entries stay in the log).
 *
 * Runs on the server's better-sqlite3 and on the phone apps' sql.js alike (no Node-only code — CLAUDE.md rule 14);
 * the copy of the database FILE kept first is the caller's job (app.ts on the server, open.ts's Keeper on a phone).
 */
import type Database from "better-sqlite3";
import { z } from "zod";
import type { Day, Id, StartOverCounts, StartOverStatus } from "../../shared/types.js";
import type { Users } from "./users.js";
import { now, parse, realDay, UserError } from "./util.js";

/** the tables a person's log lives in, in the order they go back (a fight needs its run, an event its fight) */
const OWN = ["splurges", "activities", "weigh_ins", "goals", "game_runs", "game_fights"] as const;
type Row = Record<string, unknown>;
interface Held { splurges: Row[]; activities: Row[]; weigh_ins: Row[]; goals: Row[]; game_runs: Row[]; game_fights: Row[]; game_events: Row[] }

const daySchema = z.object({ today: z.string().refine(realDay, "Which day is it?") });

export class StartOver {
  constructor(private readonly db: Database.Database, private readonly users: Users) {}

  /** whether a start over is held (and can be undone), and what it holds. Reads only. */
  status(owner: Id): StartOverStatus {
    const r = this.db.prepare("SELECT made_on, made_at, counts_json FROM set_aside WHERE user_id = ?").get(owner) as { made_on: Day; made_at: string; counts_json: string } | undefined;
    if (!r) return { held: null };
    let counts: StartOverCounts;
    try { counts = JSON.parse(r.counts_json) as StartOverCounts; } catch { counts = { splurges: 0, activities: 0, weighIns: 0, goals: 0, runs: 0, run: null }; }
    return { held: { on: r.made_on, at: r.made_at, counts } };
  }

  /** the day a start over was made (reminders count from it, like from the day a person was added) */
  madeOn(owner: Id): Day | null {
    return (this.db.prepare("SELECT made_on FROM set_aside WHERE user_id = ?").get(owner) as { made_on: Day } | undefined)?.made_on ?? null;
  }

  /** Clear the person's log, setting it aside (replacing any start over held before). All or nothing. */
  startOver(owner: Id, body: unknown): StartOverStatus {
    const { today } = parse(daySchema, body);
    const held = this.collect(owner);
    const last = held.game_runs.slice().sort((a, b) => Number(b.number) - Number(a.number))[0];
    const lastLevel = last ? held.game_fights.filter((f) => f.run_id === last.id).reduce((m, f) => Math.max(m, Number(f.level)), 0) : 0;
    const counts: StartOverCounts = {
      splurges: held.splurges.length, activities: held.activities.length, weighIns: held.weigh_ins.length, goals: held.goals.length,
      runs: held.game_runs.length, run: last ? { number: Number(last.number), level: lastLevel } : null,
    };
    this.db.transaction(() => {
      this.db.prepare(`INSERT INTO set_aside (user_id, made_on, made_at, counts_json, data_json) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (user_id) DO UPDATE SET made_on = excluded.made_on, made_at = excluded.made_at, counts_json = excluded.counts_json, data_json = excluded.data_json`)
        .run(owner, today, now(), JSON.stringify(counts), JSON.stringify(held));
      this.db.prepare("DELETE FROM game_runs WHERE user_id = ?").run(owner); // its fights and events go with it
      for (const t of ["splurges", "activities", "weigh_ins", "goals"]) this.db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(owner);
      // workouts from Health come in again only from today: the ones seen before stay remembered (health_imports)
      const s = this.users.settings(owner);
      if (s.healthImport) this.users.saveSettings(owner, { healthSince: today });
    })();
    return this.status(owner);
  }

  /** Bring back what was set aside, keeping what was logged since; the game goes back to where it was. */
  undo(owner: Id, body: unknown): StartOverStatus {
    parse(daySchema, body);
    const r = this.db.prepare("SELECT data_json FROM set_aside WHERE user_id = ?").get(owner) as { data_json: string } | undefined;
    if (!r) throw new UserError("There is no start over to undo.", 404);
    let held: Held;
    try { held = JSON.parse(r.data_json) as Held; } catch { throw new UserError("The log that was set aside could not be read, so nothing was changed.", 500); }
    this.db.transaction(() => {
      // goals set aside go after the ones added since (the goal you set after starting over stays the goal now)
      const top = (this.db.prepare("SELECT MAX(position) AS p FROM goals WHERE user_id = ?").get(owner) as { p: number | null }).p;
      const goals = top === null ? held.goals : held.goals.map((g) => ({ ...g, position: top + 1 + Number(g.position) }));
      // the game as it was: runs started since go (their fights and events with them)
      this.db.prepare("DELETE FROM game_runs WHERE user_id = ?").run(owner);
      const put = (table: string, rows: Row[]) => {
        for (const row of rows) {
          const cols = Object.keys(row);
          if (!cols.length) continue;
          // only the columns the table still has (a newer app may have dropped none, but added some with defaults)
          this.db.prepare(`INSERT OR IGNORE INTO ${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
            .run(...cols.map((c) => row[c] as never));
        }
      };
      for (const t of OWN) put(t, t === "goals" ? goals : held[t]);
      put("game_events", held.game_events);
      this.db.prepare("DELETE FROM set_aside WHERE user_id = ?").run(owner);
    })();
    return this.status(owner);
  }

  private collect(owner: Id): Held {
    const all = (sql: string, ...args: unknown[]) => this.db.prepare(sql).all(...args) as Row[];
    const runs = all("SELECT * FROM game_runs WHERE user_id = ?", owner);
    const events = runs.length ? all(`SELECT * FROM game_events WHERE run_id IN (${runs.map(() => "?").join(", ")})`, ...runs.map((x) => x.id)) : [];
    return {
      splurges: all("SELECT * FROM splurges WHERE user_id = ?", owner),
      activities: all("SELECT * FROM activities WHERE user_id = ?", owner),
      weigh_ins: all("SELECT * FROM weigh_ins WHERE user_id = ?", owner),
      goals: all("SELECT * FROM goals WHERE user_id = ?", owner),
      game_runs: runs,
      game_fights: all("SELECT * FROM game_fights WHERE user_id = ?", owner),
      game_events: events,
    };
  }
}
