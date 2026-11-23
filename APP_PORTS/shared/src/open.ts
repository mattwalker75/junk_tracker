/**
 * Opening the log on the phone, and keeping it (review, Nov 22 2026 — the person's log must never be lost):
 * - a log the phone can't READ stops here with an error; nothing is ever saved over it;
 * - a DAMAGED log (it reads, but won't open) is set aside as junk.db.damaged and its backup, junk.db.prev
 *   (the file before the last save), is opened instead, with a notice for the person;
 * - a log from an older app is upgraded, and the older one is kept for good as junk.db.before-v<N>, N being
 *   the version it was at (the web app names its copy after the new version), besides junk.db.prev;
 * - a change the phone fails to save is undone in memory (Keeper), so the page never shows what the phone
 *   didn't keep, and Try again can't log it twice.
 */
import type { SqlJsStatic } from "sql.js";
import { Backend, NewerLogError } from "./backend";
import type { PhoneStore } from "./store";

export const RECOVERED = "Your log file on this phone was damaged, so Craving Crusher opened the copy it saved just before your last change. "
  + "The last thing you logged may be missing, so check today's entries. The damaged file is kept beside it as junk.db.damaged.";

export async function openLog(SQL: SqlJsStatic, store: PhoneStore, version: string, serverDay?: () => string): Promise<Keeper> {
  // throws when the file is there but can't be read: the page then shows why, and nothing is saved
  const main = await store.load();
  let opened = main;
  let backend: Backend;
  let notice: string | null = null;
  try {
    backend = new Backend(SQL, main, version, serverDay);
  } catch (e) {
    if (e instanceof NewerLogError || !main) throw e;
    const prev = await store.loadPrev().catch(() => null);
    if (!prev) throw e;
    try { backend = new Backend(SQL, prev, version, serverDay); } catch { throw e; }
    // out of the way first, so the save below doesn't turn the damaged file into junk.db.prev
    await store.setAside();
    opened = prev;
    notice = RECOVERED;
    await store.save(backend.db.file());
  }
  if (backend.upgradedFrom && opened) {
    // the older version's log, kept for good; a copy that can't be made doesn't stop the app (junk.db.prev has it too)
    await store.keepCopy(`junk.db.before-v${backend.upgradedFrom}`, opened).catch((err) => console.warn("[craving-crusher] no before-upgrade copy", err));
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
