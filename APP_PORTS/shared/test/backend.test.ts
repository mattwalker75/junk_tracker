/**
 * The phone apps' backend: the server's routes answered inside the app, on a database kept on the phone.
 * Runs the same code as the phone (backend.ts on sql.js), in Node.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { Backend } from "../src/backend";
import { Database } from "../src/sqlite";
import { fromBase64, toBase64 } from "../src/store";

let SQL: SqlJsStatic;
beforeAll(async () => { SQL = await initSqlJs(); });

const TODAY = "2030-03-14";
const NOW = "12:00";
const fresh = (bytes: Uint8Array | null = null) => new Backend(SQL, bytes, "9.9.9", () => TODAY);
const ok = (b: Backend, method: string, url: string, body?: unknown) => {
  const a = b.handle(method, url, body);
  if (a.status !== 200) throw new Error(`${method} ${url} → ${a.status} ${JSON.stringify(a.body)}`);
  return a.body as any;
};

describe("phone backend", () => {
  it("opens straight onto one person's log, with no sign-in", () => {
    const b = fresh();
    const me = ok(b, "GET", "/api/auth/me");
    expect(me).toMatchObject({ status: "ok", loginEnabled: false, users: 1, me: { name: "Me" }, acting: null });
    expect(ok(b, "GET", "/api/health")).toEqual({ ok: true, app: "craving-crusher-phone", version: "9.9.9" });
  });

  it("logs, and keeps everything in the file the phone saves", () => {
    const b = fresh();
    const me = ok(b, "GET", "/api/auth/me").me;
    ok(b, "POST", "/api/splurges", { what: "Donut", size: "snack", day: TODAY });
    ok(b, "POST", "/api/activities", { what: "Walk", minutes: 30, day: TODAY });
    ok(b, "PUT", `/api/weigh-ins/${TODAY}`, { weight: 180, unit: "lb" });
    ok(b, "PUT", "/api/me/settings", { units: "kg", activityReminderDays: 5 });

    // what the phone keeps is the whole file; opening it again gives the same log and the same person
    const again = fresh(fromBase64(toBase64(b.db.file())));
    expect(ok(again, "GET", "/api/auth/me").me.id).toBe(me.id);
    expect(ok(again, "GET", `/api/splurges?from=${TODAY}&to=${TODAY}`).map((s: any) => s.what)).toEqual(["Donut"]);
    expect(ok(again, "GET", `/api/activities?from=${TODAY}&to=${TODAY}`)[0]).toMatchObject({ what: "Walk", minutes: 30 });
    expect(ok(again, "GET", `/api/weigh-ins?from=${TODAY}&to=${TODAY}`)[0].pounds).toBe(180);
    expect(ok(again, "GET", "/api/me/settings")).toMatchObject({ units: "kg", activityReminderDays: 5, weighReminderDays: 7 });
    expect(ok(again, "GET", `/api/overview?today=${TODAY}`)).toBeTruthy();
  });

  it("checks what is sent the same way the server does, in the same sentences", () => {
    const b = fresh();
    expect(b.handle("PUT", "/api/me/settings", { weighReminderDays: 0 })).toEqual({ status: 400, body: { error: "A reminder waits 1 to 60 days (a whole number)." } });
    expect(b.handle("POST", "/api/splurges", { what: "", size: "snack", day: TODAY }).status).toBe(400);
    expect(b.handle("DELETE", "/api/splurges/nope")).toEqual({ status: 404, body: { error: "That splurge no longer exists." } });
    expect(b.handle("GET", "/api/nothing-here")).toEqual({ status: 404, body: { error: "No such address." } });
  });

  it("has no other users, passwords or sign-in", () => {
    const b = fresh();
    for (const [m, u] of [["POST", "/api/users"], ["POST", "/api/auth/enable"], ["POST", "/api/auth/login"], ["PUT", "/api/users/x/password"], ["POST", "/api/users/x/switch"], ["DELETE", "/api/users/x"]] as const) {
      expect(b.handle(m, u, { name: "Sam", password: "long enough" })).toMatchObject({ status: 409, body: { error: expect.stringContaining("one person's log") } });
    }
    expect(b.handle("PUT", "/api/settings", { server: { allowNetwork: true } }).status).toBe(400);
    // the name can still be changed
    const me = ok(b, "GET", "/api/auth/me").me;
    expect(ok(b, "PUT", `/api/users/${me.id}/name`, { name: "Matt" }).name).toBe("Matt");
  });

  it("keeps the look in the database, as there is no config.json", () => {
    const b = fresh();
    expect(ok(b, "GET", "/api/appearance")).toEqual({ theme: "system", customThemes: [] });
    ok(b, "PUT", "/api/settings", { appearance: { theme: "dark" } });
    expect(ok(fresh(b.db.file()), "GET", "/api/appearance").theme).toBe("dark");
    expect(ok(b, "GET", "/api/settings")).toMatchObject({ version: "9.9.9", restartRequired: [], networkUrls: [], config: { security: { loginEnabled: false } } });
  });

  it("plays Calorie Crusher", () => {
    const b = fresh();
    ok(b, "POST", "/api/game/run", { mode: "normal", today: TODAY, now: NOW });
    const view = ok(b, "GET", `/api/game?today=${TODAY}&now=${encodeURIComponent(NOW)}`);
    expect(view).toBeTruthy();
    ok(b, "POST", "/api/game/sync", { today: TODAY, now: NOW });
    expect(ok(b, "GET", `/api/game/hall?today=${TODAY}`)).toBeTruthy();
  });

  it("answers every call the page makes (web/src/lib/api.ts)", () => {
    const b = fresh();
    const src = readFileSync(path.resolve(import.meta.dirname, "../../../web/src/lib/api.ts"), "utf8");
    const calls = [...src.matchAll(/call<[^>]*>\("([A-Z]+)", [`"]([^`"]+)[`"]/g)].map((m) => [m[1], m[2]] as const);
    expect(calls.length).toBeGreaterThan(40);
    for (const [method, url] of calls) {
      const u = url.replace(/\$\{[^}]*today[^}]*\}|\$\{day\}|\$\{from\}|\$\{to\}/g, TODAY).replace(/\$\{[^}]+\}/g, "x");
      const a = b.handle(method, u, {});
      expect((a.body as { error?: string }).error, `${method} ${url}`).not.toBe("No such address.");
    }
  });

  it("upgrades a phone log from version 6 (60 levels) without losing a game row, and a run that beat 60 carries on at 61", async () => {
    const { MIGRATIONS } = await import("../../../server/src/migrations");
    const old = new Database(SQL);
    for (let v = 0; v < 6; v++) old.exec(MIGRATIONS[v]);
    old.pragma("user_version = 6");
    old.exec(`INSERT INTO users (id, name, password_hash, created_at) VALUES ('u1', 'Me', '', 'x');
      INSERT INTO game_runs (id, user_id, number, mode, started_at, started_on, ended_on, end_reason, hearts) VALUES ('r1', 'u1', 1, 'normal', '2030-03-01T08:00:00.000Z', '2030-03-01', '2030-03-12', 'finished', 4);
      INSERT INTO game_fights (id, run_id, user_id, level, attempt, started_on, deadline_on, status, ended_on, seq) VALUES ('f1', 'r1', 'u1', 60, 1, '2030-03-05', '2030-03-12', 'won', '2030-03-12', 0);
      INSERT INTO game_events (id, run_id, fight_id, day, at, kind, data_json, seq) VALUES ('e1', 'r1', 'f1', '2030-03-12', 'x', 'ko', '{}', 0), ('e2', 'r1', 'f1', '2030-03-12', 'x', 'finish', '{}', 1);`);
    const b = fresh(old.file());
    expect([b.db.pragma("user_version", { simple: true }), b.upgradedFrom, fresh().upgradedFrom]).toEqual([8, 6, null]);
    expect(b.db.prepare("SELECT id FROM game_events ORDER BY seq").all()).toEqual([{ id: "e1" }, { id: "e2" }]);
    expect(b.db.pragma("foreign_key_check")).toEqual([]);
    const synced = ok(b, "POST", "/api/game/sync", { today: TODAY, now: NOW });
    expect(synced.happened.map((e: { kind: string }) => e.kind)).toEqual(["run_continues"]);
    expect(synced.view.next).toMatchObject({ level: 61, name: "Pint Yeti" });
    const go = ok(b, "POST", "/api/game/next", { today: TODAY, now: NOW });
    expect(go.view.fight).toMatchObject({ level: 61, world: 7 });
    // and it was saved that way: a fresh open of the file sees fight 61
    expect(fresh(b.db.file()).db.prepare("SELECT level FROM game_fights ORDER BY seq DESC LIMIT 1").get()).toEqual({ level: 61 });
  });

  it("refuses a log saved by a newer app", () => {
    const b = fresh();
    b.db.pragma("user_version = 999");
    expect(() => fresh(b.db.file())).toThrow(/newer Craving Crusher/);
  });
});

describe("the SQLite adapter", () => {
  it("keeps foreign keys on after the file is copied out (deleting a person deletes their log)", () => {
    const b = fresh();
    const me = ok(b, "GET", "/api/auth/me").me;
    ok(b, "POST", "/api/splurges", { what: "Chips", size: "snack", day: TODAY });
    b.db.file();
    expect(b.db.pragma("foreign_keys", { simple: true })).toBe(1);
    b.db.prepare("DELETE FROM users WHERE id = ?").run(me.id);
    expect(b.db.prepare("SELECT COUNT(*) AS n FROM splurges").get()).toEqual({ n: 0 });
  });

  it("does transactions like better-sqlite3: all or nothing, one inside another is a savepoint", () => {
    const db = new Database(SQL);
    db.exec("CREATE TABLE t (n INTEGER UNIQUE)");
    const add = db.transaction((n: number) => { db.prepare("INSERT INTO t (n) VALUES (?)").run(n); });
    const both = db.transaction(() => {
      add(1);
      try { db.transaction(() => { add(2); add(1); })(); } catch (e) { expect((e as { code?: string }).code).toBe("SQLITE_CONSTRAINT_UNIQUE"); }
      add(3);
    });
    both();
    expect(db.prepare("SELECT n FROM t ORDER BY n").all()).toEqual([{ n: 1 }, { n: 3 }]);
    expect(() => db.transaction(() => { add(4); throw new Error("no"); })()).toThrow("no");
    expect(db.prepare("SELECT COUNT(*) AS c FROM t").get()).toEqual({ c: 2 });
    expect(db.prepare("INSERT INTO t (n) VALUES (@n)").run({ n: 9 }).changes).toBe(1);
    expect(db.prepare("SELECT n FROM t WHERE n = ?").get([9])).toEqual({ n: 9 });
  });
});

describe("workouts from the phone's health app (Nov 22 2026)", () => {
  it("brings them in on the phone's own database, once each, skipping one logged by hand", () => {
    const b = fresh();
    ok(b, "POST", "/api/activities", { what: "Walk", minutes: 30, calories: null, day: TODAY, time: "07:10", notes: "" });
    const w = (id: string, time: string) => ({ id, what: "Walk", day: TODAY, time, minutes: 40, calories: 200 });
    const r = ok(b, "POST", "/api/health/import", { source: "health-connect", today: TODAY, workouts: [w("hc-1", "07:00"), w("hc-2", "18:00")] });
    expect([r.added.length, r.skipped]).toEqual([1, 1]);
    expect(r.added[0]).toMatchObject({ what: "Walk", time: "18:00", source: "health-connect" });
    expect(ok(b, "POST", "/api/health/import", { source: "health-connect", today: TODAY, workouts: [w("hc-1", "07:00"), w("hc-2", "18:00")] }).added).toEqual([]);
    expect(ok(b, "GET", `/api/health/summary?today=${TODAY}`)).toMatchObject({ lastAdded: 0, thisWeek: 1 });
  });
});

describe("the Android app's Health Connect answers", () => {
  it("come back by call id, and a refusal is an error with Health Connect's sentence", async () => {
    const w = globalThis as unknown as { window?: unknown };
    const had = w.window;
    w.window = globalThis;
    try {
      const { androidHealth } = await import("../src/health");
      const asked: string[] = [];
      const h = androidHealth({
        health(op, arg, id) {
          asked.push(`${op} ${arg}`);
          const done = (globalThis as unknown as { __ccHealthDone: (id: string, json: string) => void }).__ccHealthDone;
          setTimeout(() => done(id, op === "status" ? JSON.stringify({ ok: true, value: "ok" })
            : op === "workouts" ? JSON.stringify({ ok: true, value: [{ id: "x", what: "Walk", startMs: 1, endMs: 2, calories: null }, { bad: true }] })
            : JSON.stringify({ ok: false, error: "Health Connect isn't sharing your workouts" })), 0);
        },
      });
      expect(h.source).toBe("health-connect");
      expect(await h.status()).toBe("ok");
      expect(await h.workouts(5)).toEqual([{ id: "x", what: "Walk", startMs: 1, endMs: 2, calories: null }]);
      await expect(h.authorize()).rejects.toThrow("Health Connect isn't sharing your workouts");
      expect(asked).toEqual(["status null", 'workouts {"since":5}', "authorize null"]);
      expect(await androidHealth({}).status()).toBe("no-build");
    } finally { w.window = had; }
  });
});
