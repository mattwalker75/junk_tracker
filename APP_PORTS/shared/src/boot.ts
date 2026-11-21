/**
 * The phone app's page starts here: the web app's own page (web/src/main.tsx), with every /api request it
 * makes answered inside the app by backend.ts instead of a server. Requests run one at a time, and a request
 * that changed anything is saved to the phone before the page hears back, so what the page shows is kept.
 */
import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm-browser.wasm?url";
import { Backend } from "./backend";
import { phoneStore } from "./store";

declare const __CC_VERSION__: string;

const store = phoneStore();
const ready = (async () => {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  return new Backend(SQL, await store.load(), __CC_VERSION__);
})();
// a failed start shows its reason on the page's own error lines, not a blank screen
ready.catch((e) => console.error("[craving-crusher] could not open the log", e));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function answer(method: string, url: string, body: unknown): Promise<Response> {
  let backend: Backend;
  try { backend = await ready; }
  catch (e) { return json(503, { error: `Craving Crusher could not open its log on ${store.where}: ${(e as Error).message}` }); }
  const before = backend.db.totalChanges();
  const a = backend.handle(method, url, body);
  if (backend.db.totalChanges() !== before) {
    try { await store.save(backend.db.file()); }
    catch (e) { return json(500, { error: `That could not be saved on ${store.where}: ${(e as Error).message || "no reason given"}. Try again.` }); }
  }
  return json(a.status, a.body);
}

let queue: Promise<unknown> = Promise.resolve();
const realFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) return realFetch(input, init);
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  let body: unknown;
  try { body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined; } catch { body = undefined; }
  const next = queue.then(() => answer(method, url.pathname + url.search, body));
  queue = next.catch(() => {});
  return next;
};

// only now the page itself, so its first request already comes here
void import("../../../web/src/main");

// The page keeps <meta name="theme-color"> at its background colour (web/src/lib/theme.ts). The iPhone app reads
// it itself; Android's web view can't, so it is sent, and sent again whenever the theme changes.
const android = window.CCAndroid;
if (android?.barColor) {
  const meta = document.querySelector('meta[name="theme-color"]');
  const send = () => { const c = meta?.getAttribute("content"); if (c) android.barColor?.(c); };
  if (meta) new MutationObserver(send).observe(meta, { attributes: true, attributeFilter: ["content"] });
  send();
}
