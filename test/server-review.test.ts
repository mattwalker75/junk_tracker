/**
 * The server's fixes from the deep review (Nov 22 2026): sign-in switches on and off whole or not at all, a new
 * sign-in length waits for a restart, the day someone was added is the phone's day, upgrade copies are never
 * stale, the database files are private, and a malformed request gets a plain sentence.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PW, scratch, type Scratch } from "./helpers.js";

let s: Scratch | undefined;
afterEach(async () => { vi.useRealTimers(); await s?.close(); s = undefined; });

describe("users and sign-in, when the settings file can't be saved", () => {
  it("Turn on changes nothing, says why, and works once the file can be saved", async () => {
    s = await scratch();
    const b = s.browser();
    await b.call("GET", "/api/auth/me");
    fs.chmodSync(s.dir, 0o555);
    let first;
    try { first = await b.call("POST", "/api/auth/enable", { name: "Matt", password: PW }); }
    finally { fs.chmodSync(s.dir, 0o755); }
    expect(first.status).toBe(500);
    expect(first.body.error).toMatch(/settings file could not be saved .*so users and sign-in stay off\. Try again\./);
    expect((await b.call("GET", "/api/auth/me")).body.loginEnabled).toBe(false);
    expect((s.handle.db.prepare("SELECT password_hash FROM users").get() as { password_hash: string }).password_hash).toBe("");
    expect((await b.call("POST", "/api/auth/enable", { name: "Matt", password: PW })).status).toBe(200);
  });

  it("Turn off changes nothing: the password stays and nobody drops to the setup screen", async () => {
    s = await scratch();
    const b = s.browser();
    expect((await b.call("POST", "/api/auth/enable", { name: "Matt", password: PW })).status).toBe(200);
    fs.chmodSync(s.dir, 0o555);
    let off;
    try { off = await b.call("POST", "/api/auth/disable", { confirm: "TURN OFF" }); }
    finally { fs.chmodSync(s.dir, 0o755); }
    expect(off.status).toBe(500);
    expect(off.body.error).toMatch(/so users and sign-in stay on/);
    expect((await b.call("GET", "/api/auth/me")).body.status).toBe("ok");
    expect((await s.browser().call("GET", "/api/auth/me")).body.status).toBe("signin");
  });
});

describe("how long a sign-in lasts", () => {
  it("counts after a restart, as the page says: lowering it doesn't sign anyone out now", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
    s = await scratch();
    const b = s.browser();
    expect((await b.call("POST", "/api/auth/enable", { name: "Matt", password: PW })).status).toBe(200);
    vi.setSystemTime(new Date("2026-11-22T12:00:00Z"));
    const put = await b.call("PUT", "/api/settings", { security: { sessionDays: 1 } });
    expect(put.body.restartRequired).toContain("security.sessionDays");
    expect((await b.call("GET", "/api/overview?today=2026-11-22")).status).toBe(200);
  });
});

describe("the first reminder for someone who has never logged", () => {
  it("counts from the phone's day they were added, not the server's UTC day (rule 3)", async () => {
    s = await scratch();
    const b = s.browser();
    const me = (await b.call("GET", "/api/auth/me")).body.me;
    // added at 8 PM on Nov 21 in Chicago (UTC-6, getTimezoneOffset 360) = 02:00 UTC on Nov 22
    s.handle.db.prepare("UPDATE users SET created_at = ? WHERE id = ?").run("2026-11-22T02:00:00.000Z", me.id);
    const due = async (day: string) => ((await b.call("GET", `/api/reminders?today=${day}&tz=360`)).body.due as { kind: string }[]).map((x) => x.kind);
    expect(await due("2026-11-23")).not.toContain("activity"); // Nov 21, 22, 23: three days, not yet
    expect(await due("2026-11-24")).toContain("activity");
    // an odd offset is ignored rather than trusted
    expect((await b.call("GET", "/api/reminders?today=2026-11-24&tz=99999")).status).toBe(200);
  });
});

describe("the copy kept before a database upgrade", () => {
  it("is made fresh by each upgrade; an older one of the same name is kept with its date", async () => {
    const Database = (await import("better-sqlite3")).default;
    const { MIGRATIONS, openDatabase, SCHEMA_VERSION } = await import("../server/src/db.js");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jt-rev-bk-"));
    const file = path.join(dir, "junk.db");
    try {
      const old = new Database(file);
      for (let v = 0; v < SCHEMA_VERSION - 1; v++) old.exec(MIGRATIONS[v]);
      old.pragma(`user_version = ${SCHEMA_VERSION - 1}`);
      old.exec("INSERT INTO users (id, name, password_hash, created_at) VALUES ('u1', 'Matt', '', 'x')");
      old.exec("INSERT INTO splurges (id, user_id, what, size, day, created_at, updated_at) VALUES ('s1', 'u1', 'Week 1 donut', 'snack', '2026-11-01', 'x', 'x')");
      old.close();
      openDatabase(file).close();
      const copy = `${file}.before-v${SCHEMA_VERSION}`;
      // going back: the copy back as junk.db, a week on the older app, then the newer app again
      fs.copyFileSync(copy, file);
      for (const x of ["-wal", "-shm"]) fs.rmSync(file + x, { force: true });
      const older = new Database(file);
      older.exec("INSERT INTO splurges (id, user_id, what, size, day, created_at, updated_at) VALUES ('s2', 'u1', 'Week 2 pizza', 'feast', '2026-11-08', 'x', 'x')");
      older.close();
      openDatabase(file).close();
      const read = (f: string) => { const c = new Database(f, { readonly: true }); try { return (c.prepare("SELECT what FROM splurges ORDER BY id").all() as { what: string }[]).map((r) => r.what); } finally { c.close(); } };
      expect(read(copy)).toEqual(["Week 1 donut", "Week 2 pizza"]);
      const dated = fs.readdirSync(dir).filter((f) => f.startsWith(`junk.db.before-v${SCHEMA_VERSION}.`) && !f.endsWith(".tmp"));
      expect(dated).toHaveLength(1);
      expect(read(path.join(dir, dated[0]))).toEqual(["Week 1 donut"]);
      expect(fs.readdirSync(dir).some((f) => f.endsWith(".tmp"))).toBe(false);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("the database files", () => {
  it("are private to this account from the very first start, the -wal and -shm too", async () => {
    s = await scratch();
    const b = s.browser();
    await b.call("POST", "/api/splurges", { what: "Donut", size: "snack", day: "2026-11-22" });
    const data = path.join(s.dir, "data");
    for (const f of ["junk.db", "junk.db-wal", "junk.db-shm"]) {
      expect((fs.statSync(path.join(data, f)).mode & 0o777).toString(8), f).toBe("600");
    }
  });
});

describe("a malformed request", () => {
  it("gets a plain sentence, not the checker's own words", async () => {
    s = await scratch();
    const b = s.browser();
    const made = await b.call("POST", "/api/splurges", { what: "Donut", size: "snack", day: "2026-11-22" });
    const bad = await b.call("PUT", `/api/splurges/${made.body.id}`, { what: "Donut", size: "snack", day: "2026-11-22", time: null });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("The time in that is not right.");
    const settings = await b.call("PUT", "/api/me/settings", { autoStart: "yes" });
    expect(settings.status).toBe(400);
    expect(settings.body.error).not.toMatch(/invalid input|expected|received/i);
    const none = await b.call("POST", "/api/activities");
    expect(none.body.error).not.toMatch(/invalid input|expected|received/i);
  });
});
