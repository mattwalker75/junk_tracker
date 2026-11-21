/**
 * Where the log is kept: one SQLite file, handed to the phone app to keep (Application Support on an
 * iPhone, the app's own files on Android — both are in the phone's backups). Each platform answers the same
 * two questions:
 *
 *   iPhone   window.webkit.messageHandlers.ccStore.postMessage({ op: "load" | "save", data }) → a promise
 *   Android  window.CCAndroid.load() → base64 ("" when there is none);  window.CCAndroid.save(base64) → "ok" or a sentence
 *
 * Opened in a desktop browser (to try the phone build on a Mac), the file is kept in the browser's IndexedDB.
 */
export interface PhoneStore {
  /** which one, for messages */
  where: string;
  load(): Promise<Uint8Array | null>;
  save(bytes: Uint8Array): Promise<void>;
}

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
interface AndroidBridge { load(): string; save(b64: string): string; barColor?(hex: string): void }
declare global {
  interface Window {
    webkit?: { messageHandlers?: { ccStore?: IosHandler } };
    CCAndroid?: AndroidBridge;
  }
}

function ios(h: IosHandler): PhoneStore {
  return {
    where: "this iPhone",
    async load() { const b = await h.postMessage({ op: "load" }); return typeof b === "string" && b ? fromBase64(b) : null; },
    async save(bytes) { await h.postMessage({ op: "save", data: toBase64(bytes) }); },
  };
}

function android(a: AndroidBridge): PhoneStore {
  return {
    where: "this phone",
    async load() { const b = a.load(); return b ? fromBase64(b) : null; },
    async save(bytes) { const r = a.save(toBase64(bytes)); if (r !== "ok") throw new Error(r); },
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
  return {
    where: "this browser",
    async load() { const v = await run<unknown>("readonly", (s) => s.get("junk.db")); return v instanceof Uint8Array ? v : null; },
    async save(bytes) { await run("readwrite", (s) => s.put(bytes, "junk.db")); },
  };
}

export function phoneStore(): PhoneStore {
  const h = window.webkit?.messageHandlers?.ccStore;
  if (h) return ios(h);
  if (window.CCAndroid) return android(window.CCAndroid);
  return browser();
}
