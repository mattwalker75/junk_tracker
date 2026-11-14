/**
 * The game's data on the page: GET /api/game (reads never write), the sync that settles a KO or a
 * missed deadline when the view says `needsSync`, and "what just happened" — the events a sync or
 * any game change returned, queued as the Victory / Strike / Knocked back / Defeated / finish
 * screens (Results.tsx) and toasts.
 */
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import type { EventView, GameView, SyncResult } from "../../../shared/game/types";
import type { Day } from "../../../shared/types";
import { api } from "../lib/api";
import { nowTime } from "../lib/dates";
import { useToday } from "../lib/useToday";
import { planResults, type Result } from "./outcomes";

// ---------------------------------------------------------------- what just happened
/**
 * A result screen waiting to be seen; `shown` once its overlay is up (the battle screen plays its KO
 * or strike first). `mark` is the newest event before it: while it waits, that is how far the
 * person has seen, so a reload or a killed tab brings it back.
 */
export interface QueuedResult { result: Result; shown: boolean; mark: string | null }
let queue: QueuedResult[] = [];
let toasts: EventView[] = [];
let seen = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

// whose game this is: the queue and the toasts are one person's (Switch to, sign out and back in
// as someone else start afresh), and how far they have seen is kept in the browser per person
let person: string | null = null;
let runId: string | null = null;
/** the newest event told about (null: none yet in this run) */
let newest: string | null = null;
let ready = false;
const seenKey = (p: string) => `jt-game-seen:${p}`;
function readSeen(p: string): { run: string | null; id: string | null } | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(seenKey(p)) ?? "null") as unknown;
    return v && typeof v === "object" ? { run: String((v as { run?: unknown }).run ?? "") || null, id: (v as { id?: unknown }).id ? String((v as { id: unknown }).id) : null } : null;
  } catch { return null; }
}
function saveSeen(): void {
  if (!person || !ready) return;
  // with a result still waiting, only what came before it has been seen
  const id = queue.length ? queue[0].mark : newest;
  try { window.localStorage.setItem(seenKey(person), JSON.stringify({ run: runId, id })); } catch {}
}

/** The game page says whose game is on screen; a different person starts with an empty queue. */
export function setGamePerson(p: string): void {
  if (p === person) return;
  person = p; runId = null; newest = null; ready = false;
  queue = []; toasts = []; seen = new Set();
}

/**
 * The first view for this person since the page loaded: bring back what they hadn't seen yet (a
 * reload or a killed tab in the middle of a Victory). With nothing kept (the first time on this
 * phone), old history isn't replayed; it is only noted as seen.
 */
function startFrom(view: GameView): void {
  if (ready || !person) return;
  ready = true;
  runId = view.run?.id ?? null;
  const events = view.events; // newest first
  const kept = readSeen(person);
  let fresh: EventView[] = [];
  if (kept && runId) {
    const at = kept.id ? events.findIndex((e) => e.id === kept.id) : -1;
    if (at >= 0) fresh = events.slice(0, at);
    else if (kept.run === runId || !kept.id) fresh = events;
    else {
      // a run started elsewhere since: what happened after its start
      const start = events.findIndex((e) => e.kind === "run_start");
      fresh = start >= 0 ? events.slice(0, start) : events;
    }
  }
  newest = events[0]?.id ?? null;
  for (const e of events) if (!fresh.includes(e)) seen.add(e.id);
  if (fresh.length) pushHappened([...fresh].reverse());
  else saveSeen();
}

/** Tell about what a game change settled: big results queue up one after another, the rest are toasts. */
export function pushHappened(events: EventView[]): void {
  const fresh = events.filter((e) => !seen.has(e.id));
  if (!fresh.length) return;
  for (const e of fresh) seen.add(e.id);
  const before = newest;
  newest = fresh[fresh.length - 1].id;
  const plan = planResults(fresh);
  queue = [...queue, ...plan.results.map((result) => {
    const i = fresh.findIndex((e) => e.id === result.id);
    return { result, shown: false, mark: i > 0 ? fresh[i - 1].id : before };
  })];
  toasts = [...toasts, ...plan.toasts].slice(-4);
  saveSeen();
  if (plan.results.length || plan.toasts.length) emit();
}
/** The result on screen (or about to be) and how many more wait behind it. */
export function useResults(): { head: QueuedResult | null; waiting: number } {
  const q = useSyncExternalStore(subscribe, () => queue, () => queue);
  return { head: q[0] ?? null, waiting: Math.max(0, q.length - 1) };
}
export function markShown(id: string): void {
  if (queue[0]?.result.id !== id || queue[0].shown) return;
  queue = [{ ...queue[0], shown: true }, ...queue.slice(1)];
  emit();
}
/** Close the result on screen; the next one (if any) comes up at once (the battle scene played for the first). */
export function nextResult(): void {
  if (!queue.length) return;
  queue = queue.slice(1).map((q, i) => (i === 0 ? { ...q, shown: true } : q));
  saveSeen();
  emit();
}
/** "Skip all": everything waiting counts as seen. */
export function clearResults(): void {
  if (queue.length || toasts.length) { queue = []; toasts = []; saveSeen(); emit(); }
}
/**
 * A new run was just started on this phone: what settled in the old run is moot, so the queue starts
 * empty and only what came after the new run's start is told (fight 1 counts the whole of today,
 * so a workout logged earlier can KO Crumbs at once).
 */
export function startedRun(r: SyncResult): EventView[] {
  queue = []; toasts = [];
  const start = r.happened.findIndex((e) => e.kind === "run_start");
  for (const e of r.happened.slice(0, start + 1)) seen.add(e.id);
  runId = r.view.run?.id ?? null;
  newest = start >= 0 ? r.happened[start].id : newest;
  ready = true;
  emit();
  return r.happened.slice(start + 1);
}
export function useToasts(): EventView[] { return useSyncExternalStore(subscribe, () => toasts, () => toasts); }
export function dropToast(id: string): void { const t = toasts.filter((e) => e.id !== id); if (t.length !== toasts.length) { toasts = t; emit(); } }

// ---------------------------------------------------------------- the view and the sync
export const gameKey = (today: Day) => ["game", today] as const;

/** Store what a game change returned, and tell about what happened. */
export function applyResult(qc: QueryClient, today: Day, r: SyncResult): SyncResult {
  // a read that left before this change would bring the old view back: drop it
  void qc.cancelQueries({ queryKey: ["game"] });
  qc.setQueryData(gameKey(today), r.view);
  if (r.view.run) runId = r.view.run.id;
  pushHappened(r.happened);
  return r;
}

/** After a log change in game mode: settle (a KO opens the next fight at once) and refresh the view. */
export async function syncAfterLog(qc: QueryClient, today: Day): Promise<SyncResult | null> {
  try { return applyResult(qc, today, await api.gameSync(today, nowTime())); }
  catch { void qc.invalidateQueries({ queryKey: ["game"] }); return null; }
}

// one sync at a time when a view says needsSync, however many screens read the view
let autoSync: Promise<unknown> | null = null;
let autoSyncedFor: GameView | null = null;

/**
 * Keep the monsters coming (Settings → You, Matt Nov 14 2026): before the first game view of the
 * day, ask the server whether the next fight (or a new run) should start by itself. It decides (the
 * setting, once a day per person on any phone, only when nothing is going and nothing went down
 * today); this page asks once per person and day. A new run is told like one started from Start a
 * run; anything else the look settled (a KO from yesterday, a missed deadline) is told as usual, and
 * a fight or run that started by itself gets a toast.
 */
const checked = new Map<string, Promise<void>>();
function dailyCheck(today: Day): Promise<void> {
  if (!person) return Promise.resolve();
  const key = `${person}|${today}`;
  let p = checked.get(key);
  if (!p) {
    p = api.gameAuto(today, nowTime()).then((r) => {
      // the setting is off: ask again next time (it may be turned on later today)
      if (!r.checked) checked.delete(key);
      if (!r.checked) return;
      if (r.started !== "run") { pushHappened(r.happened); return; }
      const rest = startedRun(r);
      const start = r.happened.find((e) => e.kind === "run_start");
      if (start) { toasts = [...toasts, start]; emit(); }
      pushHappened(rest);
    }, () => { checked.delete(key); /* the game still opens; it asks again next time */ });
    checked.set(key, p);
  }
  return p;
}

/** The game view for today, settled first whenever the server says something is waiting. */
export function useGame(enabled = true): { today: Day; view: GameView | undefined; error: Error | null; loading: boolean } {
  const qc = useQueryClient();
  const today = useToday();
  const q = useQuery({ queryKey: gameKey(today), queryFn: async () => { await dailyCheck(today); return api.game(today, nowTime()); }, enabled });
  // disabled (e.g. the log sheets on tracker pages) means no game at all: no cached view, no sync —
  // the tracker never shows game visuals (Matt, Nov 12 2026)
  useEffect(() => {
    const v = enabled ? q.data : undefined;
    if (!v) return;
    startFrom(v);
    if (!v.needsSync || autoSyncedFor === v || autoSync) return;
    autoSyncedFor = v;
    autoSync = syncAfterLog(qc, today).finally(() => { autoSync = null; });
  }, [enabled, q.data, qc, today]);
  return { today, view: enabled ? q.data : undefined, error: enabled ? q.error : null, loading: enabled && q.isPending };
}
