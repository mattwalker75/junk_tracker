import { afterEach, describe, expect, it } from "vitest";
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
