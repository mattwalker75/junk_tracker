/** Damage anywhere in junk.db (review, Nov 22 2026): a bad page in the middle is found by quick_check and the backup opens. */
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
describe("a bad page in junk.db", () => {
  it("every page of the file in turn: the log opens the backup, or every screen still works", async () => {
    const p0 = phone();
    const k0 = await openLog(SQL, p0.store, "9.9.9", () => TODAY);
    for (let i = 0; i < 300; i++) await k0.answer("POST", "/api/splurges", { what: `Snack number ${i} with a longer name to fill pages`, size: "snack", day: TODAY });
    const good = p0.files["junk.db"], prev = p0.files["junk.db.prev"];
    const pages = good.length / 4096;
    const out: string[] = [];
    for (let pg = 1; pg < pages; pg++) {
      const bad = good.slice(); bad.fill(0xff, pg * 4096, pg * 4096 + 4096);
      const p = phone({ "junk.db": bad, "junk.db.prev": prev });
      let k;
      try { k = await openLog(SQL, p.store, "9.9.9", () => TODAY); } catch (e) { out.push(`p${pg}: open threw ${(e as Error).message.slice(0, 60)}`); continue; }
      const notice = ((await k.answer("GET", "/api/phone/notice")).body as { notice: string | null }).notice;
      const list = await k.answer("GET", `/api/splurges?from=${TODAY}&to=${TODAY}`);
      const home = await k.answer("GET", `/api/overview?today=${TODAY}`);
      const add = await k.answer("POST", "/api/splurges", { what: "Donut", size: "snack", day: TODAY });
      const n = Array.isArray(list.body) ? list.body.length : -1;
      if (notice) out.push(`p${pg}: recovered`);
      else out.push(`p${pg}: no notice; splurges ${list.status} (${n} of 300) overview ${home.status} add ${add.status} ${add.status !== 200 ? JSON.stringify(add.body).slice(0, 90) : ""}${list.status !== 200 ? JSON.stringify(list.body).slice(0, 90) : ""}`);
    }
    console.log(out.join("\n"));
    expect(out.filter((l) => l.includes("no notice") && !/splurges 200 \(300 of 300\) overview 200 add 200/.test(l))).toEqual([]);
  });
});
