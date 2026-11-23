/**
 * Bringing in workouts from the phone's health app (Matt, Nov 22 2026; canvas round 17): automatically, each time
 * the app opens or comes back, once it is turned on in Settings → You. Workouts only. The first time, the last 7
 * days (healthSince); after that it looks back up to 30 days each time, so a workout a watch syncs late still
 * comes in — the server takes each one once (log.ts importWorkouts).
 */
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HEALTH_SOURCES, type Day, type HealthImportResult, type HealthWorkout } from "../../../shared/types";
import { LOG_KEYS, refresh } from "./actions";
import { api } from "./api";
import { addDays, nowTime, today as todayOf } from "./dates";
import { phoneHealth, type RawWorkout } from "./phone";

/** how far back each bring-in looks (the first one: HEALTH_FIRST_DAYS, from healthSince) */
export const LOOK_BACK_DAYS = 30;
/**
 * The game waits for this before it settles (state.ts): a workout still coming in from Health must count before a
 * missed deadline is judged — run last night, KO this morning, not a lost heart (review, Nov 22 2026). It starts the
 * automatic bring-in when one is due, or joins the one running; off the phone apps, or turned off, it is done at once.
 */
export function workoutsIn(qc: QueryClient): Promise<unknown> {
  if (!phoneHealth()) return Promise.resolve();
  return bringInWorkouts(qc).catch(() => null);
}

/** an automatic bring-in at most this often (opening and coming back to the app) */
const EVERY_MS = 60_000;

/** A workout as the phone's own day and time (rule 3), in whole minutes. Pure (test/health.test.ts). */
export function toWorkout(w: RawWorkout): HealthWorkout {
  const start = new Date(w.startMs);
  const mins = Math.round((w.endMs - w.startMs) / 60_000);
  return {
    id: w.id,
    what: (w.what || "Workout").trim().slice(0, 120),
    day: todayOf(start),
    time: nowTime(start),
    minutes: mins >= 1 ? Math.min(mins, 1440) : null,
    calories: w.calories !== null && Number.isFinite(w.calories) && w.calories >= 0 ? Math.min(Math.round(w.calories), 20000) : null,
  };
}

/** the first day to ask about: the later of healthSince and 30 days back */
export function lookFrom(today: Day, since: Day | null): Day {
  const back = addDays(today, -(LOOK_BACK_DAYS - 1));
  return since && since > back ? since : back;
}
const midnight = (d: Day) => { const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd).getTime(); };

let running: Promise<HealthImportResult | null> | null = null;
let lastRun = 0;

/**
 * Ask the phone's health app for workouts and bring the new ones in. `now` = the person pressed Bring in now: it
 * runs even if one just ran, and says what went wrong; automatic runs stay quiet (a failed one is tried next time).
 */
export function bringInWorkouts(qc: QueryClient, opts: { now?: boolean } = {}): Promise<HealthImportResult | null> {
  const health = phoneHealth();
  if (!health) return Promise.resolve(null);
  // Bring in now while an automatic one runs: wait for it, then ask again, so the person hears what came of it
  if (running) return opts.now ? running.then(() => bringInWorkouts(qc, opts)) : running;
  if (!opts.now && Date.now() - lastRun < EVERY_MS) return Promise.resolve(null);
  lastRun = Date.now();
  running = (async () => {
    const name = HEALTH_SOURCES[health.source];
    try {
      const s = await api.mySettings();
      if (!s.healthImport) return null;
      const status = await health.status();
      if (status !== "ok") {
        if (opts.now) toast.error(status === "needs-app" ? "This phone needs the Health Connect app first." : `This phone can't reach ${name}.`);
        return null;
      }
      const today = todayOf();
      const raw = await health.workouts(midnight(lookFrom(today, s.healthSince)));
      const r = await api.healthImport(health.source, today, raw.map(toWorkout));
      const n = r.added.length;
      if (n) toast.success(`${n} ${n === 1 ? "workout" : "workouts"} from ${name} added`);
      else if (opts.now) toast.success(`No new workouts in ${name}.`);
      // not awaited: the game screen's own refresh waits for this bring-in (workoutsIn), so waiting for it here would wait forever
      void refresh(qc, n ? [...LOG_KEYS, ["health"], ["me-settings"]] : [["health"], ["me-settings"]]);
      return r;
    } catch (e) {
      if (opts.now) toast.error(`Workouts could not be brought in from ${name}: ${(e as Error).message}`);
      return null;
    }
  })().finally(() => { running = null; });
  return running;
}
