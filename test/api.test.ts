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
    expect((await b.call("POST", "/api/splurges", meal({ calories: 12.5 }))).body.error).toBe("Calories are a whole number."); // was "Invalid input"
    const minimal = await b.call("POST", "/api/splurges", { what: "Snickers", size: "snack", day: "2026-10-07" });
    expect(minimal.body).toMatchObject({ what: "Snickers", size: "snack", where: "", calories: null, time: "", notes: "" });
    const full = (await b.call("POST", "/api/splurges", meal())).body;
    const edited = await b.call("PUT", `/api/splurges/${full.id}`, meal({ size: "feast", notes: "and a shake" }));
    expect(edited.body).toMatchObject({ size: "feast", notes: "and a shake" });
    // the time is optional (Matt, Nov 11 2026): it can be set, cleared again, and a wrong one is refused
    expect((await b.call("POST", "/api/splurges", meal({ time: "25:00" }))).body.error).toBe("The time looks wrong.");
    expect((await b.call("PUT", `/api/splurges/${full.id}`, meal({ size: "feast", notes: "and a shake", time: "" }))).body.time).toBe("");
    expect((await b.call("PUT", `/api/splurges/${full.id}`, meal({ size: "feast", notes: "and a shake", time: "21:40" }))).body.time).toBe("21:40");
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
    expect(o.settings).toEqual({ units: "lb", trendDays: 14, weekStart: 0, examples: { snack: "", meal: "", feast: "" }, quickPicks: ["", "", "", "", "", ""], openIn: "tracker", autoStart: false });
  });
});

const walk = (over: Record<string, unknown> = {}) => ({ what: "Walk", minutes: 45, calories: 210, day: "2026-11-09", time: "06:10", notes: "", ...over });

describe("activities (Nov 9 2026)", () => {
  it("need only a name; how long and calories are optional whole numbers, all checked", async () => {
    s = await scratch();
    const b = await firstPerson();
    expect((await b.call("POST", "/api/activities", walk({ what: "  " }))).body.error).toBe("Say what you did.");
    expect((await b.call("POST", "/api/activities", walk({ what: undefined }))).body.error).toBe("Say what you did.");
    expect((await b.call("POST", "/api/activities", walk({ minutes: 4.5 }))).body.error).toBe("How long is a whole number of minutes.");
    expect((await b.call("POST", "/api/activities", walk({ minutes: 0 }))).body.error).toMatch(/at least 1 minute/);
    expect((await b.call("POST", "/api/activities", walk({ minutes: 2000 }))).body.error).toMatch(/1,440 minutes/);
    expect((await b.call("POST", "/api/activities", walk({ minutes: "45" }))).body.error).toBe("How long is a whole number of minutes.");
    expect((await b.call("POST", "/api/activities", walk({ calories: 12.5 }))).body.error).toBe("Calories burned are a whole number.");
    expect((await b.call("POST", "/api/activities", walk({ calories: -1 }))).body.error).toMatch(/negative/);
    expect((await b.call("POST", "/api/activities", walk({ day: "2026-02-30" }))).body.error).toBe("That is not a real date.");
    expect((await b.call("POST", "/api/activities", walk({ time: "25:00" }))).body.error).toBe("The time looks wrong.");
    expect((await b.call("POST", "/api/activities", walk({ what: "x".repeat(121) }))).body.error).toMatch(/under 120/);
    const minimal = await b.call("POST", "/api/activities", { what: "Yoga", day: "2026-11-08" });
    expect(minimal.status).toBe(200);
    expect(minimal.body).toMatchObject({ what: "Yoga", minutes: null, calories: null, time: "", notes: "" });
    const full = (await b.call("POST", "/api/activities", walk({ notes: "  around the lake  " }))).body;
    expect(full).toMatchObject({ what: "Walk", minutes: 45, calories: 210, day: "2026-11-09", time: "06:10", notes: "around the lake" });
    const edited = await b.call("PUT", `/api/activities/${full.id}`, walk({ what: "Long walk", minutes: 70, calories: null }));
    expect(edited.body).toMatchObject({ what: "Long walk", minutes: 70, calories: null });
    expect((await b.call("PUT", `/api/activities/${full.id}`, walk({ minutes: -3 }))).status).toBe(400);
    expect((await b.call("GET", "/api/activities?from=2026-11-01&to=2026-11-30")).body.map((x: { what: string }) => x.what)).toEqual(["Long walk", "Yoga"]);
    expect((await b.call("GET", "/api/activities?from=nope&to=2026-11-30")).status).toBe(400);
    expect((await b.call("DELETE", `/api/activities/${full.id}`)).status).toBe(200);
    expect((await b.call("DELETE", `/api/activities/${full.id}`)).status).toBe(404);
    expect((await b.call("PUT", `/api/activities/${full.id}`, walk())).body.error).toBe("That activity no longer exists.");
    // activities never count as splurges
    expect((await b.call("GET", "/api/overview?today=2026-11-09")).body.last).toBeNull();
  });

  it("the overview has this window's activities, the last one, and the recent different ones", async () => {
    s = await scratch();
    const b = await firstPerson();
    await b.call("POST", "/api/activities", walk({ day: "2026-11-03", minutes: 30 }));
    await b.call("POST", "/api/activities", walk({ what: "walk", day: "2026-11-07", minutes: 45, calories: null }));
    await b.call("POST", "/api/activities", { what: "Swim", minutes: 40, day: "2026-11-08", time: "18:00" });
    await b.call("POST", "/api/activities", { what: "Old hike", day: "2026-08-01" });
    await b.call("POST", "/api/activities", { what: "Tomorrow's run", day: "2026-11-10" });
    const o = (await b.call("GET", "/api/overview?today=2026-11-09")).body;
    expect(o.activities.map((a: { what: string }) => a.what)).toEqual(["Swim", "walk", "Walk"]); // the 40-day window, newest first, not tomorrow
    expect(o.lastActivity.what).toBe("Swim"); // not the one dated after today
    // one "walk" (the latest one's minutes), newest first
    expect(o.recentActivities).toEqual([
      { what: "Tomorrow's run", minutes: null, calories: null },
      { what: "Swim", minutes: 40, calories: null },
      { what: "walk", minutes: 45, calories: null },
      { what: "Old hike", minutes: null, calories: null },
    ]);
  });

  it("any number of activities a day (Matt, Nov 9 2026): all listed, the day counted once, every minute and calorie added", async () => {
    s = await scratch();
    const b = await firstPerson();
    await b.call("POST", "/api/activities", walk({ time: "06:10" }));
    await b.call("POST", "/api/activities", { what: "Gym", minutes: 60, calories: 400, day: "2026-11-09", time: "18:00" });
    await b.call("POST", "/api/activities", { what: "Walk", minutes: 20, day: "2026-11-09", time: "12:00" }); // the same thing twice is fine too
    await b.call("POST", "/api/activities", { what: "Swim", minutes: 30, calories: 300, day: "2026-11-08" });
    // the day sheet's list: all three, latest time first (the sheet sorts them by time)
    const day = (await b.call("GET", "/api/activities?from=2026-11-09&to=2026-11-09")).body;
    expect(day.map((a: { what: string; time: string }) => `${a.what} ${a.time}`)).toEqual(["Gym 18:00", "Walk 12:00", "Walk 06:10"]);
    const o = (await b.call("GET", "/api/overview?today=2026-11-09")).body;
    expect(o.activities).toHaveLength(4);
    expect(o.lastActivity.what).toBe("Gym");
    const { activeWeek, activeDays } = await import("../web/src/lib/stats.js");
    const w = activeWeek(o.activities, "2026-11-09", 0);
    expect([w.days, w.count, w.minutes, w.calories]).toEqual([2, 4, 45 + 60 + 20 + 30, 210 + 400 + 300]);
    // one mark per active day on the strip and the calendar
    expect([...activeDays(o.activities)].sort()).toEqual(["2026-11-08", "2026-11-09"]);
  });

  it("each person's activities are their own, even after Switch to; removing someone takes theirs", async () => {
    s = await scratch();
    const b = await withUsers();
    const sarah = (await b.call("POST", "/api/users", { name: "Sarah", password: PW })).body;
    const mine = (await b.call("POST", "/api/activities", walk())).body;
    await b.call("POST", `/api/users/${sarah.id}/switch`);
    const o = (await b.call("GET", "/api/overview?today=2026-11-09")).body;
    expect([o.activities, o.lastActivity, o.recentActivities]).toEqual([[], null, []]);
    expect((await b.call("PUT", `/api/activities/${mine.id}`, walk({ what: "Hacked" }))).status).toBe(404);
    expect((await b.call("DELETE", `/api/activities/${mine.id}`)).status).toBe(404);
    await b.call("POST", "/api/activities", { what: "Pilates", day: "2026-11-09" });
    await b.call("PUT", "/api/me/settings", { quickPicks: ["Pilates"] });
    await b.call("POST", "/api/users/switch-back");
    const back = (await b.call("GET", "/api/overview?today=2026-11-09")).body;
    expect(back.activities.map((a: { what: string }) => a.what)).toEqual(["Walk"]);
    expect(back.settings.quickPicks[0]).toBe("");
    await b.call("DELETE", `/api/users/${sarah.id}`, { confirm: "DELETE" });
    expect((s.handle.db.prepare("SELECT COUNT(*) AS n FROM activities").get() as { n: number }).n).toBe(1);
  });

  it("the six quick picks are each person's own, always six, trimmed and checked", async () => {
    s = await scratch();
    const b = await firstPerson();
    // where the app opens (Nov 12 2026): the tracker by default, game mode when chosen, nothing else
    expect((await b.call("PUT", "/api/me/settings", { openIn: "game" })).body.openIn).toBe("game");
    expect((await b.call("PUT", "/api/me/settings", { openIn: "map" })).body.error).toBe("Open in the tracker or in game mode.");
    expect((await b.call("PUT", "/api/me/settings", { openIn: "tracker" })).body.openIn).toBe("tracker");
    const set = await b.call("PUT", "/api/me/settings", { quickPicks: ["  Hike ", "", "Peloton"] });
    expect(set.body.quickPicks).toEqual(["Hike", "", "Peloton", "", "", ""]);
    // the page sends all six; an empty box goes back to the default
    expect((await b.call("PUT", "/api/me/settings", { quickPicks: ["Hike", "Tennis", "", "", "", "Dance"] })).body.quickPicks).toEqual(["Hike", "Tennis", "", "", "", "Dance"]);
    expect((await b.call("PUT", "/api/me/settings", { quickPicks: ["x".repeat(41)] })).body.error).toMatch(/under 40 characters/);
    expect((await b.call("PUT", "/api/me/settings", { quickPicks: ["a", "b", "c", "d", "e", "f", "g"] })).body.error).toBe("There are six quick picks.");
    expect((await b.call("PUT", "/api/me/settings", { quickPicks: "Walk" })).status).toBe(400);
    // the other settings are left alone
    await b.call("PUT", "/api/me/settings", { units: "kg" });
    expect((await b.call("GET", "/api/me/settings")).body).toMatchObject({ units: "kg", quickPicks: ["Hike", "Tennis", "", "", "", "Dance"] });
    const { quickPickNames } = await import("../shared/types.js");
    expect(quickPickNames(["Hike", "Tennis", "", " ", "", "Dance"])).toEqual(["Hike", "Tennis", "Bike", "Gym", "Swim", "Dance"]);
    expect(quickPickNames(undefined)).toEqual(["Walk", "Run", "Bike", "Gym", "Swim", "Yoga"]);
  });

  it("upgrading a version 2 database adds activity and keeps everything in it", async () => {
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const Database = (await import("better-sqlite3")).default;
    const { MIGRATIONS, openDatabase, SCHEMA_VERSION } = await import("../server/src/db.js");
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(3);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jt-up3-"));
    const file = path.join(dir, "junk.db");
    try {
      // a version 2 file, as the goals release left it, with a person, a splurge, a weigh-in and a goal
      const old = new Database(file);
      old.exec(MIGRATIONS[0]); old.exec(MIGRATIONS[1]); old.pragma("user_version = 2");
      old.prepare("INSERT INTO users VALUES ('u1', 'Matt', '', '{\"units\":\"kg\",\"examples\":{\"snack\":\"two cookies\"}}', 'now', NULL)").run();
      old.prepare("INSERT INTO splurges VALUES ('s1', 'u1', 'Pizza', 'feast', 'Dominos', 2400, '2026-11-01', '19:30', 'with friends', 'x', 'x')").run();
      old.prepare("INSERT INTO weigh_ins VALUES ('u1', '2026-11-02', 188.4, 'x', 'x')").run();
      old.prepare("INSERT INTO goals VALUES ('g1', 'u1', 'Eat clean', 14, 1, '2026-11-01', NULL, 'x', 'x')").run();
      old.close();
      const db = openDatabase(file);
      expect(db.pragma("user_version", { simple: true })).toBe(SCHEMA_VERSION);
      expect(db.prepare("SELECT what, size, place, calories, day, time, notes FROM splurges").all()).toEqual([{ what: "Pizza", size: "feast", place: "Dominos", calories: 2400, day: "2026-11-01", time: "19:30", notes: "with friends" }]);
      expect(db.prepare("SELECT day, pounds FROM weigh_ins").all()).toEqual([{ day: "2026-11-02", pounds: 188.4 }]);
      expect(db.prepare("SELECT text, started_on FROM goals").all()).toEqual([{ text: "Eat clean", started_on: "2026-11-01" }]);
      expect(db.prepare("SELECT COUNT(*) AS n FROM activities").get()).toEqual({ n: 0 });
      db.close();
      const copy = new Database(`${file}.before-v${SCHEMA_VERSION}`, { readonly: true });
      expect(copy.pragma("user_version", { simple: true })).toBe(2);
      expect((copy.prepare("SELECT COUNT(*) AS n FROM splurges").get() as { n: number }).n).toBe(1);
      copy.close();
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    // and through the app: the old settings still read, with six empty quick picks added
    s = await scratch();
    const b = await firstPerson();
    expect((await b.call("GET", "/api/me/settings")).body.quickPicks).toEqual(["", "", "", "", "", ""]);
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
  const days1 = (l: { text: string; startedOn: string | null }[]) => l.map((g) => [g.text, g.startedOn]);

  it("the first open goal is the goal now; 'now' goes on top, 'later' at the end", async () => {
    s = await scratch();
    const b = await firstPerson();
    expect((await b.call("POST", "/api/goals", { text: "  ", today: "2026-10-21" })).body.error).toBe("Say what your goal is.");
    expect((await b.call("POST", "/api/goals", { text: "x", days: 10, today: "2026-10-21" })).body.error).toMatch(/Pick how long/);
    expect((await b.call("POST", "/api/goals", { text: "x" })).body.error).toBe("Which day is it?");
    await b.call("POST", "/api/goals", { text: "No fast food in November", days: 30, today: "2026-10-20" });
    await b.call("POST", "/api/goals", { text: "Get under 185 lb", place: "later", today: "2026-10-20" });
    await b.call("POST", "/api/goals", { text: "Eat extra clean for the next 2 weeks", days: 14, place: "now", today: "2026-10-21" });
    const l = (await b.call("GET", "/api/goals?today=2026-10-26")).body;
    // only the goal now has a day 1 (the day it reached the top); the one it pushed down starts over
    expect(days1(l.open)).toEqual([["Eat extra clean for the next 2 weeks", "2026-10-21"], ["No fast food in November", null], ["Get under 185 lb", null]]);
    expect(l).toMatchObject({ done: [], doneCount: 0, goalSplurges: 0 });
    const o = (await b.call("GET", "/api/overview?today=2026-10-26")).body;
    expect(o).toMatchObject({ goal: { text: "Eat extra clean for the next 2 weeks", days: 14, startedOn: "2026-10-21" }, goals: 3, goalSplurges: 0 });
  });

  it("reading never writes: a GET with any day leaves day 1 alone", async () => {
    s = await scratch();
    const b = await firstPerson();
    await b.call("POST", "/api/goals", { text: "First", today: "2026-10-21" });
    await b.call("GET", "/api/overview?today=2099-01-01");
    await b.call("GET", "/api/goals?today=2099-01-01");
    expect((await b.call("GET", "/api/goals?today=2026-10-26")).body.open[0].startedOn).toBe("2026-10-21");
  });

  it("checking off moves the next one up with a fresh day 1; undo puts it back as it was", async () => {
    s = await scratch();
    const b = await firstPerson();
    const a = (await b.call("POST", "/api/goals", { text: "First", days: 7, today: "2026-10-01" })).body;
    await b.call("POST", "/api/goals", { text: "Second", today: "2026-10-01" });
    expect((await b.call("POST", `/api/goals/${a.id}/done`, { today: "2026-10-08" })).body.doneOn).toBe("2026-10-08");
    expect((await b.call("POST", `/api/goals/${a.id}/done`, { today: "2026-10-08" })).status).toBe(409);
    let l = (await b.call("GET", "/api/goals?today=2026-10-08")).body;
    expect(days1(l.open)).toEqual([["Second", "2026-10-08"]]);
    expect([texts(l.done), l.doneCount]).toEqual([["First"], 1]);
    await b.call("POST", `/api/goals/${a.id}/reopen`, { today: "2026-10-08" });
    l = (await b.call("GET", "/api/goals?today=2026-10-08")).body;
    expect(days1(l.open)).toEqual([["First", "2026-10-01"], ["Second", null]]);
    expect(l.done).toEqual([]);
  });

  it("moves up and down, edits, removes; a goal moved off the top starts over", async () => {
    s = await scratch();
    const b = await firstPerson();
    const a = (await b.call("POST", "/api/goals", { text: "A", today: "2026-10-01" })).body;
    const c = (await b.call("POST", "/api/goals", { text: "C", today: "2026-10-01" })).body;
    await b.call("POST", "/api/goals", { text: "D", today: "2026-10-01" });
    expect((await b.call("POST", `/api/goals/${c.id}/move`, { dir: "sideways", today: "2026-10-05" })).status).toBe(400);
    await b.call("POST", `/api/goals/${c.id}/move`, { dir: "up", today: "2026-10-05" });
    await b.call("POST", `/api/goals/${c.id}/move`, { dir: "up", today: "2026-10-05" }); // already at the top: nothing happens
    let l = (await b.call("GET", "/api/goals?today=2026-10-05")).body;
    expect(days1(l.open)).toEqual([["C", "2026-10-05"], ["A", null], ["D", null]]);
    await b.call("POST", `/api/goals/${a.id}/move`, { dir: "down", today: "2026-10-05" });
    expect(texts((await b.call("GET", "/api/goals?today=2026-10-05")).body.open)).toEqual(["C", "D", "A"]);
    expect((await b.call("PUT", `/api/goals/${a.id}`, { text: "A, better", days: 14 })).body).toMatchObject({ text: "A, better", days: 14 });
    expect((await b.call("DELETE", `/api/goals/${c.id}`, { today: "2026-10-06" })).status).toBe(200);
    expect((await b.call("DELETE", `/api/goals/${c.id}`, { today: "2026-10-06" })).status).toBe(404);
    l = (await b.call("GET", "/api/goals?today=2026-10-06")).body;
    expect(days1(l.open)).toEqual([["D", "2026-10-06"], ["A, better", null]]);
  });

  it("counts the splurges since day 1, up to the last day once the time is up", async () => {
    s = await scratch();
    const b = await firstPerson();
    await b.call("POST", "/api/goals", { text: "Clean week", days: 7, today: "2026-10-01" });
    for (const day of ["2026-09-30", "2026-10-02", "2026-10-07", "2026-10-08"]) await b.call("POST", "/api/splurges", { what: "Donut", size: "snack", day });
    expect((await b.call("GET", "/api/overview?today=2026-10-04")).body.goalSplurges).toBe(1);
    expect((await b.call("GET", "/api/overview?today=2026-10-12")).body.goalSplurges).toBe(2); // Oct 1–7 only
    expect((await b.call("GET", "/api/goals?today=2026-10-12")).body.goalSplurges).toBe(2); // the Goals page says the same
  });

  it("a goal can say up to 300 characters (Nov 9 2026: was 120)", async () => {
    s = await scratch();
    const b = await firstPerson();
    const long = "Two weeks with no drive-through. ".repeat(10).slice(0, 300);
    expect(long.length).toBe(300);
    const ok = await b.call("POST", "/api/goals", { text: long, today: "2026-11-09" });
    expect(ok.status).toBe(200);
    expect(ok.body.text).toBe(long.trim());
    expect((await b.call("POST", "/api/goals", { text: long + "x", today: "2026-11-09" })).body.error).toBe("Keep the goal under 300 characters.");
  });

  it("never more than 50 open goals, undo included", async () => {
    s = await scratch();
    const b = await firstPerson();
    const first = (await b.call("POST", "/api/goals", { text: "Goal 0", today: "2026-10-01" })).body;
    await b.call("POST", `/api/goals/${first.id}/done`, { today: "2026-10-01" });
    for (let i = 1; i <= 50; i++) await b.call("POST", "/api/goals", { text: `Goal ${i}`, today: "2026-10-01" });
    expect((await b.call("POST", "/api/goals", { text: "One more", today: "2026-10-01" })).status).toBe(409);
    expect((await b.call("POST", `/api/goals/${first.id}/reopen`, { today: "2026-10-01" })).status).toBe(409);
  });

  it("each person has their own goals, even after Switch to", async () => {
    s = await scratch();
    const b = await withUsers();
    const sarah = (await b.call("POST", "/api/users", { name: "Sarah", password: PW })).body;
    const mine = (await b.call("POST", "/api/goals", { text: "Mine", today: "2026-10-01" })).body;
    await b.call("POST", `/api/users/${sarah.id}/switch`);
    expect((await b.call("GET", "/api/goals?today=2026-10-01")).body.open).toEqual([]);
    expect((await b.call("POST", `/api/goals/${mine.id}/done`, { today: "2026-10-01" })).status).toBe(404);
    await b.call("POST", "/api/goals", { text: "Hers", today: "2026-10-01" });
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

describe("planned treat (Nov 11 2026)", () => {
  it("a splurge can be a planned treat: off unless said, saved, changed, checked", async () => {
    s = await scratch();
    const b = await firstPerson();
    expect((await b.call("POST", "/api/splurges", meal())).body.planned).toBe(false);
    const bday = (await b.call("POST", "/api/splurges", meal({ what: "Birthday dinner", planned: true }))).body;
    expect(bday.planned).toBe(true);
    expect((await b.call("POST", "/api/splurges", meal({ planned: "yes" }))).body.error).toBe("Planned treat is on or off.");
    expect((await b.call("PUT", `/api/splurges/${bday.id}`, meal({ what: "Birthday dinner", planned: false }))).body.planned).toBe(false);
    await b.call("PUT", `/api/splurges/${bday.id}`, meal({ what: "Birthday dinner", planned: true }));
    const list = (await b.call("GET", "/api/splurges?from=2026-10-01&to=2026-10-31")).body;
    expect(list.map((x: { what: string; planned: boolean }) => [x.what, x.planned]).sort()).toEqual([["Birthday dinner", true], ["Cheeseburger & fries", false]]);
  });

  it("upgrading a version 3 database adds the planned switch (off) and the game tables, keeping everything", async () => {
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const Database = (await import("better-sqlite3")).default;
    const { MIGRATIONS, openDatabase, SCHEMA_VERSION } = await import("../server/src/db.js");
    expect(SCHEMA_VERSION).toBe(5);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jt-up4-"));
    const file = path.join(dir, "junk.db");
    try {
      const old = new Database(file);
      old.exec(MIGRATIONS[0]); old.exec(MIGRATIONS[1]); old.exec(MIGRATIONS[2]); old.pragma("user_version = 3");
      old.prepare("INSERT INTO users VALUES ('u1', 'Matt', '', '{}', 'now', NULL)").run();
      old.prepare("INSERT INTO splurges VALUES ('s1', 'u1', 'Pizza', 'feast', '', NULL, '2026-11-01', '', '', 'x', 'x')").run();
      old.close();
      const db = openDatabase(file);
      expect(db.prepare("SELECT what, planned FROM splurges").all()).toEqual([{ what: "Pizza", planned: 0 }]);
      for (const t of ["game_runs", "game_fights", "game_events"]) expect((db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n).toBe(0);
      db.close();
      const copy = new Database(`${file}.before-v${SCHEMA_VERSION}`, { readonly: true });
      expect(copy.pragma("user_version", { simple: true })).toBe(3);
      copy.close();
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("Craving Crusher (game mode, Nov 11 2026)", () => {
  const T = "2026-11-10";
  /** this computer's date for the game's sanity check on the phone's day: the tests' days are near it */
  const GAME = { serverDay: () => "2026-11-12" };
  /** every row the game keeps, to check a read wrote nothing */
  const snapshot = () => JSON.stringify(["game_runs", "game_fights", "game_events"].map((t) => s.handle.db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()));

  it("with no run: nothing on the map yet; the day must be real; starting a run opens Crumbs", async () => {
    s = await scratch({}, GAME);
    const b = await firstPerson();
    const none = (await b.call("GET", `/api/game?today=${T}`)).body;
    expect(none).toMatchObject({ today: T, run: null, fight: null, needsSync: false, events: [] });
    expect(none.map).toHaveLength(60);
    expect((await b.call("GET", "/api/game?today=2026-02-30")).body.error).toBe("Which day is it?");
    expect((await b.call("GET", `/api/game?today=${T}&now=25:99`)).status).toBe(400);
    expect((await b.call("POST", "/api/game/run", { mode: "easy", today: T })).body.error).toBe("Pick Normal or Hardcore.");
    expect((await b.call("POST", "/api/game/sync", { today: T })).body.view.run).toBeNull();
    const r = (await b.call("POST", "/api/game/run", { mode: "normal", today: T, now: "08:00" })).body;
    expect(r.happened.map((e: { kind: string }) => e.kind)).toEqual(["run_start"]);
    expect(r.view.run).toMatchObject({ number: 1, mode: "normal", hearts: 3, active: true, score: 0 });
    expect(r.view.fight).toMatchObject({ level: 1, name: "Crumbs", hp: 100, max: 100, bet: 1, deadlineOn: "2026-11-12", daysLeft: 3, betLocked: false });
    expect(r.view.map[0].status).toBe("current");
  });

  it("GET never writes: it says needsSync, and POST /sync settles the KO and opens the next fight", async () => {
    s = await scratch({}, GAME);
    const b = await firstPerson();
    await b.call("POST", "/api/game/run", { mode: "normal", today: T });
    await b.call("POST", "/api/activities", { what: "Long walk", minutes: 150, day: T, time: "09:00" });
    const before = snapshot();
    const g = (await b.call("GET", `/api/game?today=${T}&now=10:00`)).body;
    expect(g.needsSync).toBe(true);
    expect(g.fight).toMatchObject({ name: "Crumbs", hp: 0 });
    // a phone whose date is far off is refused, and nothing is settled
    expect((await b.call("GET", `/api/game?today=2026-12-31`)).body.error).toMatch(/^Your phone's date looks wrong/);
    expect((await b.call("POST", "/api/game/sync", { today: "2200-12-31" })).status).toBe(400);
    expect((await b.call("GET", `/api/game?today=2026-11-14`)).status).toBe(200); // two days away is fine (time zones)
    await b.call("GET", `/api/game/hall?today=${T}`);
    expect(snapshot()).toBe(before);
    const synced = (await b.call("POST", "/api/game/sync", { today: T, now: "10:00" })).body;
    expect(synced.happened.map((e: { kind: string }) => e.kind)).toEqual(["powerup_earned", "ko"]);
    expect(synced.happened[1].text).toMatch(/^Crumbs went down! \+/);
    // between fights: nothing opens by itself (Matt, Nov 14 2026)
    expect(synced.view.fight).toBeNull();
    expect(synced.view.next).toMatchObject({ level: 2, name: "Chiplet", hp: 120, partDay: true });
    expect(synced.view.run.potions).toBe(1);
    expect((await b.call("GET", `/api/game?today=${T}`)).body.needsSync).toBe(false);
    expect((await b.call("POST", "/api/game/sync", { today: T })).body.happened).toEqual([]);
    // started by hand: Chiplet is on; refused while it is going
    expect((await b.call("POST", "/api/game/next", { bet: 4, today: T })).body.error).toBe("Pick Steady, Bold or Daredevil.");
    const go = (await b.call("POST", "/api/game/next", { today: T, now: "11:00" })).body;
    expect(go.happened.map((e: { kind: string; text: string }) => [e.kind, e.text])).toEqual([["fight_start", "Chiplet: the fight is on!"]]);
    expect(go.view.fight).toMatchObject({ level: 2, name: "Chiplet", hp: 120 });
    expect((await b.call("POST", "/api/game/next", { today: T })).body.error).toBe("A fight is already going. Beat it first.");
    // a splurge logged after it started heals the new monster; the score counts every entry since the run began
    await b.call("POST", "/api/splurges", { what: "Fries", size: "meal", day: T, time: "12:00", planned: true });
    const v = (await b.call("GET", `/api/game?today=${T}`)).body;
    // Chiplet was at full HP: the planned meal's 13 goes on as bonus HP (Nov 14 2026)
    expect(v.fight.lines.map((l: { text: string }) => l.text)).toEqual(["Fries heals Chiplet +13 (a planned treat: half). It was at full HP, so that's +13 bonus HP."]);
    expect([v.fight.heals, v.fight.hp, v.fight.bonus, v.fight.bonusMax]).toEqual([13, 120, 13, 24]);
    expect(v.run.liveScore).toBe(v.run.score + 5); // the walk was counted at the sync; the fries since
    expect(v.run.logPoints).toBe(5);
  });

  it("a missed deadline: strike, a heart lost, a rematch that waits to be started", async () => {
    s = await scratch({}, GAME);
    const b = await firstPerson();
    await b.call("POST", "/api/game/run", { mode: "hardcore", today: T });
    for (const d of ["2026-11-10", "2026-11-11", "2026-11-12"]) await b.call("POST", "/api/splurges", { what: "Chips", size: "snack", day: d });
    const r = (await b.call("POST", "/api/game/sync", { today: "2026-11-13" })).body;
    expect(r.happened.map((e: { kind: string }) => e.kind)).toEqual(["strike"]);
    expect(r.view.run.hearts).toBe(2);
    expect([r.view.fight, r.view.next.rematch, r.view.next.attempt]).toEqual([null, true, 2]);
    const go = (await b.call("POST", "/api/game/next", { today: "2026-11-13", bet: 1.5 })).body;
    expect(go.view.fight).toMatchObject({ level: 1, attempt: 2, startedOn: "2026-11-13", deadlineOn: "2026-11-14", bet: 1.5 });
  });

  it("the bet, power-ups and the mode, each with its own plain refusal", async () => {
    s = await scratch({}, GAME);
    const b = await firstPerson();
    expect((await b.call("POST", "/api/game/bet", { bet: 2, today: T })).status).toBe(409);
    await b.call("POST", "/api/game/run", { mode: "hardcore", today: T });
    expect((await b.call("POST", "/api/game/bet", { bet: 3, today: T })).body.error).toBe("Pick Steady, Bold or Daredevil.");
    expect((await b.call("POST", "/api/game/bet", { bet: 2, today: T })).body.view.fight).toMatchObject({ bet: 2, deadlineOn: T });
    expect((await b.call("POST", "/api/game/bet", { bet: 1, today: T })).body.view.fight).toMatchObject({ bet: 1, deadlineOn: "2026-11-12" });
    await b.call("POST", "/api/activities", { what: "Run", minutes: 20, day: T, time: "07:00" });
    expect((await b.call("POST", "/api/game/bet", { bet: 2, today: T })).body.error).toMatch(/locked/);
    expect((await b.call("POST", "/api/game/powerup", { kind: "potion", today: T, now: "09:00" })).body.error).toMatch(/no Water Potion/);
    expect((await b.call("POST", "/api/game/powerup", { kind: "rocket", today: T })).status).toBe(400);
    expect((await b.call("POST", "/api/game/mode", { to: "hardcore", today: T })).status).toBe(400);
    const m = (await b.call("POST", "/api/game/mode", { to: "normal", today: T })).body;
    expect(m.view.run).toMatchObject({ mode: "normal", hardcore: false, hardcoreDroppedOn: T });
    expect((await b.call("POST", "/api/game/mode", { to: "normal", today: T })).body.error).toMatch(/already Normal/);
    // a 60-minute workout earns a Water Potion (and finishes Crumbs), and drinking it hits Chiplet for 50
    await b.call("POST", "/api/activities", { what: "Bike", minutes: 60, day: T, time: "08:00" });
    expect((await b.call("POST", "/api/game/sync", { today: T })).body.view.next).toMatchObject({ name: "Chiplet" });
    expect((await b.call("POST", "/api/game/powerup", { kind: "potion", today: T, now: "09:00" })).body.error).toMatch(/no fight going/);
    expect((await b.call("POST", "/api/game/next", { today: T })).body.view.fight).toMatchObject({ name: "Chiplet", hp: 120 });
    const p = (await b.call("POST", "/api/game/powerup", { kind: "potion", today: T, now: "09:00" })).body;
    expect(p.happened.map((e: { kind: string }) => e.kind)).toEqual(["powerup_used"]);
    expect(p.view.run.potions).toBe(0);
    expect(p.view.fight.hp).toBe(70);
  });

  it("starting a new run ends the one going as abandoned; the Hall of Heroes lists everyone's runs", async () => {
    s = await scratch({}, GAME);
    const b = await withUsers();
    await b.call("POST", "/api/users", { name: "Sarah", password: PW });
    const sarah = s.browser();
    await sarah.call("POST", "/api/auth/login", { name: "Sarah", password: PW });
    await b.call("POST", "/api/game/run", { mode: "normal", today: T });
    const second = (await b.call("POST", "/api/game/run", { mode: "hardcore", today: T })).body;
    expect(second.view.run).toMatchObject({ number: 2, mode: "hardcore" });
    await sarah.call("POST", "/api/game/run", { mode: "normal", today: T });
    const hall = (await b.call("GET", `/api/game/hall?today=${T}`)).body;
    expect(hall.allTime.map((r: { name: string; number: number }) => `${r.name} ${r.number}`).sort()).toEqual(["Matt 1", "Matt 2", "Sarah 1"]);
    expect(hall.allTime.find((r: { number: number; name: string }) => r.name === "Matt" && r.number === 1)).toMatchObject({ endReason: "abandoned", isYou: true });
    expect(hall.hardcore.map((r: { name: string }) => r.name)).toEqual(["Matt"]);
    // a run switched from Hardcore to Normal says so
    await sarah.call("POST", "/api/game/run", { mode: "hardcore", today: T });
    await sarah.call("POST", "/api/game/mode", { to: "normal", today: T });
    const dropped = (await b.call("GET", `/api/game/hall?today=${T}`)).body.allTime.find((r: { name: string; number: number }) => r.name === "Sarah" && r.number === 2);
    expect(dropped).toMatchObject({ mode: "normal", hardcore: false, droppedFromHardcore: true });
    expect(hall.mine).toHaveLength(2);
    expect(hall.thisMonth).toHaveLength(3);
    expect(hall.allTime.every((r: { droppedFromHardcore: boolean }) => r.droppedFromHardcore === false)).toBe(true);
    // the badges are the person on screen's, from their stored fights
    expect(hall.badges.map((x: { id: string }) => x.id)).toEqual(["first-blood", "flawless", "daredevil", "world-1", "comeback"]);
    expect((await b.call("GET", "/api/game/hall")).status).toBe(400);
  });

  it("Keep the monsters coming: off by default; on, the day's first open starts a run, then each next monster on a later day — never the same day one went down", async () => {
    s = await scratch({}, GAME);
    const b = await firstPerson();
    const auto = async (today: string, now = "08:00") => (await b.call("POST", "/api/game/auto", { today, now })).body;
    const kindsOf = (r: { happened: { kind: string }[] }) => r.happened.map((e) => e.kind);
    const runs = () => s.handle.db.prepare("SELECT number, mode, end_reason FROM game_runs ORDER BY number").all();
    // off: nothing starts, and the day is not used up (turning it on later today still works)
    expect(await auto(T)).toEqual({ started: false, checked: false });
    expect(runs()).toEqual([]);
    expect((await b.call("PUT", "/api/me/settings", { autoStart: "yes" })).body.error).toBe("Keep the monsters coming is on or off.");
    expect((await b.call("PUT", "/api/me/settings", { autoStart: true })).body.autoStart).toBe(true);
    expect((await b.call("POST", "/api/game/auto", { today: "2200-01-01" })).status).toBe(400);
    // Tuesday, first open, no run yet: run 1 starts (Normal), told as started by itself
    const tue = await auto(T);
    expect(tue.started).toBe("run");
    expect(tue.happened[0]).toMatchObject({ kind: "run_start", data: { number: 1, mode: "normal", auto: true } });
    expect(tue.happened[0].text).toBe("Run #1 started by itself (Normal): Keep the monsters coming is on. Crumbs is first.");
    expect(tue.view).toMatchObject({ fight: { level: 1 }, autoStart: true });
    // later that day a long walk knocks Crumbs out: nothing new starts, today or on another open today
    await b.call("POST", "/api/activities", { what: "Long walk", minutes: 150, day: T, time: "15:00" });
    expect(kindsOf((await b.call("POST", "/api/game/sync", { today: T, now: "15:05" })).body)).toContain("ko");
    expect(await auto(T, "18:00")).toMatchObject({ started: false, checked: true, view: { fight: null, next: { level: 2 } } });
    // Wednesday's first open: Chiplet shows up by itself, with the whole day
    const wed = await auto("2026-11-11");
    expect(wed.started).toBe("fight");
    expect(wed.happened.map((e: { kind: string; data: { auto?: boolean } }) => [e.kind, e.data.auto])).toEqual([["fight_start", true]]);
    expect(wed.view.fight).toMatchObject({ level: 2, startedOn: "2026-11-11", startedAfter: null });
    expect(await auto("2026-11-11", "20:00")).toMatchObject({ started: false, checked: true });
    // Thursday: a workout logged in the tracker before the game is opened knocks Chiplet out today, so nothing starts…
    await b.call("POST", "/api/activities", { what: "Ride", minutes: 200, day: "2026-11-12", time: "07:00" });
    const thu = await auto("2026-11-12");
    expect(thu.started).toBe(false);
    expect(kindsOf(thu)).toContain("ko"); // the look settles first, so the Victory is told
    expect(thu.view).toMatchObject({ fight: null, next: { level: 3 } });
    // …until Friday, or until it is started by hand
    expect((await auto("2026-11-13")).started).toBe("fight");
    expect(runs()).toEqual([{ number: 1, mode: "normal", end_reason: null }]);
    // off again: nothing more
    await b.call("PUT", "/api/me/settings", { autoStart: false });
    expect(await auto("2026-11-14")).toEqual({ started: false, checked: false });
  });

  it("Keep the monsters coming after a run ends: a run that ends at the day's first look gets its Defeated screen; the new run starts the next day, in the same mode", async () => {
    s = await scratch({}, GAME);
    const b = await firstPerson();
    await b.call("POST", "/api/game/run", { mode: "hardcore", today: T });
    await b.call("PUT", "/api/me/settings", { autoStart: true });
    s.handle.db.prepare("UPDATE game_runs SET hearts = 1").run();
    // Crumbs' deadline was Nov 12; the look on Nov 13 settles the strike and the defeat, and starts nothing
    const first = (await b.call("POST", "/api/game/auto", { today: "2026-11-13" })).body;
    expect(first.started).toBe(false);
    expect(first.happened.map((e: { kind: string }) => e.kind).filter((k: string) => k !== "powerup_earned")).toEqual(["strike", "defeat"]); // (3 clean days earned a shield on the way)
    expect(first.view.run).toMatchObject({ active: false, endReason: "defeated" });
    expect((await b.call("POST", "/api/game/auto", { today: "2026-11-13" })).body.started).toBe(false);
    expect((await b.call("POST", "/api/game/auto", { today: "2026-11-14" })).body).toMatchObject({ started: "run", view: { run: { number: 2, mode: "hardcore" } } });
  });

  it("one person can't touch another person's run: each sees, syncs and changes only their own", async () => {
    s = await scratch({}, GAME);
    const b = await withUsers();
    const sarahUser = (await b.call("POST", "/api/users", { name: "Sarah", password: PW })).body;
    const sarah = s.browser();
    await sarah.call("POST", "/api/auth/login", { name: "Sarah", password: PW });
    await sarah.call("POST", "/api/game/run", { mode: "hardcore", today: T });
    const hers = () => s.handle.db.prepare("SELECT * FROM game_runs r JOIN game_fights f ON f.run_id = r.id WHERE r.user_id = ?").all(sarahUser.id);
    const before = JSON.stringify(hers());
    // Matt has no run of his own, so his game calls find nothing of Sarah's
    expect((await b.call("GET", `/api/game?today=${T}`)).body.run).toBeNull();
    expect((await b.call("POST", "/api/game/bet", { bet: 2, today: T })).status).toBe(409);
    expect((await b.call("POST", "/api/game/mode", { to: "normal", today: T })).status).toBe(409);
    expect((await b.call("POST", "/api/game/powerup", { kind: "wind", today: T })).status).toBe(409);
    // his own run and his workouts never reach her fight
    await b.call("POST", "/api/game/run", { mode: "normal", today: T });
    await b.call("POST", "/api/activities", { what: "Run", minutes: 300, day: T, time: "07:00" });
    await b.call("POST", "/api/game/sync", { today: "2026-11-14" });
    expect(JSON.stringify(hers())).toBe(before);
    expect((await sarah.call("GET", `/api/game?today=${T}`)).body.fight).toMatchObject({ name: "Crumbs", hp: 100 });
    expect((await b.call("GET", `/api/game?today=${T}`)).body.run.number).toBe(1);
    // a write from another site is refused, as everywhere
    expect((await b.call("POST", "/api/game/sync", { today: T }, { origin: "http://evil.example.com" })).status).toBe(403);
    // removing a person removes their runs
    await b.call("DELETE", `/api/users/${sarahUser.id}`, { confirm: "DELETE" });
    expect(hers()).toEqual([]);
  });
});
