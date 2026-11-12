/**
 * A day opened from the 14-day strip or the calendar: a one-line summary of the day, its splurges
 * (size, time, what, where and calories as labelled details, notes in their own box, Edit), its
 * activities (mockup round 4: name, time, minutes, calories burned, notes, Edit and Delete), its
 * weigh-in, and buttons to add a splurge or an activity to it.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Flame, MapPin, Pencil, Scale, Timer, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { SIZE_LABEL, type Activity, type Day, type Splurge } from "../../../shared/types";
import { LOG_KEYS, refresh, useActions } from "../lib/actions";
import { api } from "../lib/api";
import { useToday } from "../lib/useToday";
import { addDays, ago, clock, longDay } from "../lib/dates";
import { caloriesTotal, inUnit, minutesLabel, worstSize } from "../lib/stats";
import { Button, cx, Sheet, SIZE_DOT, SizeBadge } from "./ui";

export function DaySheet({ day, onClose }: { day: Day | null; onClose: () => void }) {
  const act = useActions();
  const today = useToday();
  const d = day ?? today;
  const splurges = useQuery({ queryKey: ["day", "splurges", d], queryFn: () => api.splurges(d, d), enabled: !!day });
  const activities = useQuery({ queryKey: ["day", "activities", d], queryFn: () => api.activities(d, d), enabled: !!day });
  const weigh = useQuery({ queryKey: ["day", "weigh", d], queryFn: () => api.weighIns(d, d), enabled: !!day });
  const settings = useQuery({ queryKey: ["overview", today], queryFn: () => api.overview(today), enabled: !!day });
  const unit = settings.data?.settings.units ?? "lb";
  const w = weigh.data?.[0];
  const list = [...(splurges.data ?? [])].sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  const biggest = worstSize(list);
  const calories = caloriesTotal(list);
  const acts = [...(activities.data ?? [])].sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  const activeMinutes = acts.reduce((n, a) => n + (a.minutes ?? 0), 0);
  const burned = caloriesTotal(acts);
  const subtitle = `${ago(d, today)}${acts.length ? ` · active${activeMinutes ? ` ${minutesLabel(activeMinutes)}` : ""}` : ""}`;

  const nav = (
    <>
      <button className="grid size-10 place-items-center rounded-xl border border-line-2" aria-label="Previous day" onClick={() => act.day(addDays(d, -1))}><ChevronLeft className="size-5" /></button>
      <button className="grid size-10 place-items-center rounded-xl border border-line-2 disabled:opacity-40" aria-label="Next day" disabled={d >= today} onClick={() => act.day(addDays(d, 1))}><ChevronRight className="size-5" /></button>
    </>
  );

  return (
    <Sheet open={!!day} onOpenChange={(o) => { if (!o) onClose(); }} title={longDay(d, today)} subtitle={subtitle} actions={nav}>
      <div className="space-y-4 pb-2">
        {splurges.isError ? <p className="text-sm text-danger">{splurges.error.message}</p> : null}
        {activities.isError ? <p className="text-sm text-danger">{activities.error.message}</p> : null}

        {/* the day at a glance */}
        {list.length ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-surface-2 px-4 py-2.5 text-sm">
            <span className="flex items-center gap-1.5 font-bold"><span className={cx("size-2.5 rounded-full", biggest && SIZE_DOT[biggest])} />{list.length} {list.length === 1 ? "splurge" : "splurges"}</span>
            {biggest && list.length > 1 ? <span className="text-mute">biggest: {SIZE_LABEL[biggest]}</span> : null}
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
            <SectionTitle total={calories !== null ? `${calories.toLocaleString()} cal` : null}>Splurges</SectionTitle>
            {list.map((s) => <SplurgeCard key={s.id} s={s} onEdit={() => { onClose(); act.log({ edit: s }); }} />)}
          </section>
        ) : null}

        {acts.length ? (
          <section className="space-y-2.5">
            <SectionTitle className="text-active-text" total={burned !== null ? `${burned.toLocaleString()} cal burned` : null}>Activity</SectionTitle>
            {acts.map((a) => <ActivityCard key={a.id} a={a} onEdit={() => { onClose(); act.activity({ edit: a }); }} />)}
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

        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" className="border-dashed px-2" aria-label="Add a splurge to this day" onClick={() => { onClose(); act.log({ day: d }); }}>+ Splurge</Button>
          <Button size="lg" variant="ghost" className="border border-dashed border-active px-2 text-active-text hover:bg-active-soft" aria-label="Add an activity to this day" onClick={() => { onClose(); act.activity({ day: d }); }}>+ Activity</Button>
        </div>
      </div>
    </Sheet>
  );
}

/** A section's heading, with its calorie total beside it when any of its entries says (Matt, Nov 9 2026). */
function SectionTitle({ children, className, total }: { children: ReactNode; className?: string; total?: string | null }) {
  return (
    <h3 className={cx("px-1 text-xs font-bold tracking-[0.08em] uppercase", className ?? "text-mute")}>
      {children}{total ? <span className="tabular font-semibold tracking-normal normal-case"> · {total}</span> : null}
    </h3>
  );
}

/** One activity: its time, name, how long and calories burned, notes, and Edit / Delete (Delete asks once more). */
function ActivityCard({ a, onEdit }: { a: Activity; onEdit: () => void }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const details: { icon: ReactNode; text: string; label: string }[] = [];
  if (a.minutes !== null) details.push({ icon: <Timer className="size-3.5" />, text: minutesLabel(a.minutes), label: "How long" });
  if (a.calories !== null) details.push({ icon: <Flame className="size-3.5" />, text: `${a.calories.toLocaleString()} cal burned`, label: "Calories burned" });
  const remove = async () => {
    setBusy(true);
    try { await api.deleteActivity(a.id); void refresh(qc, LOG_KEYS); toast.success("Deleted."); }
    catch (e) { toast.error((e as Error).message); setBusy(false); }
  };
  const small = "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold disabled:opacity-50";
  return (
    <article className="rounded-2xl border border-active/30 bg-active-soft p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 items-center rounded-full bg-active px-2.5 text-xs font-bold text-active-ink">Activity</span>
        {a.time ? <span className="tabular text-[13px] font-semibold text-ink-2">{clock(a.time)}</span> : null}
        <span className="flex-1" />
        {confirm ? (
          <>
            <button onClick={() => setConfirm(false)} className={cx(small, "border-line-2 bg-surface text-ink-2")}>Keep it</button>
            <button onClick={remove} disabled={busy} className={cx(small, "border-line-2 bg-surface text-danger")}>Delete it</button>
          </>
        ) : (
          <>
            <button onClick={onEdit} aria-label={`Edit ${a.what}`} className={cx(small, "border-line-2 bg-surface text-ink-2 hover:bg-surface-2")}><Pencil className="size-3.5" />Edit</button>
            <button onClick={() => setConfirm(true)} aria-label={`Delete ${a.what}`} className={cx(small, "border-line-2 bg-surface text-danger hover:bg-danger-soft")}><Trash2 className="size-3.5" />Delete</button>
          </>
        )}
      </div>
      <div className="mt-2 text-lg leading-snug font-extrabold [overflow-wrap:anywhere]">{a.what}</div>
      {details.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {details.map((x) => (
            <span key={x.label} title={x.label} className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-surface px-2.5 text-[13px] font-medium text-ink-2">
              <span className="text-active-text">{x.icon}</span>{x.text}
            </span>
          ))}
        </div>
      ) : null}
      {a.notes ? (
        <div className="mt-3 rounded-xl bg-surface px-3.5 py-2.5">
          <div className="text-[11px] font-bold tracking-[0.08em] text-mute uppercase">Notes</div>
          <p className="mt-0.5 text-[15px] leading-relaxed whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">{a.notes}</p>
        </div>
      ) : null}
    </article>
  );
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
        {s.planned ? <span title="A planned treat" className="inline-flex h-6 items-center rounded-full bg-surface-2 px-2.5 text-xs font-bold text-ink-2">planned</span> : null}
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
