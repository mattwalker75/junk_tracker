/**
 * Keeping the person's log on the phone (review, Nov 22 2026): a save that fails is undone, a log that
 * can't be read is never replaced, a damaged log falls back to its backup, and an upgrade keeps the older
 * log for good. Runs open.ts with a pretend phone that behaves like the iPhone and Android apps.
 */
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { openLog, RECOVERED } from "../src/open";
import { Database } from "../src/sqlite";
import type { PhoneStore } from "../src/store";

let SQL: SqlJsStatic;
beforeAll(async () => { SQL = await initSqlJs(); });

const TODAY = "2030-03-14";
type Files = Record<string, Uint8Array>;

/** the native apps' rules: save copies junk.db to junk.db.prev first; a read error is an error */
function phone(files: Files = {}, o: { failSaves?: number; unreadable?: boolean } = {}) {
  let fail = o.failSaves ?? 0;
  const store: PhoneStore = {
    where: "this phone",
    async load() { if (o.unreadable) throw new Error("The phone could not read junk.db (I/O error)"); return files["junk.db"] ?? null; },
    async loadPrev() { return files["junk.db.prev"] ?? null; },
    async save(bytes) {
      if (fail > 0) { fail--; throw new Error("No space left on device"); }
      if (files["junk.db"]) files["junk.db.prev"] = files["junk.db"];
      files["junk.db"] = bytes;
    },
    async setAside() { if (files["junk.db"]) { files["junk.db.damaged"] = files["junk.db"]; delete files["junk.db"]; } },
    async keepCopy(name, bytes) { files[name] = bytes; },
  };
  return { store, files, failNext: (n: number) => { fail = n; } };
}

const splurge = (what: string) => ({ what, size: "snack", day: TODAY });
const count = (bytes: Uint8Array | undefined, what: string) => {
  if (!bytes) return 0;
  const db = new SQL.Database(bytes);
  try { return Number(db.exec(`SELECT COUNT(*) FROM splurges WHERE what = '${what}'`)[0].values[0][0]); } finally { db.close(); }
};
const versionOf = (bytes: Uint8Array | undefined) => {
  const db = new SQL.Database(bytes);
  try { return Number(db.exec("PRAGMA user_version")[0].values[0][0]); } finally { db.close(); }
};
async function logWith(what: string[]): Promise<Files> {
  const p = phone();
  const k = await openLog(SQL, p.store, "9.9.9", () => TODAY);
  for (const w of what) expect((await k.answer("POST", "/api/splurges", splurge(w))).status).toBe(200);
  return p.files;
}

describe("a save the phone can't make", () => {
  it("is undone, so Try again logs it once", async () => {
    const p = phone(await logWith(["Cookie"]));
    const k = await openLog(SQL, p.store, "9.9.9", () => TODAY);
    p.failNext(1);
    const first = await k.answer("POST", "/api/splurges", splurge("Donut"));
    expect(first.status).toBe(500);
    expect((first.body as { error: string }).error).toMatch(/could not be saved on this phone \(No space left on device\), so nothing was changed\. Try again\./);
    expect((await k.answer("POST", "/api/splurges", splurge("Donut"))).status).toBe(200);
    expect(count(p.files["junk.db"], "Donut")).toBe(1);
  });

  it("isn't shown on the page, so the screen is what the phone keeps", async () => {
    const p = phone(await logWith(["Cookie"]));
    const k = await openLog(SQL, p.store, "9.9.9", () => TODAY);
    p.failNext(1);
    await k.answer("POST", "/api/splurges", splurge("Donut"));
    const shown = (await k.answer("GET", `/api/splurges?from=${TODAY}&to=${TODAY}`)).body as { what: string }[];
    expect(shown.map((s) => s.what)).toEqual(["Cookie"]);
    expect(count(p.files["junk.db"], "Donut")).toBe(0);
  });
});

describe("a log the phone can't read", () => {
  it("stops the app with the reason, and nothing is ever saved over it", async () => {
    const files = await logWith(["Cookie"]);
    const before = { ...files };
    const p = phone(files, { unreadable: true });
    await expect(openLog(SQL, p.store, "9.9.9", () => TODAY)).rejects.toThrow(/could not read junk\.db/);
    expect(p.files).toEqual(before);
  });
});

describe("a damaged log", () => {
  it("opens the copy from before the last save, sets the damaged one aside and says so once", async () => {
    const files = await logWith(["Cookie", "Donut"]); // junk.db has both, junk.db.prev has the cookie
    const damaged = new TextEncoder().encode("this is not a database at all, it was cut short by something");
    files["junk.db"] = damaged;
    const p = phone(files);
    const k = await openLog(SQL, p.store, "9.9.9", () => TODAY);
    expect((await k.answer("GET", "/api/phone/notice")).body).toEqual({ notice: RECOVERED });
    const shown = (await k.answer("GET", `/api/splurges?from=${TODAY}&to=${TODAY}`)).body as { what: string }[];
    expect(shown.map((s) => s.what)).toEqual(["Cookie"]);
    expect(p.files["junk.db.damaged"]).toBe(damaged);
    // the good copy is still the backup, not the damaged file
    expect(count(p.files["junk.db.prev"], "Cookie")).toBe(1);
    await k.answer("POST", "/api/phone/notice/seen");
    expect((await k.answer("GET", "/api/phone/notice")).body).toEqual({ notice: null });
  });

  it("with no good backup, stops with the reason and saves nothing", async () => {
    const p = phone({ "junk.db": new TextEncoder().encode("not a database, and no backup either") });
    await expect(openLog(SQL, p.store, "9.9.9", () => TODAY)).rejects.toThrow();
    expect(Object.keys(p.files)).toEqual(["junk.db"]);
  });

  it("from a newer app is never replaced by an older copy", async () => {
    const files = await logWith(["Cookie", "Donut"]);
    const db = new Database(SQL, files["junk.db"]);
    db.pragma("user_version = 999");
    files["junk.db"] = db.file();
    const p = phone(files);
    await expect(openLog(SQL, p.store, "9.9.9", () => TODAY)).rejects.toThrow(/newer Craving Crusher/);
    expect(p.files["junk.db.damaged"]).toBeUndefined();
  });
});

describe("an upgrade", () => {
  it("keeps the older log for good as junk.db.before-v<N>, not just until the next change", async () => {
    const { MIGRATIONS } = await import("../../../server/src/migrations");
    const old = new Database(SQL, null);
    for (let v = 0; v < 6; v++) old.exec(MIGRATIONS[v]);
    old.pragma("user_version = 6");
    const p = phone({ "junk.db": old.file() });
    const k = await openLog(SQL, p.store, "9.9.9", () => TODAY);
    expect(versionOf(p.files["junk.db"])).toBe(8);
    await k.answer("POST", "/api/splurges", splurge("Donut"));
    await k.answer("POST", "/api/splurges", splurge("Pizza"));
    expect(versionOf(p.files["junk.db.before-v6"])).toBe(6);
    expect(versionOf(p.files["junk.db.prev"])).toBe(8);
  });
});
