/**
 * An interrupted recovery (review, Nov 22 2026): a damaged log whose recovery save fails (a full phone) — or the app is closed between
 * setAside and that save — leaves no junk.db, only junk.db.prev + junk.db.damaged. The next open must not
 * start a new, empty log over the person's history.
 */
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { beforeAll, expect, it } from "vitest";
import { openLog } from "../src/open";
import type { PhoneStore } from "../src/store";

let SQL: SqlJsStatic;
beforeAll(async () => { SQL = await initSqlJs(); });
const TODAY = "2030-03-14";
type Files = Record<string, Uint8Array>;

// same rules as keeping.test.ts's pretend phone (= PhoneWebView.swift / MainActivity.java)
function phone(files: Files, failSaves = 0) {
  let fail = failSaves;
  const store: PhoneStore = {
    where: "this phone",
    async load() { return files["junk.db"] ?? null; },
    async loadPrev() { return files["junk.db.prev"] ?? null; },
    async save(bytes) {
      if (fail > 0) { fail--; throw new Error("No space left on device"); }
      if (files["junk.db"]) files["junk.db.prev"] = files["junk.db"];
      files["junk.db"] = bytes;
    },
    async setAside() { if (files["junk.db"]) { files["junk.db.damaged"] = files["junk.db"]; delete files["junk.db"]; } },
    async keepCopy(name, bytes) { files[name] = bytes; },
  };
  return store;
}
const splurge = (what: string) => ({ what, size: "snack", day: TODAY });
const count = (bytes: Uint8Array | undefined, what: string) => {
  if (!bytes) return 0;
  const db = new SQL.Database(bytes);
  try { return Number(db.exec(`SELECT COUNT(*) FROM splurges WHERE what = '${what}'`)[0].values[0][0]); } catch { return -1; } finally { db.close(); }
};

it("a failed recovery save does not lead to a new empty log replacing the backup", async () => {
  const files: Files = {};
  const k0 = await openLog(SQL, phone(files), "9.9.9", () => TODAY);
  for (const w of ["Cookie", "Donut"]) expect((await k0.answer("POST", "/api/splurges", splurge(w))).status).toBe(200);
  files["junk.db"] = new TextEncoder().encode("this is not a database at all, it was cut short by something");

  // open 1: damaged → prev opens → setAside → the save fails (phone full)
  await expect(openLog(SQL, phone(files, 1), "9.9.9", () => TODAY)).rejects.toThrow(/No space/);
  console.log("files after the failed recovery:", Object.keys(files));

  // open 2 (the person closes and opens the app, as the page told them to)
  const k = await openLog(SQL, phone(files), "9.9.9", () => TODAY);
  const shown = (await k.answer("GET", `/api/splurges?from=${TODAY}&to=${TODAY}`)).body as { what: string }[];
  console.log("open 2 shows:", shown.map((s) => s.what), "notice:", (await k.answer("GET", "/api/phone/notice")).body);
  await k.answer("POST", "/api/splurges", splurge("Apple"));
  await k.answer("POST", "/api/splurges", splurge("Pear"));
  console.log("Cookie in junk.db:", count(files["junk.db"], "Cookie"), "in junk.db.prev:", count(files["junk.db.prev"], "Cookie"));
  expect(shown.map((s) => s.what)).toContain("Cookie");
});
