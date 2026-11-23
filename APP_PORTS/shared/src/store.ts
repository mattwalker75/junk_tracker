/**
 * Where the log is kept: one SQLite file, handed to the phone app to keep (Application Support on an
 * iPhone, the app's own files on Android — both are in the phone's backups), with junk.db.prev (the file
 * as it was before the last save) beside it. Each platform answers the same questions:
 *
 *   iPhone   window.webkit.messageHandlers.ccStore.postMessage({ op, … }) → a promise; a failure rejects with a sentence
 *            ops: "load" · "loadPrev" (base64, "" when there is none) · "save" { data } · "setAside" · "keepCopy" { name, data }
 *   Android  window.CCAndroid.load() / loadPrev() → base64, "" when there is none, or "!" + a sentence when it can't be read;
 *            save(base64) / setAside() / keepCopy(name, base64) → "ok" or a sentence
 *
 * A file that is there but can't be read is an error, never "no log yet": a new empty log must not be
 * saved over one the phone failed to read (review, Nov 22 2026).
 *
 * Opened in a desktop browser (to try the phone build on a Mac), the files are kept in the browser's IndexedDB.
 */
export interface PhoneStore {
  /** which one, for messages */
  where: string;
  /** the log; null when there is none yet; throws when it is there but can't be read */
  load(): Promise<Uint8Array | null>;
  /** the copy from before the last save (null: none) */
  loadPrev(): Promise<Uint8Array | null>;
  /** keep the log (the one it replaces becomes junk.db.prev) */
  save(bytes: Uint8Array): Promise<void>;
  /** move a damaged junk.db out of the way (to junk.db.damaged), so saving doesn't turn it into junk.db.prev */
  setAside(): Promise<void>;
  /** keep a named copy for good: junk.db.before-v<N>, junk.db.before-start-over-<day> */
  keepCopy(name: string, bytes: Uint8Array): Promise<void>;
}

/** the only names keepCopy takes */
export const COPY_NAME = /^junk\.db\.before-(v\d{1,3}|start-over-\d{4}-\d{2}-\d{2})$/;

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

interface IosHandler { postMessage(m: unknown): Promise<unknown> }
interface AndroidBridge {
  load(): string; loadPrev?(): string; save(b64: string): string; setAside?(): string; keepCopy?(name: string, b64: string): string;
  barColor?(hex: string): void;
}
declare global {
  interface Window {
    webkit?: { messageHandlers?: { ccStore?: IosHandler } };
    CCAndroid?: AndroidBridge;
  }
}

const bytesOf = (b: unknown) => (typeof b === "string" && b ? fromBase64(b) : null);
const failed = (e: unknown) => new Error(e instanceof Error ? e.message : typeof e === "string" ? e : "no reason given");

function ios(h: IosHandler): PhoneStore {
  const ask = async (m: unknown) => { try { return await h.postMessage(m); } catch (e) { throw failed(e); } };
  return {
    where: "this iPhone",
    async load() { return bytesOf(await ask({ op: "load" })); },
    async loadPrev() { return bytesOf(await ask({ op: "loadPrev" })); },
    async save(bytes) { await ask({ op: "save", data: toBase64(bytes) }); },
    async setAside() { await ask({ op: "setAside" }); },
    async keepCopy(name, bytes) { if (!COPY_NAME.test(name)) throw new Error(`Not a copy name: ${name}`); await ask({ op: "keepCopy", name, data: toBase64(bytes) }); },
  };
}

function android(a: AndroidBridge): PhoneStore {
  const read = (b: string) => { if (b.startsWith("!")) throw new Error(b.slice(1)); return bytesOf(b); };
  const done = (r: string | undefined) => { if (r !== "ok") throw new Error(r || "This version of the app can't do that"); };
  return {
    where: "this phone",
    async load() { return read(a.load()); },
    async loadPrev() { return a.loadPrev ? read(a.loadPrev()) : null; },
    async save(bytes) { done(a.save(toBase64(bytes))); },
    async setAside() { done(a.setAside?.()); },
    async keepCopy(name, bytes) { if (!COPY_NAME.test(name)) throw new Error(`Not a copy name: ${name}`); done(a.keepCopy?.(name, toBase64(bytes))); },
  };
}

function browser(): PhoneStore {
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("craving-crusher-phone", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction("files", mode);
      const req = fn(t.objectStore("files"));
      t.oncomplete = () => { db.close(); resolve(req.result); };
      t.onerror = () => { db.close(); reject(t.error); };
    });
  };
  const get = async (key: string) => { const v = await run<unknown>("readonly", (s) => s.get(key)); return v instanceof Uint8Array ? v : null; };
  return {
    where: "this browser",
    load: () => get("junk.db"),
    loadPrev: () => get("junk.db.prev"),
    async save(bytes) {
      const now = await get("junk.db");
      if (now) await run("readwrite", (s) => s.put(now, "junk.db.prev"));
      await run("readwrite", (s) => s.put(bytes, "junk.db"));
    },
    async setAside() {
      const now = await get("junk.db");
      if (now) await run("readwrite", (s) => s.put(now, "junk.db.damaged"));
      await run("readwrite", (s) => s.delete("junk.db"));
    },
    async keepCopy(name, bytes) { if (!COPY_NAME.test(name)) throw new Error(`Not a copy name: ${name}`); await run("readwrite", (s) => s.put(bytes, name)); },
  };
}

export function phoneStore(): PhoneStore {
  const h = window.webkit?.messageHandlers?.ccStore;
  if (h) return ios(h);
  if (window.CCAndroid) return android(window.CCAndroid);
  return browser();
}
