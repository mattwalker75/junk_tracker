/**
 * The phone's health app, for the page (web/src/lib/phone.ts PhoneHealth; Matt, Nov 22 2026): Apple Health in the
 * iPhone app, Health Connect in the Android app. Read only — workouts and the calories each burned. Each shell
 * answers three questions:
 *
 *   iPhone   window.webkit.messageHandlers.ccHealth.postMessage({ op: "status" | "authorize" | "workouts", since }) → a promise
 *   Android  window.CCAndroid.health(op, argJson, callId) → the answer comes back as window.__ccHealthDone(callId, json),
 *            json = { ok: true, value } or { ok: false, error }  (Health Connect only answers later, so it can't return)
 *
 * status → "ok" | "unavailable" | "needs-app" | "no-build";  authorize → true / false;
 * workouts(since ms) → [{ id, what, startMs, endMs, calories }]  (`what` already our name for its kind)
 */
import type { HealthSource } from "../../../shared/types";

type Status = "ok" | "unavailable" | "needs-app" | "no-build";
interface RawWorkout { id: string; what: string; startMs: number; endMs: number; calories: number | null }
export interface PhoneHealth {
  source: HealthSource;
  status(): Promise<Status>;
  authorize(): Promise<boolean>;
  workouts(sinceMs: number): Promise<RawWorkout[]>;
  getApp?(): void;
}

interface IosHandler { postMessage(m: unknown): Promise<unknown> }
interface AndroidHealth { health?(op: string, arg: string, id: string): void }
declare global {
  interface Window {
    __ccHealthDone?: (id: string, json: string) => void;
  }
}

const isRaw = (w: unknown): w is RawWorkout => !!w && typeof w === "object" && typeof (w as RawWorkout).id === "string"
  && typeof (w as RawWorkout).startMs === "number" && typeof (w as RawWorkout).endMs === "number";
const cleanList = (v: unknown): RawWorkout[] => (Array.isArray(v) ? v.filter(isRaw).map((w) => ({
  id: w.id, what: typeof w.what === "string" ? w.what : "Workout", startMs: w.startMs, endMs: w.endMs,
  calories: typeof w.calories === "number" && Number.isFinite(w.calories) ? w.calories : null,
})) : []);
const STATUSES: Status[] = ["ok", "unavailable", "needs-app", "no-build"];
const asStatus = (v: unknown): Status => (STATUSES.includes(v as Status) ? (v as Status) : "unavailable");

export function iosHealth(h: IosHandler): PhoneHealth {
  const ask = async (m: unknown) => {
    try { return await h.postMessage(m); }
    catch (e) { throw new Error(e instanceof Error ? e.message : String(e)); }
  };
  return {
    source: "apple-health",
    async status() { return asStatus(await ask({ op: "status" })); },
    async authorize() { return (await ask({ op: "authorize" })) === true; },
    async workouts(sinceMs) { return cleanList(await ask({ op: "workouts", since: sinceMs })); },
  };
}

export function androidHealth(a: AndroidHealth): PhoneHealth {
  const calls = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  let n = 0;
  window.__ccHealthDone = (id, json) => {
    const c = calls.get(id);
    if (!c) return;
    calls.delete(id);
    try {
      const r = JSON.parse(json) as { ok: boolean; value?: unknown; error?: string };
      if (r.ok) c.resolve(r.value); else c.reject(new Error(r.error || "Health Connect gave no answer"));
    } catch { c.reject(new Error("Health Connect's answer could not be read")); }
  };
  const ask = (op: string, arg: unknown = null) => new Promise<unknown>((resolve, reject) => {
    if (!a.health) { reject(new Error("This version of the app can't reach Health Connect")); return; }
    const id = `h${++n}`;
    calls.set(id, { resolve, reject });
    a.health(op, JSON.stringify(arg), id);
  });
  return {
    source: "health-connect",
    async status() { return a.health ? asStatus(await ask("status")) : "no-build"; },
    async authorize() { return (await ask("authorize")) === true; },
    async workouts(sinceMs) { return cleanList(await ask("workouts", { since: sinceMs })); },
    getApp() { void ask("getApp").catch(() => {}); },
  };
}

/** the shell's health app, or null (a desktop browser trying the phone build has none) */
export function phoneHealth(): PhoneHealth | null {
  const h = (window.webkit?.messageHandlers as { ccHealth?: IosHandler } | undefined)?.ccHealth;
  if (h) return iosHealth(h);
  const a = window.CCAndroid as unknown as AndroidHealth | undefined;
  if (a) return androidHealth(a);
  return null;
}
