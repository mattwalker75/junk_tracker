/**
 * Goals: each person's list of things to aim for. The open goal at the top of the list is the one
 * on Home (the sticky note); checking it off moves the next one up. Every call names the owner and
 * every query filters by it, as in log.ts.
 *
 * A goal's days count from the day it reaches the top (`started_on`, a day the page sends), so a
 * goal waiting further down never runs down. `settle` keeps that true: the top goal gets a day 1
 * the first time the list is read after it got there, and a goal moved off the top starts over.
 */
import type Database from "better-sqlite3";
import { z } from "zod";
import type { Day, Goal, GoalList, Id } from "../../shared/types.js";
import { newId, now, parse, realDay, UserError } from "./util.js";

interface GoalRow { id: Id; user_id: Id; text: string; days: Goal["days"]; position: number; started_on: Day | null; done_on: Day | null; created_at: string; updated_at: string }

const toGoal = (r: GoalRow): Goal => ({ id: r.id, text: r.text, days: r.days, startedOn: r.started_on, doneOn: r.done_on, createdAt: r.created_at });

const text = z.string({ error: "Say what your goal is." }).trim().min(1, "Say what your goal is.").max(120, "Keep the goal under 120 characters.");
const days = z.union([z.literal(7), z.literal(14), z.literal(30), z.null()], { error: "Pick how long: no end, 1 week, 2 weeks or 1 month." }).default(null);
const addSchema = z.object({ text, days, place: z.enum(["now", "later"], { error: "Say where in the list it goes." }).default("later") });
const editSchema = z.object({ text, days });

/** more than anyone needs, so a runaway page cannot fill the database */
const MAX_OPEN = 50;
const GONE = "That goal no longer exists.";

export class Goals {
  constructor(private readonly db: Database.Database) {}

  private open(owner: Id): GoalRow[] {
    return this.db.prepare("SELECT * FROM goals WHERE user_id = ? AND done_on IS NULL ORDER BY position, created_at").all(owner) as GoalRow[];
  }
  private row(owner: Id, id: Id): GoalRow {
    const r = this.db.prepare("SELECT * FROM goals WHERE id = ? AND user_id = ?").get(id, owner) as GoalRow | undefined;
    if (!r) throw new UserError(GONE, 404);
    return r;
  }

  /** The top goal's day 1 is today if it has none yet; the ones waiting below have none. */
  private settle(owner: Id, today: Day): void {
    const open = this.open(owner);
    this.db.transaction(() => {
      open.forEach((g, i) => {
        if (i === 0 && !g.started_on) this.db.prepare("UPDATE goals SET started_on = ? WHERE id = ?").run(today, g.id);
        if (i > 0 && g.started_on) this.db.prepare("UPDATE goals SET started_on = NULL WHERE id = ?").run(g.id);
      });
    })();
  }

  list(owner: Id, today: unknown): GoalList {
    if (!realDay(today)) throw new UserError("Which day is it?");
    this.settle(owner, today);
    const done = this.db.prepare("SELECT * FROM goals WHERE user_id = ? AND done_on IS NOT NULL ORDER BY done_on DESC, updated_at DESC LIMIT 100").all(owner) as GoalRow[];
    return { open: this.open(owner).map(toGoal), done: done.map(toGoal) };
  }

  /** "now" puts it at the top (it becomes the goal on Home), "later" at the end of the list. */
  add(owner: Id, body: unknown): Goal {
    const v = parse(addSchema, body);
    const open = this.open(owner);
    if (open.length >= MAX_OPEN) throw new UserError(`That is ${MAX_OPEN} goals waiting. Check some off or remove some first.`, 409);
    const position = !open.length ? 0 : v.place === "now" ? open[0].position - 1 : open[open.length - 1].position + 1;
    const t = now();
    const row: GoalRow = { id: newId(), user_id: owner, text: v.text, days: v.days, position, started_on: null, done_on: null, created_at: t, updated_at: t };
    this.db.prepare(`INSERT INTO goals (id, user_id, text, days, position, started_on, done_on, created_at, updated_at)
      VALUES (@id, @user_id, @text, @days, @position, @started_on, @done_on, @created_at, @updated_at)`).run(row);
    return toGoal(row);
  }

  /** New words or a new length. Its day 1 stays: "Keep going" turns a goal whose time is up into one with no end. */
  edit(owner: Id, id: Id, body: unknown): Goal {
    const v = parse(editSchema, body);
    this.row(owner, id);
    this.db.prepare("UPDATE goals SET text = ?, days = ?, updated_at = ? WHERE id = ? AND user_id = ?").run(v.text, v.days, now(), id, owner);
    return toGoal(this.row(owner, id));
  }

  /** One place up or down the open list (up from second place makes it the goal now). */
  move(owner: Id, id: Id, dir: unknown): void {
    if (dir !== "up" && dir !== "down") throw new UserError("Move it up or down.");
    const open = this.open(owner);
    const i = open.findIndex((g) => g.id === id);
    if (i < 0) throw new UserError(GONE, 404);
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= open.length) return;
    const a = open[i], b = open[j];
    // equal positions (two goals added in the same instant) would not swap: spread them out first
    const [pa, pb] = a.position === b.position ? (j > i ? [a.position + 1, a.position] : [a.position - 1, a.position]) : [b.position, a.position];
    this.db.transaction(() => {
      this.db.prepare("UPDATE goals SET position = ?, updated_at = ? WHERE id = ?").run(pa, now(), a.id);
      this.db.prepare("UPDATE goals SET position = ? WHERE id = ?").run(pb, b.id);
    })();
  }

  /** Check it off on the person's own day. The next one moves up. */
  done(owner: Id, id: Id, today: unknown): Goal {
    if (!realDay(today)) throw new UserError("Which day is it?");
    const r = this.row(owner, id);
    if (r.done_on) throw new UserError("That goal is already checked off.", 409);
    this.db.prepare("UPDATE goals SET done_on = ?, updated_at = ? WHERE id = ?").run(today, now(), id);
    return toGoal(this.row(owner, id));
  }

  /** Undo a check-off: back to the top, with the day 1 it had. */
  reopen(owner: Id, id: Id): Goal {
    const r = this.row(owner, id);
    if (!r.done_on) return toGoal(r);
    const top = this.open(owner)[0];
    this.db.prepare("UPDATE goals SET done_on = NULL, position = ?, updated_at = ? WHERE id = ?").run(top ? top.position - 1 : 0, now(), id);
    return toGoal(this.row(owner, id));
  }

  remove(owner: Id, id: Id): void {
    if (!this.db.prepare("DELETE FROM goals WHERE id = ? AND user_id = ?").run(id, owner).changes) throw new UserError(GONE, 404);
  }
}
