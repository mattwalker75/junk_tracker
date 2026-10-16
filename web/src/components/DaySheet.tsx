/**
 * A day opened from the 14-day strip or the calendar: a one-line summary of the day, its splurges
 * (size, time, what, where and calories as labelled details, notes in their own box, Edit), its
 * weigh-in, and a way to add a splurge to it.
 */
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Flame, MapPin, Pencil, Scale } from "lucide-react";
import type { ReactNode } from "react";
import { SIZE_LABEL, type Day, type Splurge } from "../../../shared/types";
import { useActions } from "../lib/actions";
import { api } from "../lib/api";
import { addDays, ago, clock, longDay, today as todayOf } from "../lib/dates";
import { inUnit, worstSize } from "../lib/stats";
import { Button, cx, Sheet, SIZE_DOT, SizeBadge } from "./ui";

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
  const biggest = worstSize(list);
  const calories = list.reduce((n, s) => n + (s.calories ?? 0), 0);

  const nav = (
    <>
      <button className="grid size-10 place-items-center rounded-xl border border-line-2" aria-label="Previous day" onClick={() => act.day(addDays(d, -1))}><ChevronLeft className="size-5" /></button>
      <button className="grid size-10 place-items-center rounded-xl border border-line-2 disabled:opacity-40" aria-label="Next day" disabled={d >= today} onClick={() => act.day(addDays(d, 1))}><ChevronRight className="size-5" /></button>
    </>
  );

  return (
    <Sheet open={!!day} onOpenChange={(o) => { if (!o) onClose(); }} title={longDay(d, today)} subtitle={ago(d, today)} actions={nav}>
      <div className="space-y-4 pb-2">
        {splurges.isError ? <p className="text-sm text-danger">{splurges.error.message}</p> : null}

        {/* the day at a glance */}
        {list.length ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-surface-2 px-4 py-2.5 text-sm">
            <span className="flex items-center gap-1.5 font-bold"><span className={cx("size-2.5 rounded-full", biggest && SIZE_DOT[biggest])} />{list.length} {list.length === 1 ? "splurge" : "splurges"}</span>
            {biggest && list.length > 1 ? <span className="text-mute">biggest: {SIZE_LABEL[biggest]}</span> : null}
            {calories ? <span className="tabular text-mute">{calories.toLocaleString()} cal logged</span> : null}
          </div>
        ) : splurges.data ? (
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-good/15 text-good"><Check className="size-5" strokeWidth={3} /></span>
            <div>
              <div className="font-bold text-good">No splurge</div>
              <div className="text-sm text-mute">{d === today ? "Nothing logged today." : "A clean day."}</div>
            </div>
          </div>
        ) : null}

        {list.length ? (
          <section className="space-y-2.5">
            <SectionTitle>Splurges</SectionTitle>
            {list.map((s) => <SplurgeCard key={s.id} s={s} onEdit={() => { onClose(); act.log({ edit: s }); }} />)}
          </section>
        ) : null}

        <section className="space-y-2.5">
          <SectionTitle>Weight</SectionTitle>
          <button onClick={() => { onClose(); act.weigh(d); }} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left hover:bg-surface-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2"><Scale className="size-[18px]" /></span>
            <span className="flex-1">
              <span className="block font-bold">Weigh-in</span>
              <span className="block text-[13px] text-mute">{w ? "Tap to change it" : "None this day — tap to add one"}</span>
            </span>
            {w ? <span className="tabular text-xl font-extrabold">{inUnit(w.pounds, unit)}<span className="ml-1 text-sm font-semibold text-mute">{unit}</span></span> : null}
            <ChevronRight className="size-4 text-mute" />
          </button>
        </section>

        <Button size="lg" className="w-full border-dashed" onClick={() => { onClose(); act.log({ day: d }); }}>+ Add a splurge to this day</Button>
      </div>
    </Sheet>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="px-1 text-xs font-bold tracking-[0.08em] text-mute uppercase">{children}</h3>;
}

function SplurgeCard({ s, onEdit }: { s: Splurge; onEdit: () => void }) {
  const details: { icon: ReactNode; text: string; label: string }[] = [];
  if (s.where) details.push({ icon: <MapPin className="size-3.5" />, text: s.where, label: "Where" });
  if (s.calories !== null) details.push({ icon: <Flame className="size-3.5" />, text: `${s.calories.toLocaleString()} cal`, label: "Calories" });
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <SizeBadge size={s.size} />
        {s.time ? <span className="tabular text-[13px] font-semibold text-mute">{clock(s.time)}</span> : null}
        <span className="flex-1" />
        <button onClick={onEdit} aria-label={`Edit ${s.what}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[13px] font-semibold text-ink-2 hover:bg-surface-2">
          <Pencil className="size-3.5" />Edit
        </button>
      </div>
      <div className="mt-2 text-lg leading-snug font-extrabold [overflow-wrap:anywhere]">{s.what}</div>
      {details.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {details.map((x) => (
            <span key={x.label} title={x.label} className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 text-[13px] font-medium text-ink-2 [overflow-wrap:anywhere]">
              <span className="text-mute">{x.icon}</span>{x.text}
            </span>
          ))}
        </div>
      ) : null}
      {s.notes ? (
        <div className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2.5">
          <div className="text-[11px] font-bold tracking-[0.08em] text-mute uppercase">Notes</div>
          <p className="mt-0.5 text-[15px] leading-relaxed whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">{s.notes}</p>
        </div>
      ) : null}
    </article>
  );
}
