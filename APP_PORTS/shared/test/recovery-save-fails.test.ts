/**
 * A recovery whose save fails (review, Nov 22 2026): a damaged junk.db whose recovery save fails. The pretend phone follows the native rules
 * (save copies junk.db to junk.db.prev first, only when junk.db exists; setAside moves junk.db to junk.db.damaged).
 */
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { openLog } from "../src/open";
import type { PhoneStore } from "../src/store";

let SQL: SqlJsStatic;
beforeAll(async () => { SQL = await initSqlJs(); });
const TODAY = "2030-03-14";
type Files = Record<string, Uint8Array>;
function phone(files: Files = {}) {
  let fail = 0;
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
  return { store, files, failNext: (n: number) => { fail = n; } };
}
const splurge = (what: string) => ({ what, size: "snack", day: TODAY });
const count = (bytes: Uint8Array | undefined, what: string) => {
  if (!bytes) return 0;
  const db = new SQL.Database(bytes);
  try { return Number(db.exec(`SELECT COUNT(*) FROM splurges WHERE what = '${what}'`)[0].values[0][0]); } finally { db.close(); }
};

describe("a damaged log whose recovery can't be saved", () => {
  it("the next open must not start an empty log, and the good backup must survive", async () => {
    const p0 = phone();
    const k0 = await openLog(SQL, p0.store, "9.9.9", () => TODAY);
    for (const w of ["Cookie", "Donut", "Pizza"]) await k0.answer("POST", "/api/splurges", splurge(w));
    const files = p0.files; // junk.db: all three; junk.db.prev: Cookie + Donut
    files["junk.db"] = new TextEncoder().encode("not a database any more");
    const p = phone(files);
    p.failNext(1);
    // 1st open: damaged → set aside → saving the recovered copy fails → the page shows 503 "Close the app and open it again"
    await expect(openLog(SQL, p.store, "9.9.9", () => TODAY)).rejects.toThrow(/No space left/);
    // the person does as told: closes the app and opens it again
    const k = await openLog(SQL, p.store, "9.9.9", () => TODAY);
    const shown = (await k.answer("GET", `/api/splurges?from=${TODAY}&to=${TODAY}`)).body as { what: string }[];
    console.log("after reopening, the log shows:", JSON.stringify(shown.map((s) => s.what)), "notice:", JSON.stringify((await k.answer("GET", "/api/phone/notice")).body));
    // two ordinary changes later
    await k.answer("POST", "/api/splurges", splurge("Chips"));
    await k.answer("POST", "/api/splurges", splurge("Soda"));
    console.log("files:", Object.keys(p.files).join(", "), "| Cookie in junk.db.prev:", count(p.files["junk.db.prev"], "Cookie"), "| Cookie in junk.db:", count(p.files["junk.db"], "Cookie"));
    expect(shown.map((s) => s.what)).toContain("Cookie");
    expect(count(p.files["junk.db.prev"], "Cookie") + count(p.files["junk.db"], "Cookie")).toBeGreaterThan(0);
  });
});
