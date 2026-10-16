/** A day opened from the 14-day strip or the calendar: its splurges, its weigh-in, and ways to add to it. */
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Day } from "../../../shared/types";
import { useActions } from "../lib/actions";
import { api } from "../lib/api";
import { addDays, ago, clock, longDay, today as todayOf } from "../lib/dates";
import { inUnit } from "../lib/stats";
import { Button, Sheet, SizeBadge } from "./ui";

export function DaySheet({ day, onClose }: { day: Day | null; onClose: () => void }) {
  const act = useActions();
  const today = todayOf();
  const d = day ?? today;
  const splurges = useQuery({ queryKey: ["day", "splurges", d], queryFn: () => api.splurges(d, d), enabled: !!day });
  const weigh = useQuery({ queryKey: ["day", "weigh", d], queryFn: () => api.weighIns(d, d), enabled: !!day });
  const settings = useQuery({ queryKey: ["overview", today], queryFn: () => api.overview(today), enabled: !!day });
  const unit = settings.data?.settings.units ?? "lb";
  const w = weigh.data?.[0];
  const list = [...(splurges.data ?? [])].sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));

  const nav = (
    <>
      <button className="grid size-10 place-items-center rounded-xl border border-line-2" aria-label="Previous day" onClick={() => act.day(addDays(d, -1))}><ChevronLeft className="size-5" /></button>
      <button className="grid size-10 place-items-center rounded-xl border border-line-2 disabled:opacity-40" aria-label="Next day" disabled={d >= today} onClick={() => act.day(addDays(d, 1))}><ChevronRight className="size-5" /></button>
    </>
  );

  return (
    <Sheet open={!!day} onOpenChange={(o) => { if (!o) onClose(); }} title={longDay(d, today)} subtitle={ago(d, today)} actions={nav}>
      <div className="space-y-3 pb-2">
        {splurges.isError ? <p className="text-sm text-danger">{splurges.error.message}</p> : null}
        {splurges.data && !list.length ? (
          <div className="rounded-2xl bg-surface-2 px-4 py-3">
            <div className="font-bold text-good">No splurge</div>
            <div className="text-sm text-mute">{d === today ? "Nothing logged today." : "A clean day."}</div>
          </div>
        ) : null}
        {list.map((s) => (
          <article key={s.id} className="rounded-2xl border border-line p-3.5">
            <div className="flex items-center gap-2"><SizeBadge size={s.size} />{s.time ? <span className="text-[13px] text-mute">{clock(s.time)}</span> : null}</div>
            <div className="mt-1.5 text-lg leading-snug font-extrabold [overflow-wrap:anywhere]">{s.what}</div>
            {s.where || s.calories !== null ? <div className="text-sm text-mute">{[s.where, s.calories !== null ? `${s.calories.toLocaleString()} cal` : ""].filter(Boolean).join(" · ")}</div> : null}
            {s.notes ? <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{s.notes}</p> : null}
            <div className="mt-3"><Button size="sm" onClick={() => { onClose(); act.log({ edit: s }); }}>Edit</Button></div>
          </article>
        ))}
        <button onClick={() => { onClose(); act.weigh(d); }} className="flex w-full items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-left">
          <span className="font-bold">Weigh-in</span>
          <span className="tabular font-extrabold">{w ? `${inUnit(w.pounds, unit)} ${unit}` : <span className="text-sm font-semibold text-mute">none — add one</span>}</span>
        </button>
        <Button size="lg" className="w-full border-dashed" onClick={() => { onClose(); act.log({ day: d }); }}>+ Add a splurge to this day</Button>
      </div>
    </Sheet>
  );
}
