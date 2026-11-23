/**
 * Start over (Matt, Nov 22 2026; canvas round 18): a person's log is set aside — settings kept, other people's logs
 * untouched, a copy of the database file kept first — and Undo brings it all back, keeping what was logged since.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PW, scratch, type Scratch } from "./helpers.js";

let s: Scratch | undefined;
afterEach(async () => { await s?.close(); s = undefined; });

const DAY = "2026-11-22";
type B = ReturnType<Scratch["browser"]>;
const ok = async (b: B, method: string, url: string, body?: unknown) => {
  const r = await b.call(method, url, body);
  if (r.status !== 200) throw new Error(`${method} ${url} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
};
async function someLog(b: B) {
  await ok(b, "POST", "/api/splurges", { what: "Donut", size: "snack", day: "2026-11-20" });
  await ok(b, "POST", "/api/activities", { what: "Walk", minutes: 30, calories: null, day: "2026-11-20", time: "08:00", notes: "" });
  await ok(b, "PUT", "/api/weigh-ins/2026-11-21", { weight: 190, unit: "lb" });
  await ok(b, "PUT", `/api/weigh-ins/${DAY}`, { weight: 189, unit: "lb" });
  await ok(b, "POST", "/api/goals", { text: "No soda this week", days: 7, place: "now", today: "2026-11-20" });
  await ok(b, "POST", "/api/game/run", { mode: "normal", today: "2026-11-20", now: "07:00" });
}
const counts = async (b: B) => ({
  splurges: (await ok(b, "GET", `/api/splurges?from=2026-11-01&to=${DAY}`)).map((x: { what: string }) => x.what),
  activities: (await ok(b, "GET", `/api/activities?from=2026-11-01&to=${DAY}`)).map((x: { what: string }) => x.what),
  weighIns: (await ok(b, "GET", `/api/weigh-ins?from=2026-11-01&to=${DAY}`)).map((x: { day: string; pounds: number }) => `${x.day} ${x.pounds}`),
  goals: ((await ok(b, "GET", `/api/goals?today=${DAY}`)) as { open: { text: string }[] }).open.map((g) => g.text),
  run: (await ok(b, "GET", `/api/game?today=${DAY}&now=09:00`)).run as { number: number } | null,
});

describe("start over", () => {
  it("clears your log, keeps your settings, keeps a copy of the file, and says what it holds", async () => {
    s = await scratch({}, { serverDay: () => DAY });
    const b = s.browser();
    await ok(b, "PUT", "/api/me/settings", { units: "kg", toughness: "tough" });
    await someLog(b);
    const st = await ok(b, "POST", "/api/start-over", { today: DAY });
    expect(st.held).toMatchObject({ on: DAY, counts: { splurges: 1, activities: 1, weighIns: 2, goals: 1, runs: 1, run: { number: 1, level: 1 } } });
    const c = await counts(b);
    expect([c.splurges, c.activities, c.weighIns, c.goals, c.run]).toEqual([[], [], [], [], null]);
    expect(await ok(b, "GET", "/api/me/settings")).toMatchObject({ units: "kg", toughness: "tough" });
    expect(fs.existsSync(path.join(s.dir, "data", `junk.db.before-start-over-${DAY}`))).toBe(true);
    expect(await ok(b, "GET", "/api/start-over")).toEqual(st);
  });

  it("only touches your own log on a web app with several people", async () => {
    s = await scratch({}, { serverDay: () => DAY });
    const me = s.browser();
    await ok(me, "POST", "/api/auth/enable", { name: "Matt", password: PW });
    await ok(me, "POST", "/api/users", { name: "Alex", password: PW });
    const alex = s.browser();
    await ok(alex, "POST", "/api/auth/login", { name: "Alex", password: PW });
    await ok(alex, "POST", "/api/splurges", { what: "Alex's pizza", size: "feast", day: DAY });
    await ok(me, "POST", "/api/splurges", { what: "Matt's chips", size: "snack", day: DAY });
    await ok(me, "POST", "/api/start-over", { today: DAY });
    expect((await counts(me)).splurges).toEqual([]);
    expect((await counts(alex)).splurges).toEqual(["Alex's pizza"]);
  });
});

describe("undo start over", () => {
  it("brings it all back and keeps what was logged since; the game goes back to where it was", async () => {
    s = await scratch({}, { serverDay: () => DAY });
    const b = s.browser();
    await someLog(b);
    await ok(b, "POST", "/api/start-over", { today: DAY });
    // logged since: a new splurge, a weigh-in on a day the old log had too, a new goal, a new run
    await ok(b, "POST", "/api/splurges", { what: "Cookie", size: "snack", day: DAY });
    await ok(b, "PUT", `/api/weigh-ins/${DAY}`, { weight: 186, unit: "lb" });
    await ok(b, "POST", "/api/goals", { text: "Walk every day", days: null, place: "now", today: DAY });
    await ok(b, "POST", "/api/game/run", { mode: "normal", today: DAY, now: "10:00" });
    expect((await ok(b, "POST", "/api/start-over/undo", { today: DAY })).held).toBeNull();
    const c = await counts(b);
    expect(c.splurges.sort()).toEqual(["Cookie", "Donut"]);
    expect(c.activities).toEqual(["Walk"]);
    expect(c.weighIns).toEqual(["2026-11-21 190", `${DAY} 186`]); // the same day: the newer one stays
    expect(c.goals).toEqual(["Walk every day", "No soda this week"]); // the goal set since stays the goal now; the old one is next
    expect(c.run?.number).toBe(1); // the run from before is back; the one started since is gone
    expect((await b.call("POST", "/api/start-over/undo", { today: DAY })).body.error).toBe("There is no start over to undo.");
  });

  it("only the latest start over is held: starting over again replaces it", async () => {
    s = await scratch({}, { serverDay: () => DAY });
    const b = s.browser();
    await ok(b, "POST", "/api/splurges", { what: "Donut", size: "snack", day: "2026-11-20" });
    await ok(b, "POST", "/api/start-over", { today: "2026-11-21" });
    await ok(b, "POST", "/api/splurges", { what: "Cookie", size: "snack", day: DAY });
    expect((await ok(b, "POST", "/api/start-over", { today: DAY })).held.counts.splurges).toBe(1);
    await ok(b, "POST", "/api/start-over/undo", { today: DAY });
    expect((await counts(b)).splurges).toEqual(["Cookie"]);
  });
});

describe("after a start over", () => {
  it("reminders count from that day, and Health starts again from it without the old workouts", async () => {
    s = await scratch({}, { serverDay: () => DAY });
    const b = s.browser();
    await ok(b, "PUT", "/api/me/settings", { healthImport: true, healthSince: "2026-11-01" });
    s.handle.db.prepare("UPDATE users SET created_at = '2026-01-01T00:00:00.000Z'").run(); // added long ago
    const walk = { id: "hk-1", what: "Walk", day: "2026-11-15", time: "08:00", minutes: 40, calories: 200 };
    await ok(b, "POST", "/api/health/import", { source: "apple-health", today: "2026-11-15", workouts: [walk] });
    await ok(b, "POST", "/api/start-over", { today: DAY });
    expect((await ok(b, "GET", "/api/me/settings")).healthSince).toBe(DAY);
    expect((await ok(b, "POST", "/api/health/import", { source: "apple-health", today: DAY, workouts: [walk] })).added).toEqual([]);
    // the 3-day activity reminder counts from the start over, not from the day the person was added long ago
    const due = async (d: string) => ((await ok(b, "GET", `/api/reminders?today=${d}&tz=0`)).due as { kind: string }[]).map((x) => x.kind);
    expect(await due("2026-11-24")).not.toContain("activity"); // Nov 22, 23, 24: not yet
    expect(await due("2026-11-25")).toContain("activity");
  });
});

describe("database version 9", () => {
  it("upgrades a version 8 log, keeping everything", async () => {
    const Database = (await import("better-sqlite3")).default;
    const { MIGRATIONS, openDatabase, SCHEMA_VERSION } = await import("../server/src/db.js");
    expect(SCHEMA_VERSION).toBe(9);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jt-v9-"));
    const file = path.join(dir, "junk.db");
    try {
      const old = new Database(file);
      for (let v = 0; v < 8; v++) old.exec(MIGRATIONS[v]);
      old.pragma("user_version = 8");
      old.exec("INSERT INTO users (id, name, password_hash, created_at) VALUES ('u1', 'Matt', '', 'x')");
      old.exec("INSERT INTO splurges (id, user_id, what, size, day, created_at, updated_at) VALUES ('s1', 'u1', 'Donut', 'snack', '2026-11-20', 'x', 'x')");
      old.close();
      const db = openDatabase(file);
      expect(db.prepare("SELECT what FROM splurges").all()).toEqual([{ what: "Donut" }]);
      expect(db.prepare("SELECT COUNT(*) AS n FROM set_aside").get()).toEqual({ n: 0 });
      db.close();
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
