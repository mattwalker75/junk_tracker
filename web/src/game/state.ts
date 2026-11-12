/**
 * The game's data on the page: GET /api/game (reads never write), the sync that settles a KO or a
 * missed deadline when the view says `needsSync`, and "what just happened" — the events a sync
 * returned, shown on the battle screen until they are dismissed (stage 3 turns the big ones into
 * the Victory / Strike / Knocked back / Defeated overlays).
 */
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { EventView, GameView, SyncResult } from "../../../shared/game/types";
import type { Day } from "../../../shared/types";
import { api } from "../lib/api";
import { nowTime } from "../lib/dates";
import { useToday } from "../lib/useToday";

// ---------------------------------------------------------------- what just happened
let news: EventView[] = [];
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
/** The kinds worth telling about (a shield going up is shown on the shield itself). */
const TELL = new Set(["ko", "strike", "knockback", "defeat", "finish", "heart", "powerup_earned", "run_start"]);

export function pushNews(events: EventView[]): void {
  const fresh = events.filter((e) => TELL.has(e.kind) && !news.some((n) => n.id === e.id));
  if (!fresh.length) return;
  news = [...fresh, ...news].slice(0, 8);
  emit();
}
export function clearNews(): void { if (news.length) { news = []; emit(); } }
export function useNews(): EventView[] {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => news, () => news);
}

// ---------------------------------------------------------------- the view and the sync
export const gameKey = (today: Day) => ["game", today] as const;

/** Store what a game change returned, and tell about what happened. */
export function applyResult(qc: QueryClient, today: Day, r: SyncResult): SyncResult {
  qc.setQueryData(gameKey(today), r.view);
  pushNews(r.happened);
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
