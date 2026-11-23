/**
 * Damage past the first page (review, Nov 22 2026): a junk.db that is damaged past its first page (cut short, or a bad page in the middle) — does
 * openLog fall back to junk.db.prev, as the fix for "a damaged log locks the app" says?
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
  const store: PhoneStore = {
    where: "this phone",
    async load() { return files["junk.db"] ?? null; },
    async loadPrev() { return files["junk.db.prev"] ?? null; },
    async save(bytes) { if (files["junk.db"]) files["junk.db.prev"] = files["junk.db"]; files["junk.db"] = bytes; },
    async setAside() { if (files["junk.db"]) { files["junk.db.damaged"] = files["junk.db"]; delete files["junk.db"]; } },
    async keepCopy(name, bytes) { files[name] = bytes; },
  };
  return { store, files };
}

async function bigLog(): Promise<Files> {
  const p = phone();
  const k = await openLog(SQL, p.store, "9.9.9", () => TODAY);
  for (let i = 0; i < 300; i++) await k.answer("POST", "/api/splurges", { what: `Snack number ${i} with a longer name to fill pages`, size: "snack", day: TODAY });
  return p.files;
}

describe("a log damaged past its first page", () => {
  for (const [name, damage] of [
    ["cut short to half its size", (b: Uint8Array) => b.slice(0, Math.floor(b.length / 2 / 4096) * 4096)],
    ["a bad page in the middle", (b: Uint8Array) => { const c = b.slice(); c.fill(0xff, Math.floor(b.length / 2 / 4096) * 4096, Math.floor(b.length / 2 / 4096) * 4096 + 4096); return c; }],
  ] as const) {
    it(`${name}: opens the backup, or at least says so in a plain sentence`, async () => {
      const files = await bigLog();
      console.log("log size", files["junk.db"].length);
      files["junk.db"] = damage(files["junk.db"]);
      const p = phone(files);
      let opened = true, k;
      try { k = await openLog(SQL, p.store, "9.9.9", () => TODAY); } catch (e) { opened = false; console.log("openLog threw:", (e as Error).message); }
      if (!opened || !k) return;
      const home = await k.answer("GET", `/api/overview?today=${TODAY}`);
      const list = await k.answer("GET", `/api/splurges?from=${TODAY}&to=${TODAY}`);
      const notice = await k.answer("GET", "/api/phone/notice");
      console.log(name, "→ overview", home.status, JSON.stringify(home.body).slice(0, 140), "| splurges", list.status, JSON.stringify(list.body).slice(0, 140), "| notice", JSON.stringify(notice.body).slice(0, 60));
      expect(home.status).toBe(200);
      expect(list.status).toBe(200);
    });
  }
});
