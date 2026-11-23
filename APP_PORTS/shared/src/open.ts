/**
 * Opening the log on the phone, and keeping it (reviews, Nov 22 2026 — the person's log must never be lost):
 * - a log the phone can't READ stops here with an error; nothing is ever saved over it;
 * - a DAMAGED log — it won't open, or SQLite's quick_check finds damage anywhere in it (opening alone only sees the
 *   first page) — is set aside as junk.db.damaged and its backup, junk.db.prev (the file before the last save), is
 *   opened instead if that one is whole, with a notice for the person; with no whole backup, the log opens as it is,
 *   with a notice that some of it may be missing;
 * - NO junk.db but a whole junk.db.prev means a recovery (or a save) was cut short: the backup is opened, never a
 *   new empty log that would later be saved over it;
 * - a log from an older app is upgraded, and the older one is kept for good as junk.db.before-v<N>, N being the
 *   version it is upgraded TO — the web app's name for its copy (server/src/db.ts) — besides junk.db.prev;
 * - a change the phone fails to save is undone in memory (Keeper), so the page never shows what the phone
 *   didn't keep, and Try again can't log it twice.
 */
import type { SqlJsStatic } from "sql.js";
import { Backend } from "./backend";
import { Database } from "./sqlite";
import type { PhoneStore } from "./store";

export const RECOVERED = "Your log file on this phone was damaged, so Craving Crusher opened the copy it saved just before your last change. "
  + "The last thing you logged may be missing, so check today's entries. The damaged file is kept beside it as junk.db.damaged.";
export const DAMAGED = "Part of your log file on this phone is damaged, and there is no whole copy to go back to. Craving Crusher opened "
  + "what it could: some entries may be missing or wrong, so check your recent days.";

/** the file opens and SQLite's quick_check finds no damage in any of it */
export function whole(SQL: SqlJsStatic, bytes: Uint8Array): boolean {
  try {
    const db = new Database(SQL, bytes);
    try { return db.pragma("quick_check", { simple: true }) === "ok"; } finally { db.close(); }
  } catch { return false; }
}

export async function openLog(SQL: SqlJsStatic, store: PhoneStore, version: string, serverDay?: () => string): Promise<Keeper> {
  // throws when the file is there but can't be read: the page then shows why, and nothing is saved
  const main = await store.load();
  const open = (bytes: Uint8Array | null) => new Backend(SQL, bytes, version, serverDay); // a newer app's log throws NewerLogError
  let opened = main;
  let backend: Backend;
  let notice: string | null = null;
  const prevWhole = async () => { const p = await store.loadPrev().catch(() => null); return p && whole(SQL, p) ? p : null; };
  if (main && whole(SQL, main)) {
    backend = open(main);
  } else if (main) {
    const prev = await prevWhole();
    if (prev) {
      backend = open(prev);
      // out of the way first, so the save below doesn't turn the damaged file into junk.db.prev; if that save is cut
      // short, the next open finds no junk.db and opens junk.db.prev again (below)
      await store.setAside();
      opened = prev;
      notice = RECOVERED;
      await store.save(backend.db.file());
    } else {
      backend = open(main); // no whole copy: what can be opened is better than nothing (throws if it can't)
      notice = DAMAGED;
    }
  } else {
    const prev = await prevWhole();
    if (prev) {
      backend = open(prev);
      opened = prev;
      notice = RECOVERED;
      await store.save(backend.db.file()); // no junk.db: the backup is not moved
    } else {
      backend = open(null);
    }
  }
  if (backend.upgradedFrom && opened) {
    // the older version's log, kept for good; a copy that can't be made doesn't stop the app (junk.db.prev has it too)
    const to = Number(backend.db.pragma("user_version", { simple: true }));
    await store.keepCopy(`junk.db.before-v${to}`, opened).catch((err) => console.warn("[craving-crusher] no before-upgrade copy", err));
    await store.save(backend.db.file());
  }
  backend.notice = notice;
  return new Keeper(backend, store);
}

/** Runs one page request, saves what it changed, and undoes it if the phone couldn't keep it. */
export class Keeper {
  private lastGood: Uint8Array;
  constructor(readonly backend: Backend, private readonly store: PhoneStore) {
    this.lastGood = backend.db.file();
  }

  async answer(method: string, url: string, body?: unknown): Promise<{ status: number; body: unknown }> {
    const db = this.backend.db;
    const before = db.totalChanges();
    const a = this.backend.handle(method, url, body);
    if (db.totalChanges() === before) return a;
    const bytes = db.file();
    try {
      await this.store.save(bytes);
      this.lastGood = bytes;
      return a;
    } catch (e) {
      db.restore(this.lastGood);
      return { status: 500, body: { error: `That could not be saved on ${this.store.where} (${(e as Error).message || "no reason given"}), so nothing was changed. Try again.` } };
    }
  }
}
