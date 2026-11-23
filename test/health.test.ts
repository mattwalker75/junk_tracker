/**
 * Workouts from the phone's health app (Matt, Nov 22 2026; canvas round 17): brought in as activities, each one
 * once — an edit stays, a delete never comes back — and one that starts within 30 minutes of an activity logged by
 * hand the same day is skipped as the same workout. Database version 8 adds where an activity came from.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { HealthWorkout } from "../shared/types.js";
import { scratch, type Scratch } from "./helpers.js";

let s: Scratch | undefined;
afterEach(async () => { await s?.close(); s = undefined; });

const TODAY = "2026-11-22";
const walk = (o: Partial<HealthWorkout> = {}): HealthWorkout => ({ id: "hk-walk-1", what: "Walk", day: TODAY, time: "07:05", minutes: 40, calories: 200, ...o });
const bringIn = (b: ReturnType<Scratch["browser"]>, workouts: HealthWorkout[], source = "apple-health") => b.call("POST", "/api/health/import", { source, today: TODAY, workouts });
const activities = async (b: ReturnType<Scratch["browser"]>) => (await b.call("GET", `/api/activities?from=2026-11-01&to=${TODAY}`)).body as { id: string; what: string; minutes: number; calories: number; time: string; source: string }[];

describe("bringing in workouts", () => {
  it("adds each one as an activity tagged with where it came from, and only once", async () => {
    s = await scratch();
    const b = s.browser();
    const first = await bringIn(b, [walk(), walk({ id: "hk-gym", what: "Strength training", time: "17:30", minutes: 35, calories: 140 })]);
    expect(first.status).toBe(200);
    expect(first.body.added.map((a: { what: string }) => a.what)).toEqual(["Walk", "Strength training"]);
    expect(first.body.skipped).toBe(0);
    expect((await activities(b)).map((a) => [a.what, a.time, a.minutes, a.calories, a.source])).toEqual([
      ["Strength training", "17:30", 35, 140, "apple-health"], ["Walk", "07:05", 40, 200, "apple-health"]]);
    // the next time the app opens, the same workouts are offered again: nothing new
    const again = await bringIn(b, [walk(), walk({ id: "hk-gym", what: "Strength training", time: "17:30", minutes: 35, calories: 140 })]);
    expect(again.body).toEqual({ added: [], skipped: 0 });
    expect(await activities(b)).toHaveLength(2);
  });

  it("keeps an edit, and a deleted one never comes back", async () => {
    s = await scratch();
    const b = s.browser();
    const [a] = (await bringIn(b, [walk()])).body.added;
    await b.call("PUT", `/api/activities/${a.id}`, { what: "Dog walk", minutes: 45, calories: 210, day: TODAY, time: "07:05", notes: "" });
    await bringIn(b, [walk()]);
    const after = await activities(b);
    expect(after.map((x) => [x.what, x.minutes, x.source])).toEqual([["Dog walk", 45, "apple-health"]]);
    await b.call("DELETE", `/api/activities/${a.id}`);
    expect((await bringIn(b, [walk()])).body.added).toEqual([]);
    expect(await activities(b)).toEqual([]);
  });

  it("skips one that starts within 30 minutes of an activity logged by hand that day", async () => {
    s = await scratch();
    const b = s.browser();
    await b.call("POST", "/api/activities", { what: "Morning walk", minutes: 40, calories: null, day: TODAY, time: "07:20", notes: "" });
    await b.call("POST", "/api/activities", { what: "Yoga", minutes: 20, calories: null, day: TODAY, time: "", notes: "" });
    const r = await bringIn(b, [
      walk(), // 07:05, 15 minutes from the 07:20 walk logged by hand
      walk({ id: "hk-run", what: "Run", time: "08:00" }), // 40 minutes after: a workout of its own
      walk({ id: "hk-yoga", what: "yoga", time: "21:00" }), // the hand-logged Yoga has no time: the same name is the same
    ]);
    expect(r.body.added.map((a: { what: string }) => a.what)).toEqual(["Run"]);
    expect(r.body.skipped).toBe(2);
    // skipped ones stay skipped: deleting the hand-logged walk doesn't bring the Health one in later
    const hand = (await activities(b)).find((x) => x.what === "Morning walk")!;
    await b.call("DELETE", `/api/activities/${hand.id}`);
    expect((await bringIn(b, [walk()])).body.added).toEqual([]);
  });

  it("never takes a day after the phone's today, and checks what it is sent", async () => {
    s = await scratch();
    const b = s.browser();
    expect((await bringIn(b, [walk({ day: "2026-11-23" })])).body.added).toEqual([]);
    expect((await bringIn(b, [walk({ time: "7am" })])).status).toBe(400);
    expect((await bringIn(b, [walk()], "fitbit")).body.error).toBe("Workouts come from Apple Health or Health Connect.");
  });

  it("says when workouts last came in and how many this week", async () => {
    s = await scratch();
    const b = s.browser();
    await bringIn(b, [walk(), walk({ id: "hk-old", day: "2026-11-10", time: "09:00" })]);
    const sum = (await b.call("GET", `/api/health/summary?today=${TODAY}`)).body;
    expect(sum.lastAdded).toBe(2);
    expect(typeof sum.lastAt).toBe("string");
    expect(sum.thisWeek).toBe(1); // weeks start on Sunday: Nov 22 is a Sunday, Nov 10 is two weeks back
    // the page can't set when the last import was
    expect((await b.call("PUT", "/api/me/settings", { healthLastAt: "2020-01-01T00:00:00Z" })).status).toBe(400);
    expect((await b.call("PUT", "/api/me/settings", { healthImport: true, healthSince: "2026-11-16" })).body).toMatchObject({ healthImport: true, healthSince: "2026-11-16" });
  });

  it("hits the monster like any activity", async () => {
    s = await scratch();
    const b = s.browser();
    expect((await b.call("POST", "/api/game/run", { mode: "normal", today: TODAY, now: "06:00" })).status).toBe(200);
    await bringIn(b, [walk({ time: "07:05", minutes: 40, calories: 200 })]);
    const sync = await b.call("POST", "/api/game/sync", { today: TODAY, now: "08:00" });
    const fight = sync.body.view.fight ?? null;
    // Crumbs has 100 HP: 40 minutes + 200 cal / 10 = 60 damage (or it went down already)
    expect(fight ? fight.max - fight.hp : 100).toBeGreaterThanOrEqual(60);
  });
});

describe("database version 8", () => {
  it("upgrades a version 7 log, keeping every activity as one logged by hand", async () => {
    const Database = (await import("better-sqlite3")).default;
    const { MIGRATIONS, openDatabase, SCHEMA_VERSION } = await import("../server/src/db.js");
    expect(SCHEMA_VERSION).toBe(8);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jt-v8-"));
    const file = path.join(dir, "junk.db");
    try {
      const old = new Database(file);
      for (let v = 0; v < 7; v++) old.exec(MIGRATIONS[v]);
      old.pragma("user_version = 7");
      old.exec("INSERT INTO users (id, name, password_hash, created_at) VALUES ('u1', 'Matt', '', 'x')");
      old.exec("INSERT INTO activities (id, user_id, what, minutes, calories, day, time, notes, created_at, updated_at) VALUES ('a1', 'u1', 'Walk', 30, NULL, '2026-11-20', '08:00', '', 'x', 'x')");
      old.close();
      const db = openDatabase(file);
      expect(db.prepare("SELECT what, source, source_id FROM activities").all()).toEqual([{ what: "Walk", source: "", source_id: null }]);
      expect(db.prepare("SELECT COUNT(*) AS n FROM health_imports").get()).toEqual({ n: 0 });
      db.close();
      expect(fs.existsSync(`${file}.before-v8`)).toBe(true);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("a workout from the phone's health app, as the page sends it", () => {
  it("is the phone's own day and time, in whole minutes, with sane calories", async () => {
    const { toWorkout, lookFrom } = await import("../web/src/lib/health");
    const start = new Date(2026, 10, 22, 7, 5).getTime(); // 7:05 AM on the phone
    expect(toWorkout({ id: "a", what: "Walk", startMs: start, endMs: start + 40 * 60_000 + 20_000, calories: 199.6 }))
      .toEqual({ id: "a", what: "Walk", day: "2026-11-22", time: "07:05", minutes: 40, calories: 200 });
    expect(toWorkout({ id: "b", what: "", startMs: start, endMs: start + 10_000, calories: -5 })).toMatchObject({ what: "Workout", minutes: null, calories: null });
    expect(toWorkout({ id: "c", what: "Run", startMs: start, endMs: start + 3 * 86_400_000, calories: 1e9 })).toMatchObject({ minutes: 1440, calories: 20000 });
    // the first time: from healthSince (7 days); after that, never more than 30 days back
    expect(lookFrom("2026-11-22", "2026-11-16")).toBe("2026-11-16");
    expect(lookFrom("2026-11-22", "2026-01-01")).toBe("2026-10-24");
    expect(lookFrom("2026-11-22", null)).toBe("2026-10-24");
  });
});
