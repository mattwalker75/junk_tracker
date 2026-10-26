/**
 * Goals (from the menu under your initials; mocked up and approved, Oct 26 2026): the goal now — the
 * one on Home — with "I did it", the goals up next in order (up and down move them; up from second
 * place makes one the goal now), Add a goal, and the ones checked off. Tap a goal to change it.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronLeft, ChevronUp, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Goal } from "../../../shared/types";
import { GOAL_KEYS, refresh } from "../lib/actions";
import { api } from "../lib/api";
import { useToday } from "../lib/useToday";
import { shortDay } from "../lib/dates";
import { goalLine, periodLabel } from "../lib/stats";
import { Card, cx } from "./ui";
import { GoalSheet } from "./GoalSheet";

export function GoalsPage() {
  const qc = useQueryClient();
  const today = useToday();
  const q = useQuery({ queryKey: ["goals", today], queryFn: () => api.goals(today) });
  const [sheet, setSheet] = useState<{ edit?: Goal } | null>(null);
  const [checked, setChecked] = useState<Goal | null>(null);
  const [busy, setBusy] = useState(false);

  const open = q.data?.open ?? [];
  const done = q.data?.done ?? [];
  const now = open[0];
  // `after` runs once the list is fresh, so "Up next" names the goal that really is next
  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    try { await fn(); await refresh(qc, GOAL_KEYS); after?.(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const checkOff = (g: Goal) => run(() => api.goalDone(g.id, today), () => setChecked(g));
  const undo = (g: Goal) => run(() => api.reopenGoal(g.id, today), () => setChecked(null));
  const move = (g: Goal, dir: "up" | "down") => run(() => api.moveGoal(g.id, dir, today), () => setChecked(null));
  const arrow = "grid size-10 shrink-0 place-items-center rounded-xl border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-35";

  return (
    <main className="pb-safe">
      <header className="flex items-center gap-1 px-2 pt-3 pb-1">
        <a href="#/" aria-label="Back to home" className="grid size-11 place-items-center rounded-xl hover:bg-surface-2"><ChevronLeft className="size-6" /></a>
        <h1 className="text-lg font-extrabold">Goals</h1>
      </header>
      <p className="px-5 pb-3 text-sm leading-snug text-mute">The goal at the top is the one on your Home screen. Check it off when you have done it, and the next one moves up. A goal's days start when it reaches the top.</p>

      <div className="space-y-2.5 px-4 pb-8">
        {q.isError ? <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{q.error.message}</p> : null}

        {checked ? (
          <div role="status" className="flex items-center gap-2.5 rounded-2xl bg-good/12 px-3 py-2 text-good">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-good text-surface"><Check className="size-4" strokeWidth={3} aria-hidden /></span>
            <span className="min-w-0 flex-1 text-sm leading-snug [overflow-wrap:anywhere]">
              <strong>Goal done!</strong> {now ? `Up next on your Home screen: ${now.text}.` : "That was the last one — add another when you are ready."}
            </span>
            <button onClick={() => void undo(checked)} disabled={busy} className="min-h-9 shrink-0 px-1 text-[13px] font-extrabold underline">Undo</button>
          </div>
        ) : null}

        {now ? (
          <section className="rounded-[20px] border-2 border-accent bg-accent-soft px-4 pt-3.5 pb-4">
            <div className="text-xs font-extrabold tracking-[0.1em] text-accent-text uppercase">Now · on your Home screen</div>
            <button onClick={() => setSheet({ edit: now })} className="mt-1 block w-full text-left" aria-label={`Change the goal: ${now.text}`}>
              <span className="block text-[23px] leading-tight font-black tracking-tight [overflow-wrap:anywhere]">{now.text}</span>
              <span className="mt-1 block text-[13px] font-semibold text-ink-2">{goalLine(now, today, q.data?.goalSplurges ?? 0) || (now.days ? periodLabel(now.days) : "No end date")}</span>
            </button>
            <button onClick={() => void checkOff(now)} disabled={busy}
              className="mt-3 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-accent text-base font-extrabold text-accent-ink hover:brightness-105 disabled:opacity-60">
              <Check className="size-[18px]" strokeWidth={3} aria-hidden />I did it — check it off
            </button>
          </section>
        ) : q.data ? (
          <section className="rounded-[20px] border-2 border-dashed border-line-2 p-4 text-center text-sm text-mute">No goal right now. Add one and it goes on your Home screen.</section>
        ) : <div className="h-40 animate-pulse rounded-[20px] bg-surface-2" />}

        {open.length > 1 ? (
          <>
            <h2 className="px-1 pt-1.5 text-xs font-bold tracking-[0.08em] text-mute uppercase">Up next</h2>
            <Card className="pr-1.5 pl-3.5">
              {open.slice(1).map((g, k) => {
                const i = k + 1;
                return (
                  <div key={g.id} className={cx("flex items-center gap-2.5 py-2.5", k > 0 && "border-t border-line")}>
                    <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-extrabold text-ink-2">{i + 1}</span>
                    <button onClick={() => setSheet({ edit: g })} className="min-w-0 flex-1 py-1 text-left" aria-label={`Change: ${g.text}`}>
                      <span className="block leading-snug font-bold [overflow-wrap:anywhere]">{g.text}</span>
                      <span className="block text-xs text-mute">{g.days ? periodLabel(g.days) : "No end date"}</span>
                    </button>
                    <button onClick={() => void move(g, "up")} disabled={busy} aria-label={i === 1 ? `Make “${g.text}” the goal now` : `Move “${g.text}” up`} className={arrow}><ChevronUp className="size-[18px]" /></button>
                    <button onClick={() => void move(g, "down")} disabled={busy || i === open.length - 1} aria-label={`Move “${g.text}” down`} className={arrow}><ChevronDown className="size-[18px]" /></button>
                  </div>
                );
              })}
            </Card>
          </>
        ) : null}

        <button onClick={() => setSheet({})} className="flex h-[50px] w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-line-2 text-[15px] font-extrabold text-accent-text hover:bg-surface-2">
          <Plus className="size-[18px]" strokeWidth={2.6} aria-hidden />Add a goal
        </button>

        {done.length ? (
          <>
            <h2 className="px-1 pt-1.5 text-xs font-bold tracking-[0.08em] text-mute uppercase">Done · {q.data?.doneCount ?? done.length}</h2>
            <Card className="px-3.5">
              {done.map((g, k) => (
                <div key={g.id} className={cx("flex items-center gap-2.5 py-2.5", k > 0 && "border-t border-line")}>
                  <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-good text-surface"><Check className="size-3.5" strokeWidth={3} aria-hidden /></span>
                  <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink-2 [overflow-wrap:anywhere]">{g.text}</span>
                  <span className="shrink-0 text-xs text-mute">{g.doneOn ? shortDay(g.doneOn, today) : ""}</span>
                </div>
              ))}
            </Card>
          </>
        ) : null}
      </div>

      <GoalSheet open={!!sheet} onOpenChange={(o) => { if (!o) setSheet(null); }} edit={sheet?.edit} hasGoals={open.length > 0} />
    </main>
  );
}
