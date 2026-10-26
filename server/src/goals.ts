/**
 * Goals: each person's list of things to aim for. The open goal at the top of the list is the one
 * on Home (the sticky note); checking it off moves the next one up. Every call names the owner and
 * every query filters by it, as in log.ts.
 *
 * A goal's days count from the day it reaches the top (`started_on`, the phone's day), so a goal
 * waiting further down never runs down. Every change to the list carries the page's `today` and
 * ends with `settle`, which keeps that true: the top goal gets a day 1 if it has none, and a goal
 * moved off the top starts over. Reading never writes (writes are guarded against other sites;
 * reads are not).
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
const TOO_MANY = `That is ${MAX_OPEN} goals waiting. Check some off or remove some first.`;
const GONE = "That goal no longer exists.";
/** checked-off goals sent to the page (the count is always the real one) */
const DONE_SHOWN = 100;

function day(today: unknown): Day {
  if (!realDay(today)) throw new UserError("Which day is it?");
  return today;
}

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

  /** After a change: the top goal's day 1 is today if it has none yet; the ones waiting below have none. */
  private settle(owner: Id, today: Day): void {
    this.open(owner).forEach((g, i) => {
      if (i === 0 && !g.started_on) this.db.prepare("UPDATE goals SET started_on = ? WHERE id = ?").run(today, g.id);
      if (i > 0 && g.started_on) this.db.prepare("UPDATE goals SET started_on = NULL WHERE id = ?").run(g.id);
    });
  }
  /** A change and its settle, in one transaction. */
  private change<T>(owner: Id, today: Day, fn: () => T): T {
    return this.db.transaction(() => { const out = fn(); this.settle(owner, today); return out; })();
  }

  /** Splurges from the goal's day 1 to today — or to its last day, once its time is up. */
  private splurgesSince(owner: Id, g: GoalRow | undefined, today: Day): number {
    if (!g?.started_on) return 0;
    const last = g.days ? new Date(Date.parse(g.started_on) + (g.days - 1) * 86_400_000).toISOString().slice(0, 10) : today;
    return (this.db.prepare("SELECT COUNT(*) AS n FROM splurges WHERE user_id = ? AND day BETWEEN ? AND ?").get(owner, g.started_on, last < today ? last : today) as { n: number }).n;
  }

  /** What Home needs: the goal now, the splurges since its day 1, and how many goals are open. */
  current(owner: Id, today: unknown): { goal: Goal | null; goalSplurges: number; goals: number } {
    const t = day(today);
    const open = this.open(owner);
    return { goal: open[0] ? toGoal(open[0]) : null, goalSplurges: this.splurgesSince(owner, open[0], t), goals: open.length };
  }

  list(owner: Id, today: unknown): GoalList {
    const t = day(today);
    const open = this.open(owner);
    const done = this.db.prepare(`SELECT * FROM goals WHERE user_id = ? AND done_on IS NOT NULL ORDER BY done_on DESC, updated_at DESC LIMIT ${DONE_SHOWN}`).all(owner) as GoalRow[];
    const doneCount = (this.db.prepare("SELECT COUNT(*) AS n FROM goals WHERE user_id = ? AND done_on IS NOT NULL").get(owner) as { n: number }).n;
    return { open: open.map(toGoal), done: done.map(toGoal), doneCount, goalSplurges: this.splurgesSince(owner, open[0], t) };
  }

  /** "now" puts it at the top (it becomes the goal on Home), "later" at the end of the list. */
  add(owner: Id, body: unknown): Goal {
    const v = parse(addSchema, body);
    const t = day((body as { today?: unknown } | null)?.today);
    const id = newId();
    this.change(owner, t, () => {
      const open = this.open(owner);
      if (open.length >= MAX_OPEN) throw new UserError(TOO_MANY, 409);
      const position = !open.length ? 0 : v.place === "now" ? open[0].position - 1 : open[open.length - 1].position + 1;
      const ts = now();
      this.db.prepare(`INSERT INTO goals (id, user_id, text, days, position, started_on, done_on, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)`).run(id, owner, v.text, v.days, position, ts, ts);
    });
    return toGoal(this.row(owner, id));
  }

  /** New words or a new length. Its day 1 stays: "Keep going" turns a goal whose time is up into one with no end. */
  edit(owner: Id, id: Id, body: unknown): Goal {
    const v = parse(editSchema, body);
    this.row(owner, id);
    this.db.prepare("UPDATE goals SET text = ?, days = ?, updated_at = ? WHERE id = ? AND user_id = ?").run(v.text, v.days, now(), id, owner);
    return toGoal(this.row(owner, id));
  }

  /** One place up or down the open list (up from second place makes it the goal now). */
  move(owner: Id, id: Id, body: unknown): void {
    const dir = (body as { dir?: unknown } | null)?.dir;
    if (dir !== "up" && dir !== "down") throw new UserError("Move it up or down.");
    const t = day((body as { today?: unknown }).today);
    this.change(owner, t, () => {
      const open = this.open(owner);
      const i = open.findIndex((g) => g.id === id);
      if (i < 0) throw new UserError(GONE, 404);
      const j = dir === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= open.length) return;
      [open[i], open[j]] = [open[j], open[i]];
      // number them again from 0: simple, and never two goals in the same place
      const at = this.db.prepare("UPDATE goals SET position = ? WHERE id = ?");
      open.forEach((g, k) => { if (g.position !== k) at.run(k, g.id); });
    });
  }

  /** Check it off on the person's own day. The next one moves up. */
  done(owner: Id, id: Id, today: unknown): Goal {
    const t = day(today);
    this.change(owner, t, () => {
      if (this.row(owner, id).done_on) throw new UserError("That goal is already checked off.", 409);
      this.db.prepare("UPDATE goals SET done_on = ?, updated_at = ? WHERE id = ?").run(t, now(), id);
    });
    return toGoal(this.row(owner, id));
  }

  /** Undo a check-off: back to the top, with the day 1 it had. */
  reopen(owner: Id, id: Id, today: unknown): Goal {
    const t = day(today);
    this.change(owner, t, () => {
      if (!this.row(owner, id).done_on) return;
      const open = this.open(owner);
      if (open.length >= MAX_OPEN) throw new UserError(TOO_MANY, 409);
      this.db.prepare("UPDATE goals SET done_on = NULL, position = ?, updated_at = ? WHERE id = ?").run(open[0] ? open[0].position - 1 : 0, now(), id);
    });
    return toGoal(this.row(owner, id));
  }

  remove(owner: Id, id: Id, today: unknown): void {
    const t = day(today);
    this.change(owner, t, () => {
      if (!this.db.prepare("DELETE FROM goals WHERE id = ? AND user_id = ?").run(id, owner).changes) throw new UserError(GONE, 404);
    });
  }
}
