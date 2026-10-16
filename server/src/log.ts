/**
 * The rules over a person's log: splurges and weigh-ins. Every call names the owner, and every
 * query filters by it — one person never reads or changes another's rows (except after "Switch
 * to", which changes the owner a request works on, in users.ts).
 *
 * Days are calendar days as the person lives them ("2026-10-15"), sent by the page, so the server
 * never has to guess a time zone.
 */
import type Database from "better-sqlite3";
import { z } from "zod";
import { SIZES, type Day, type Id, type Overview, type Splurge, type SplurgeInput, type WeighIn } from "../../shared/types.js";
import type { Users } from "./users.js";
import { newId, now, realDay, UserError } from "./util.js";

interface SplurgeRow { id: Id; user_id: Id; what: string; size: Splurge["size"]; place: string; calories: number | null; day: Day; time: string; notes: string; created_at: string; updated_at: string }

const toSplurge = (r: SplurgeRow): Splurge => ({ id: r.id, what: r.what, size: r.size, where: r.place, calories: r.calories, day: r.day, time: r.time, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at });

const day = z.string().refine(realDay, "That is not a real date.");
const splurgeSchema = z.object({
  what: z.string().trim().min(1, "Say what you had.").max(120, "Keep what you had under 120 characters."),
  size: z.enum(SIZES as [string, ...string[]], { error: "Pick Snack, Meal or Feast." }),
  where: z.string().trim().max(80, "Keep the place under 80 characters.").default(""),
  calories: z.union([z.number().int("Calories are a whole number.").min(0, "Calories cannot be negative.").max(50000, "That is a lot of calories — check the number."), z.null()]).default(null),
  day,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "The time looks wrong.").or(z.literal("")).default(""),
  notes: z.string().max(2000, "Keep the notes under 2,000 characters.").default(""),
});

export const KG = 0.45359237;

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw new UserError(r.error.issues[0]?.message || "Something in that is not right.");
  return r.data;
}

const shift = (d: Day, days: number): Day => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + days)).toISOString().slice(0, 10);
};

export class Log {
  constructor(private readonly db: Database.Database, private readonly users: Users) {}

  // ---------------------------------------------------------------- splurges
  addSplurge(owner: Id, body: unknown): Splurge {
    const v = parse(splurgeSchema, body) as SplurgeInput;
    const t = now();
    const row: SplurgeRow = { id: newId(), user_id: owner, what: v.what, size: v.size, place: v.where, calories: v.calories, day: v.day, time: v.time, notes: v.notes.trim(), created_at: t, updated_at: t };
    this.db.prepare(`INSERT INTO splurges (id, user_id, what, size, place, calories, day, time, notes, created_at, updated_at)
      VALUES (@id, @user_id, @what, @size, @place, @calories, @day, @time, @notes, @created_at, @updated_at)`).run(row);
    return toSplurge(row);
  }

  updateSplurge(owner: Id, id: Id, body: unknown): Splurge {
    const v = parse(splurgeSchema, body) as SplurgeInput;
    const r = this.db.prepare(`UPDATE splurges SET what = ?, size = ?, place = ?, calories = ?, day = ?, time = ?, notes = ?, updated_at = ?
      WHERE id = ? AND user_id = ?`).run(v.what, v.size, v.where, v.calories, v.day, v.time, v.notes.trim(), now(), id, owner);
    if (!r.changes) throw new UserError("That splurge no longer exists.", 404);
    return toSplurge(this.db.prepare("SELECT * FROM splurges WHERE id = ?").get(id) as SplurgeRow);
  }

  deleteSplurge(owner: Id, id: Id): void {
    if (!this.db.prepare("DELETE FROM splurges WHERE id = ? AND user_id = ?").run(id, owner).changes) throw new UserError("That splurge no longer exists.", 404);
  }

  splurgesBetween(owner: Id, from: Day, to: Day): Splurge[] {
    if (!realDay(from) || !realDay(to)) throw new UserError("Which days?");
    return (this.db.prepare("SELECT * FROM splurges WHERE user_id = ? AND day BETWEEN ? AND ? ORDER BY day DESC, time DESC, created_at DESC").all(owner, from, to) as SplurgeRow[]).map(toSplurge);
  }

  // ---------------------------------------------------------------- weigh-ins (one a day; a second one replaces it)
  setWeighIn(owner: Id, d: unknown, body: unknown): WeighIn {
    if (!realDay(d)) throw new UserError("That is not a real date.");
    const b = parse(z.object({ weight: z.number({ error: "Type your weight." }).positive("Type your weight."), unit: z.enum(["lb", "kg"]).default("lb") }), body);
    const pounds = Math.round((b.unit === "kg" ? b.weight / KG : b.weight) * 10) / 10;
    if (pounds < 40 || pounds > 1000) throw new UserError("That weight looks wrong — check the number and the unit.");
    const t = now();
    this.db.prepare(`INSERT INTO weigh_ins (user_id, day, pounds, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (user_id, day) DO UPDATE SET pounds = excluded.pounds, updated_at = excluded.updated_at`).run(owner, d, pounds, t, t);
    return { day: d, pounds };
  }

  deleteWeighIn(owner: Id, d: unknown): void {
    if (!realDay(d)) throw new UserError("That is not a real date.");
    if (!this.db.prepare("DELETE FROM weigh_ins WHERE user_id = ? AND day = ?").run(owner, d).changes) throw new UserError("There is no weigh-in on that day.", 404);
  }

  weighInsBetween(owner: Id, from: Day, to: Day): WeighIn[] {
    if (!realDay(from) || !realDay(to)) throw new UserError("Which days?");
    return this.db.prepare("SELECT day, pounds FROM weigh_ins WHERE user_id = ? AND day BETWEEN ? AND ? ORDER BY day").all(owner, from, to) as WeighIn[];
  }

  // ---------------------------------------------------------------- what the home screen needs, in one call
  overview(owner: Id, today: unknown): Overview {
    if (!realDay(today)) throw new UserError("Which day is it?");
    const settings = this.users.settings(owner);
    const last = this.db.prepare("SELECT * FROM splurges WHERE user_id = ? AND day <= ? ORDER BY day DESC, time DESC, created_at DESC LIMIT 1").get(owner, today) as SplurgeRow | undefined;
    // enough for the 14-day strip, this week and the last 30 days
    const splurges = this.splurgesBetween(owner, shift(today, -40), today);
    // the trend period, the one before it (for the reading at its start) and the 7-day average
    const weighIns = this.weighInsBetween(owner, shift(today, -(settings.trendDays * 2 + 7)), today);
    const recent = (this.db.prepare(`SELECT what, size, place, calories FROM splurges WHERE user_id = ?
      GROUP BY lower(what) ORDER BY MAX(day || ' ' || time || ' ' || created_at) DESC LIMIT 6`).all(owner) as { what: string; size: Splurge["size"]; place: string; calories: number | null }[])
      .map((r) => ({ what: r.what, size: r.size, where: r.place, calories: r.calories }));
    return { last: last ? toSplurge(last) : null, splurges, weighIns, recent, settings };
  }
}
