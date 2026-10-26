import { afterEach, describe, expect, it, vi } from "vitest";
import { PW, scratch, type Scratch } from "./helpers.js";

let s: Scratch;
afterEach(async () => { await s?.close(); });

/** A browser on a fresh app. With the login off it is straight in, as the one person ("Me"). */
async function firstPerson(name = "Matt") {
  const b = s.browser();
  const me = (await b.call("GET", "/api/auth/me")).body.me;
  if (name !== "Me") expect((await b.call("PUT", `/api/users/${me.id}/name`, { name })).status).toBe(200);
  return b;
}

/** A browser on a fresh app with users and sign-in turned on, signed in as Matt. */
async function withUsers() {
  const b = s.browser();
  expect((await b.call("POST", "/api/auth/enable", { name: "Matt", password: PW })).status).toBe(200);
  return b;
}

const meal = (over: Record<string, unknown> = {}) => ({ what: "Cheeseburger & fries", size: "meal", where: "Five Guys", calories: 1320, day: "2026-10-11", time: "12:30", notes: "", ...over });

describe("first start and the login", () => {
  it("starts with no sign-in: one person, made on first open, with no password", async () => {
    s = await scratch();
    const b = s.browser();
    expect((await b.call("GET", "/api/auth/me")).body).toMatchObject({ status: "ok", loginEnabled: false, users: 1, me: { name: "Me" }, acting: null });
    expect((await b.call("GET", "/api/overview?today=2026-10-15")).status).toBe(200);
    // every browser is that one person, and no one can sign in as them
    expect((await s.browser().call("GET", "/api/auth/me")).body.me.name).toBe("Me");
    expect((await b.call("GET", "/api/users")).body).toHaveLength(1);
    expect((await b.call("POST", "/api/users", { name: "Sarah", password: PW })).body.error).toMatch(/Turn on users and sign-in first/);
    expect((await b.call("PUT", "/api/settings", { security: { loginEnabled: true } })).status).toBe(400); // only through /enable
  });

  it("turning on users and sign-in names you, sets your password and keeps your log", async () => {
    s = await scratch();
    const b = s.browser();
    await b.call("POST", "/api/splurges", { what: "Donut", size: "snack", day: "2026-10-14" });
    expect((await b.call("POST", "/api/auth/enable", { name: "Matt", password: "short" })).body.error).toMatch(/at least 8/);
    const on = await b.call("POST", "/api/auth/enable", { name: "Matt", password: PW });
    expect(on.body).toMatchObject({ status: "ok", loginEnabled: true, me: { name: "Matt" } });
    expect(JSON.parse((await import("node:fs")).readFileSync(s.handle.config.file, "utf8")).security.loginEnabled).toBe(true);
    expect((await b.call("GET", "/api/overview?today=2026-10-15")).body.last.what).toBe("Donut");
    expect((await s.browser().call("GET", "/api/auth/me")).body).toEqual({ status: "signin" });
    expect((await b.call("POST", "/api/auth/enable", { name: "Matt", password: PW })).status).toBe(409);
  });

  it("with the login on, a browser signs in, and a new password signs the old session out", async () => {
    s = await scratch();
    const first = await withUsers();
    const other = s.browser();
    expect((await other.call("GET", "/api/auth/me")).body).toEqual({ status: "signin" });
    expect((await other.call("GET", "/api/overview?today=2026-10-15")).status).toBe(401);
    expect((await other.call("POST", "/api/auth/login", { name: "matt", password: "wrong-password" })).status).toBe(401);
    expect((await other.call("POST", "/api/auth/login", { name: "matt", password: PW })).body).toMatchObject({ status: "ok", me: { name: "Matt" } });
    const me = (await first.call("GET", "/api/auth/me")).body.me.id;
    expect((await first.call("PUT", `/api/users/${me}/password`, { password: "another-password" })).status).toBe(200);
    expect((await first.call("GET", "/api/auth/me")).body.status).toBe("ok"); // the browser that changed it stays in
    expect((await other.call("GET", "/api/auth/me")).body.status).toBe("signin");
  });

  it("turning it off needs TURN OFF and only one user, then removes the password", async () => {
    s = await scratch();
    const b = await withUsers();
    const sarah = (await b.call("POST", "/api/users", { name: "Sarah", password: PW })).body;
    expect((await b.call("POST", "/api/auth/disable", {})).body.error).toMatch(/TURN OFF/);
    expect((await b.call("POST", "/api/auth/disable", { confirm: "TURN OFF" })).body.error).toMatch(/There are 2 users/);
    await b.call("DELETE", `/api/users/${sarah.id}`, { confirm: "DELETE" });
    expect((await b.call("POST", "/api/auth/disable", { confirm: "TURN OFF" })).body).toMatchObject({ status: "ok", loginEnabled: false, me: { name: "Matt" } });
    expect((await s.browser().call("GET", "/api/auth/me")).body.me.name).toBe("Matt");
    expect((await s.browser().call("POST", "/api/auth/login", { name: "Matt", password: PW })).status).toBe(409);
  });

  it("asks for a name and password when the login is on but nobody has one (config.json edited by hand)", async () => {
    s = await scratch({ security: { loginEnabled: true } });
    const b = s.browser();
    expect((await b.call("GET", "/api/auth/me")).body).toEqual({ status: "setup" });
    expect((await b.call("GET", "/api/overview?today=2026-10-15")).status).toBe(401);
    expect((await b.call("POST", "/api/auth/setup", { name: "Matt", password: PW })).body).toMatchObject({ status: "ok", me: { name: "Matt" } });
    expect((await b.call("POST", "/api/auth/setup", { name: "Again", password: PW })).status).toBe(409);
  });
});

describe("splurges", () => {
  it("need a name and a size; the rest is optional and checked", async () => {
    s = await scratch();
    const b = await firstPerson();
    expect((await b.call("POST", "/api/splurges", meal({ what: "  " }))).body.error).toBe("Say what you had.");
    expect((await b.call("POST", "/api/splurges", meal({ size: "huge" }))).body.error).toBe("Pick Snack, Meal or Feast.");
    expect((await b.call("POST", "/api/splurges", meal({ day: "2026-02-30" }))).body.error).toBe("That is not a real date.");
    expect((await b.call("POST", "/api/splurges", meal({ calories: -5 }))).body.error).toMatch(/negative/);
    const minimal = await b.call("POST", "/api/splurges", { what: "Snickers", size: "snack", day: "2026-10-07" });
    expect(minimal.body).toMatchObject({ what: "Snickers", size: "snack", where: "", calories: null, time: "", notes: "" });
    const full = (await b.call("POST", "/api/splurges", meal())).body;
    const edited = await b.call("PUT", `/api/splurges/${full.id}`, meal({ size: "feast", notes: "and a shake" }));
    expect(edited.body).toMatchObject({ size: "feast", notes: "and a shake" });
    expect((await b.call("GET", "/api/splurges?from=2026-10-01&to=2026-10-31")).body.map((x: { what: string }) => x.what)).toEqual(["Cheeseburger & fries", "Snickers"]);
    expect((await b.call("DELETE", `/api/splurges/${full.id}`)).status).toBe(200);
    expect((await b.call("DELETE", `/api/splurges/${full.id}`)).status).toBe(404);
  });

  it("the overview has the last splurge, the recent things and the settings", async () => {
    s = await scratch();
    const b = await firstPerson();
    await b.call("POST", "/api/splurges", { what: "Pizza", size: "feast", day: "2026-10-03", time: "19:30" });
    await b.call("POST", "/api/splurges", { what: "pizza", size: "feast", day: "2026-09-01" });
    await b.call("POST", "/api/splurges", meal());
    await b.call("POST", "/api/splurges", { what: "Future cake", size: "snack", day: "2026-10-20" });
    const o = (await b.call("GET", "/api/overview?today=2026-10-15")).body;
    expect(o.last.what).toBe("Cheeseburger & fries"); // not the one dated after today
    expect(o.splurges.map((x: { day: string }) => x.day)).toEqual(["2026-10-11", "2026-10-03"]); // the 40-day window
    expect(o.recent.map((x: { what: string }) => x.what)).toEqual(["Future cake", "Cheeseburger & fries", "Pizza"]); // one "pizza", newest first
    expect(o.settings).toEqual({ units: "lb", trendDays: 14, weekStart: 0, examples: { snack: "", meal: "", feast: "" } });
  });
});

describe("weigh-ins", () => {
  it("one a day: a second one replaces it; kilograms are stored as pounds", async () => {
    s = await scratch();
    const b = await firstPerson();
    expect((await b.call("PUT", "/api/weigh-ins/2026-10-15", { weight: 188.42, unit: "lb" })).body).toEqual({ day: "2026-10-15", pounds: 188.4 });
    expect((await b.call("PUT", "/api/weigh-ins/2026-10-15", { weight: 85, unit: "kg" })).body).toEqual({ day: "2026-10-15", pounds: 187.4 });
    expect((await b.call("PUT", "/api/weigh-ins/2026-10-15", { weight: 3, unit: "lb" })).body.error).toMatch(/looks wrong/);
    expect((await b.call("PUT", "/api/weigh-ins/2026-13-01", { weight: 180 })).status).toBe(400);
    expect((await b.call("GET", "/api/weigh-ins?from=2026-10-01&to=2026-10-31")).body).toEqual([{ day: "2026-10-15", pounds: 187.4 }]);
    expect((await b.call("DELETE", "/api/weigh-ins/2026-10-15")).status).toBe(200);
    expect((await b.call("DELETE", "/api/weigh-ins/2026-10-15")).status).toBe(404);
  });
});

describe("people", () => {
  it("each person's log is their own; Switch to shows another's until switching back", async () => {
    s = await scratch();
    const b = await withUsers();
    const sarah = (await b.call("POST", "/api/users", { name: "Sarah", password: PW })).body;
    expect((await b.call("POST", "/api/users", { name: "sarah", password: PW })).status).toBe(409);
    await b.call("POST", "/api/splurges", meal());
    const switched = await b.call("POST", `/api/users/${sarah.id}/switch`);
    expect(switched.body).toMatchObject({ acting: { name: "Sarah" }, me: { name: "Matt" } });
    expect((await b.call("GET", "/api/overview?today=2026-10-15")).body.last).toBeNull();
    const hers = (await b.call("POST", "/api/splurges", { what: "Donut", size: "snack", day: "2026-10-14" })).body;
    await b.call("PUT", "/api/me/settings", { units: "kg", examples: { snack: "one donut" } });
    expect((await b.call("POST", "/api/users/switch-back")).body.acting).toBeNull();
    const mine = (await b.call("GET", "/api/overview?today=2026-10-15")).body;
    expect(mine.last.what).toBe("Cheeseburger & fries");
    expect(mine.settings.units).toBe("lb");
    // one person can never change another's splurge by its id
    expect((await b.call("DELETE", `/api/splurges/${hers.id}`)).status).toBe(404);
    const list = (await b.call("GET", "/api/users")).body;
    expect(list.map((u: { name: string; isYou: boolean }) => [u.name, u.isYou])).toEqual([["Matt", true], ["Sarah", false]]);
  });

  it("removing someone needs DELETE, never yourself, and takes their log with them", async () => {
    s = await scratch();
    const b = await withUsers();
    const me = (await b.call("GET", "/api/auth/me")).body.me.id;
    const sarah = (await b.call("POST", "/api/users", { name: "Sarah", password: PW })).body;
    await b.call("POST", `/api/users/${sarah.id}/switch`);
    await b.call("POST", "/api/splurges", { what: "Donut", size: "snack", day: "2026-10-14" });
    expect((await b.call("DELETE", `/api/users/${sarah.id}`, {})).body.error).toMatch(/Type DELETE/);
    expect((await b.call("DELETE", `/api/users/${me}`, { confirm: "DELETE" })).status).toBe(409);
    expect((await b.call("DELETE", `/api/users/${sarah.id}`, { confirm: "DELETE" })).status).toBe(200);
    expect((await b.call("GET", "/api/auth/me")).body.acting).toBeNull();
    expect((s.handle.db.prepare("SELECT COUNT(*) AS n FROM splurges").get() as { n: number }).n).toBe(0);
  });
});

describe("settings and guards", () => {
  it("app settings are checked, saved to config.json, and say what needs a restart", async () => {
    s = await scratch();
    const b = await firstPerson();
    expect((await b.call("PUT", "/api/settings", { server: { extraHosts: ["https://mini.ts.net:8420"] } })).body.error).toMatch(/plain host names/);
    expect((await b.call("PUT", "/api/settings", { database: { path: "/etc/x" } })).status).toBe(400); // not changeable from the page
    const r = await b.call("PUT", "/api/settings", { server: { allowNetwork: true, extraHosts: ["Mini.Tail1234.ts.net"] }, appearance: { theme: "dark" } });
    expect(r.body.restartRequired).toEqual(["server.allowNetwork"]);
    expect(r.body.config.server.extraHosts).toEqual(["mini.tail1234.ts.net"]);
    expect((await b.call("PUT", "/api/me/settings", { trendDays: 10 })).status).toBe(400);
  });

  it("refuses an unknown host name and a change from another site", async () => {
    s = await scratch({ server: { extraHosts: ["mini.tail1234.ts.net"] } });
    const b = await firstPerson();
    expect((await b.call("GET", "/api/health", undefined, { host: "evil.example.com" })).status).toBe(421);
    expect((await b.call("GET", "/api/health", undefined, { host: "mini.tail1234.ts.net" })).status).toBe(200);
    expect((await b.call("POST", "/api/splurges", meal(), { origin: "http://evil.example.com" })).status).toBe(403);
    expect((await b.call("POST", "/api/splurges", meal(), { "sec-fetch-site": "cross-site" })).status).toBe(403);
  });
});

describe("review fixes (Oct 16 2026)", () => {
  it("a body that is too big is refused with 413, not a server error", async () => {
    s = await scratch();
    const b = await firstPerson();
    expect((await b.call("POST", "/api/splurges", { what: "x".repeat(300_000), size: "snack", day: "2026-10-14" })).status).toBe(413);
  });

  it("with sign-in off nobody can be given a password", async () => {
    s = await scratch();
    const b = s.browser();
    const me = (await b.call("GET", "/api/auth/me")).body.me.id;
    expect((await b.call("PUT", `/api/users/${me}/password`, { password: PW })).status).toBe(409);
  });

  it("adding the same name twice at once gives one user and a plain refusal, never a server error", async () => {
    s = await scratch();
    const b = await withUsers();
    const r = await Promise.all(["Zed", "zed", "ZED", "Zed"].map((name) => b.call("POST", "/api/users", { name, password: PW })));
    expect(r.map((x) => x.status).sort()).toEqual([200, 409, 409, 409]);
  });

  it("two 'turn on' requests at once: only the first sets the password", async () => {
    s = await scratch();
    const a = s.browser(), c = s.browser();
    await a.call("GET", "/api/auth/me"); await c.call("GET", "/api/auth/me");
    const r = await Promise.all([a.call("POST", "/api/auth/enable", { name: "Matt", password: PW }), c.call("POST", "/api/auth/enable", { name: "Other", password: "other-password" })]);
    // the other is refused: 409 if it got past the sign-in check before sign-in came on, else 401 (sign in first)
    const [ok, refused] = [...r].sort((x, y) => x.status - y.status);
    expect(ok.status).toBe(200);
    expect([401, 409]).toContain(refused.status);
    const users = s.handle.db.prepare("SELECT name FROM users").all() as { name: string }[];
    expect(users).toEqual([{ name: ok.body.me.name }]);
  });

  it("the server ends a sign-in after security.sessionDays, even if the cookie is kept", async () => {
    s = await scratch();
    const b = await withUsers();
    s.handle.config.update({ security: { sessionDays: 1 } });
    const real = Date.now();
    const spy = vi.spyOn(Date, "now").mockReturnValue(real + 2 * 86_400_000);
    try { expect((await b.call("GET", "/api/auth/me")).body).toEqual({ status: "signin" }); }
    finally { spy.mockRestore(); }
  });

  it("Home still knows the last weigh-in when it is older than the trend window", async () => {
    s = await scratch();
    const b = await firstPerson();
    await b.call("PUT", "/api/weigh-ins/2026-08-01", { weight: 190, unit: "lb" });
    expect((await b.call("GET", "/api/overview?today=2026-10-15")).body.weighIns).toEqual([{ day: "2026-08-01", pounds: 190 }]);
  });

  it("a config.json that is not an object is refused with a clear message", async () => {
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const { Config } = await import("../server/src/config.js");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jt-cfg-"));
    fs.writeFileSync(path.join(dir, "config.json"), "null");
    try { expect(() => new Config(path.join(dir, "config.json"))).toThrow(/must hold settings/); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("goals (Oct 26 2026)", () => {
  const texts = (l: { text: string }[]) => l.map((g) => g.text);

  it("the first open goal is the goal now; 'now' goes on top, 'later' at the end", async () => {
    s = await scratch();
    const b = await firstPerson();
    expect((await b.call("POST", "/api/goals", { text: "  " })).body.error).toBe("Say what your goal is.");
    expect((await b.call("POST", "/api/goals", { text: "x", days: 10 })).body.error).toMatch(/Pick how long/);
    await b.call("POST", "/api/goals", { text: "No fast food in November", days: 30 });
    await b.call("POST", "/api/goals", { text: "Get under 185 lb", place: "later" });
    await b.call("POST", "/api/goals", { text: "Eat extra clean for the next 2 weeks", days: 14, place: "now" });
    const l = (await b.call("GET", "/api/goals?today=2026-10-21")).body;
    expect(texts(l.open)).toEqual(["Eat extra clean for the next 2 weeks", "No fast food in November", "Get under 185 lb"]);
    // only the goal now has a day 1 (the day it was first seen at the top); the others wait
    expect(l.open.map((g: { startedOn: string | null }) => g.startedOn)).toEqual(["2026-10-21", null, null]);
    expect((await b.call("GET", "/api/goals?today=2026-10-26")).body.open[0].startedOn).toBe("2026-10-21");
    const o = (await b.call("GET", "/api/overview?today=2026-10-26")).body;
    expect(o).toMatchObject({ goal: { text: "Eat extra clean for the next 2 weeks", days: 14 }, goals: 3, goalSplurges: 0 });
  });

  it("checking off moves the next one up with a fresh day 1; undo puts it back as it was", async () => {
    s = await scratch();
    const b = await firstPerson();
    const a = (await b.call("POST", "/api/goals", { text: "First", days: 7 })).body;
    await b.call("POST", "/api/goals", { text: "Second" });
    await b.call("GET", "/api/goals?today=2026-10-01");
    expect((await b.call("POST", `/api/goals/${a.id}/done`, { today: "2026-10-08" })).body.doneOn).toBe("2026-10-08");
    expect((await b.call("POST", `/api/goals/${a.id}/done`, { today: "2026-10-08" })).status).toBe(409);
    let l = (await b.call("GET", "/api/goals?today=2026-10-08")).body;
    expect(l.open.map((g: { text: string; startedOn: string }) => [g.text, g.startedOn])).toEqual([["Second", "2026-10-08"]]);
    expect(texts(l.done)).toEqual(["First"]);
    await b.call("POST", `/api/goals/${a.id}/reopen`);
    l = (await b.call("GET", "/api/goals?today=2026-10-08")).body;
    expect(l.open.map((g: { text: string; startedOn: string | null }) => [g.text, g.startedOn])).toEqual([["First", "2026-10-01"], ["Second", null]]);
    expect(l.done).toEqual([]);
  });

  it("moves up and down, edits, removes; a goal moved off the top starts over", async () => {
    s = await scratch();
    const b = await firstPerson();
    const a = (await b.call("POST", "/api/goals", { text: "A" })).body;
    const c = (await b.call("POST", "/api/goals", { text: "C" })).body;
    await b.call("GET", "/api/goals?today=2026-10-01");
    await b.call("POST", `/api/goals/${c.id}/move`, { dir: "up" });
    expect((await b.call("POST", `/api/goals/${c.id}/move`, { dir: "sideways" })).status).toBe(400);
    await b.call("POST", `/api/goals/${c.id}/move`, { dir: "up" }); // already at the top: nothing happens
    let l = (await b.call("GET", "/api/goals?today=2026-10-05")).body;
    expect(l.open.map((g: { text: string; startedOn: string | null }) => [g.text, g.startedOn])).toEqual([["C", "2026-10-05"], ["A", null]]);
    expect((await b.call("PUT", `/api/goals/${a.id}`, { text: "A, better", days: 14 })).body).toMatchObject({ text: "A, better", days: 14 });
    expect((await b.call("DELETE", `/api/goals/${c.id}`)).status).toBe(200);
    expect((await b.call("DELETE", `/api/goals/${c.id}`)).status).toBe(404);
    l = (await b.call("GET", "/api/goals?today=2026-10-06")).body;
    expect(l.open.map((g: { text: string; startedOn: string | null }) => [g.text, g.startedOn])).toEqual([["A, better", "2026-10-06"]]);
  });

  it("counts the splurges since day 1, up to the last day once the time is up", async () => {
    s = await scratch();
    const b = await firstPerson();
    await b.call("POST", "/api/goals", { text: "Clean week", days: 7 });
    await b.call("GET", "/api/goals?today=2026-10-01");
    for (const day of ["2026-09-30", "2026-10-02", "2026-10-07", "2026-10-08"]) await b.call("POST", "/api/splurges", { what: "Donut", size: "snack", day });
    expect((await b.call("GET", "/api/overview?today=2026-10-04")).body.goalSplurges).toBe(1);
    expect((await b.call("GET", "/api/overview?today=2026-10-12")).body.goalSplurges).toBe(2); // Oct 1–7 only
  });

  it("each person has their own goals, even after Switch to", async () => {
    s = await scratch();
    const b = await withUsers();
    const sarah = (await b.call("POST", "/api/users", { name: "Sarah", password: PW })).body;
    const mine = (await b.call("POST", "/api/goals", { text: "Mine" })).body;
    await b.call("POST", `/api/users/${sarah.id}/switch`);
    expect((await b.call("GET", "/api/goals?today=2026-10-01")).body.open).toEqual([]);
    expect((await b.call("POST", `/api/goals/${mine.id}/done`, { today: "2026-10-01" })).status).toBe(404);
    await b.call("POST", "/api/goals", { text: "Hers" });
    await b.call("POST", "/api/users/switch-back");
    expect(texts((await b.call("GET", "/api/goals?today=2026-10-01")).body.open)).toEqual(["Mine"]);
  });

  it("upgrading a database with data in it keeps a copy of it first", async () => {
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const Database = (await import("better-sqlite3")).default;
    const { openDatabase, SCHEMA_VERSION } = await import("../server/src/db.js");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jt-up-"));
    const file = path.join(dir, "junk.db");
    try {
      // a version 1 file, as the first release left it, with one person in it
      const old = new Database(file);
      old.exec("CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, settings_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, last_used_at TEXT); CREATE TABLE splurges (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, what TEXT NOT NULL, size TEXT NOT NULL, place TEXT NOT NULL DEFAULT '', calories INTEGER, day TEXT NOT NULL, time TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE weigh_ins (user_id TEXT NOT NULL, day TEXT NOT NULL, pounds REAL NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, day)); PRAGMA user_version = 1;");
      old.prepare("INSERT INTO users VALUES ('u1', 'Matt', '', '{}', 'now', NULL)").run();
      old.close();
      const db = openDatabase(file);
      expect(db.pragma("user_version", { simple: true })).toBe(SCHEMA_VERSION);
      expect((db.prepare("SELECT name FROM users").get() as { name: string }).name).toBe("Matt");
      db.close();
      const copy = new Database(`${file}.before-v${SCHEMA_VERSION}`, { readonly: true });
      expect(copy.pragma("user_version", { simple: true })).toBe(1);
      expect((copy.prepare("SELECT name FROM users").get() as { name: string }).name).toBe("Matt");
      copy.close();
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
