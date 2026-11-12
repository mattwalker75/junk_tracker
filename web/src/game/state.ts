/**
 * The game's data on the page: GET /api/game (reads never write), the sync that settles a KO or a
 * missed deadline when the view says `needsSync`, and "what just happened" — the events a sync or
 * any game change returned, queued as the Victory / Strike / Knocked back / Defeated / finish
 * screens (Results.tsx) and toasts.
 */
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { EventView, GameView, SyncResult } from "../../../shared/game/types";
import type { Day } from "../../../shared/types";
import { api } from "../lib/api";
import { nowTime } from "../lib/dates";
import { useToday } from "../lib/useToday";
import { planResults, type Result } from "./outcomes";

// ---------------------------------------------------------------- what just happened
/** A result screen waiting to be seen; `shown` once its overlay is up (the battle screen plays its KO or strike first). */
export interface QueuedResult { result: Result; shown: boolean }
let queue: QueuedResult[] = [];
let toasts: EventView[] = [];
const seen = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Tell about what a game change settled: big results queue up one after another, the rest are toasts. */
export function pushHappened(events: EventView[]): void {
  const fresh = events.filter((e) => !seen.has(e.id));
  if (!fresh.length) return;
  for (const e of fresh) seen.add(e.id);
  const plan = planResults(fresh);
  if (!plan.results.length && !plan.toasts.length) return;
  queue = [...queue, ...plan.results.map((result) => ({ result, shown: false }))];
  toasts = [...toasts, ...plan.toasts].slice(-4);
  emit();
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
  emit();
}
export function clearResults(): void { if (queue.length || toasts.length) { queue = []; toasts = []; emit(); } }
export function useToasts(): EventView[] { return useSyncExternalStore(subscribe, () => toasts, () => toasts); }
export function dropToast(id: string): void { const t = toasts.filter((e) => e.id !== id); if (t.length !== toasts.length) { toasts = t; emit(); } }

// ---------------------------------------------------------------- the view and the sync
export const gameKey = (today: Day) => ["game", today] as const;

/** Store what a game change returned, and tell about what happened. */
export function applyResult(qc: QueryClient, today: Day, r: SyncResult): SyncResult {
  qc.setQueryData(gameKey(today), r.view);
  pushHappened(r.happened);
  return r;
}

/** After a log change in game mode: settle (a KO opens the next fight at once) and refresh the view. */
export async function syncAfterLog(qc: QueryClient, today: Day): Promise<SyncResult | null> {
  try { return applyResult(qc, today, await api.gameSync(today, nowTime())); }
  catch { void qc.invalidateQueries({ queryKey: ["game"] }); return null; }
}

/** The game view for today, settled first whenever the server says something is waiting. */
export function useGame(enabled = true): { today: Day; view: GameView | undefined; error: Error | null; loading: boolean } {
  const qc = useQueryClient();
  const today = useToday();
  const q = useQuery({ queryKey: gameKey(today), queryFn: () => api.game(today, nowTime()), enabled });
  const syncing = useRef<GameView | null>(null);
  useEffect(() => {
    const v = q.data;
    if (!v?.needsSync || syncing.current === v) return;
    syncing.current = v;
    void syncAfterLog(qc, today);
  }, [q.data, qc, today]);
  return { today, view: q.data, error: q.error, loading: q.isPending };
}
