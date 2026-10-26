/**
 * The goal now, at the top of Home: a sticky note in handwriting (mockup G3, Matt's pick, Oct 26
 * 2026) that is there every time the app opens. Done checks it off and the next goal moves up, with
 * a strip that says so (and Undo). When its time is up the note asks whether it was done: Yes, done
 * — or Keep going, which leaves it up with no end date. Tapping the words opens Goals.
 */
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Day, Goal, Overview } from "../../../shared/types";
import { GOAL_KEYS, refresh } from "../lib/actions";
import { api } from "../lib/api";
import { goalLine, goalProgress, timeUp } from "../lib/stats";

export function GoalNote({ o, today }: { o: Overview; today: Day }) {
  const qc = useQueryClient();
  const [checked, setChecked] = useState<Goal | null>(null);
  const [busy, setBusy] = useState(false);
  // "Checked off" stays a little while, long enough to undo
  useEffect(() => { if (!checked) return; const t = window.setTimeout(() => setChecked(null), 12_000); return () => window.clearTimeout(t); }, [checked]);

  const g = o.goal;
  const p = g ? goalProgress(g, today) : null;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); void refresh(qc, GOAL_KEYS); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const done = () => run(async () => { if (g) { await api.goalDone(g.id, today); setChecked(g); } });
  const undo = () => run(async () => { if (checked) { await api.reopenGoal(checked.id, today); setChecked(null); } });
  const keepGoing = () => run(async () => { if (g) { await api.saveGoal(g.id, { text: g.text, days: null }); toast.success("It stays up until you check it off."); } });

  if (!g && !checked) return null;
  const pill = "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[15px] font-extrabold disabled:opacity-60";
  return (
    <>
      {checked ? (
        <div role="status" className="flex items-center gap-2 rounded-xl bg-good/12 px-3 py-1 text-sm font-bold text-good">
          <Check className="size-4 shrink-0" strokeWidth={3} aria-hidden />
          <span className="min-w-0 flex-1 py-1.5 [overflow-wrap:anywhere]">Checked off: {checked.text}{!g ? <> · <a href="#/goals" className="underline">add another</a></> : null}</span>
          <button onClick={() => void undo()} disabled={busy} className="min-h-9 shrink-0 px-1 text-[13px] font-extrabold underline">Undo</button>
        </div>
      ) : null}
      {g ? (
        <div className="relative px-1.5 pt-2.5 pb-1">
          {/* a bit of tape holding it up */}
          <span aria-hidden className="absolute top-0.5 left-1/2 z-10 h-5 w-[86px] -translate-x-1/2 -rotate-3 border border-black/5 bg-white/60" />
          <section aria-label="Your goal" className="-rotate-[1.2deg] rounded-[4px_4px_14px_4px] bg-note px-[18px] pt-[18px] pb-3.5 text-note-ink shadow-note">
            <a href="#/goals" className="block" aria-label={`My goal: ${g.text}. Open your goals.`}>
              <div className="text-xs font-extrabold tracking-[0.1em] text-note-mute uppercase">My goal</div>
              <div className="mt-0.5 font-hand text-[36px] leading-[1.02] font-bold [overflow-wrap:anywhere]">{g.text}</div>
            </a>
            {p?.over && g.days ? (
              <div className="mt-2.5">
                <p className="text-[15px] font-bold">{timeUp(g.days)} — did you do it?</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => void keepGoing()} disabled={busy} className={`${pill} flex-1 border-2 border-note-ink/60`}>Keep going</button>
                  <button onClick={() => void done()} disabled={busy} className={`${pill} flex-1 bg-note-ink text-note`}><Check className="size-4" strokeWidth={3} aria-hidden />Yes, done</button>
                </div>
              </div>
            ) : (
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <span className="text-[13px] font-bold text-note-mute">{goalLine(g, today, o.goalSplurges)}</span>
                <button onClick={() => void done()} disabled={busy} aria-label={`Done: ${g.text}`} className={`${pill} bg-note-ink text-note`}><Check className="size-4" strokeWidth={3} aria-hidden />Done</button>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
