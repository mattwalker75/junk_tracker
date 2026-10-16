/** The full calendar: a month at a time, days coloured by their biggest splurge, weigh-in days marked, the month's totals and list. */
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SIZE_LABEL } from "../../../shared/types";
import { useActions } from "../lib/actions";
import { api } from "../lib/api";
import { useToday } from "../lib/useToday";
import { addDays, addMonths, dayNum, monthEnd, monthLabel, monthOf, monthStart, shortDay, today as todayOf, WEEKDAY_TINY, weekday } from "../lib/dates";
import { go } from "../lib/route";
import { byDay, inUnit, worstSize } from "../lib/stats";
import { Card, cx, SIZE_DOT, SIZE_FILL, SizeLegend } from "./ui";

export function CalendarPage({ month }: { month: string | null }) {
  const act = useActions();
  const today = useToday();
  const ym = month && month <= monthOf(today) ? month : monthOf(today);
  const from = monthStart(ym), to = monthEnd(ym);
  const overview = useQuery({ queryKey: ["overview", today], queryFn: () => api.overview(today) });
  const splurges = useQuery({ queryKey: ["month", "splurges", ym], queryFn: () => api.splurges(from, to) });
  const weighs = useQuery({ queryKey: ["month", "weigh", ym], queryFn: () => api.weighIns(from, to) });
  const weekStart = overview.data?.settings.weekStart ?? 0;
  const unit = overview.data?.settings.units ?? "lb";
  const days = byDay(splurges.data ?? []);
  const weighDays = new Set((weighs.data ?? []).map((w) => w.day));

  const lead = (weekday(from) - weekStart + 7) % 7;
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: dayNum(to) }, (_, i) => addDays(from, i))];
  const heads = Array.from({ length: 7 }, (_, i) => WEEKDAY_TINY[(i + weekStart) % 7]);

  const lastDay = ym === monthOf(today) ? today : to;
  const elapsed = dayNum(lastDay);
  const splurgeDays = [...days.keys()].filter((d) => d <= lastDay).length;
  const w = weighs.data ?? [];
  const change = w.length >= 2 ? inUnit(w.at(-1)!.pounds - w[0].pounds, unit) : null;
  const list = splurges.data ?? [];

  return (
    <main className="pb-safe">
      <header className="flex items-center gap-1 px-2 pt-3 pb-1">
        <a href="#/" aria-label="Back to home" className="grid size-11 place-items-center rounded-xl hover:bg-surface-2"><ChevronLeft className="size-6" /></a>
        <h1 className="text-lg font-extrabold">Calendar</h1>
      </header>

      <div className="space-y-2.5 px-4">
        <Card className="px-3 pt-3 pb-3.5">
          <div className="flex items-center justify-between px-0.5 pb-2.5">
            <button aria-label="Previous month" onClick={() => go(`/calendar/${addMonths(ym, -1)}`)} className="grid size-10 place-items-center rounded-xl border border-line"><ChevronLeft className="size-4" /></button>
            <h2 className="text-[17px] font-extrabold">{monthLabel(ym)}</h2>
            <button aria-label="Next month" disabled={ym >= monthOf(today)} onClick={() => go(`/calendar/${addMonths(ym, 1)}`)} className="grid size-10 place-items-center rounded-xl border border-line disabled:opacity-35"><ChevronRight className="size-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {heads.map((h) => <span key={h} className="pb-0.5 text-[11px] font-bold text-faint">{h}</span>)}
            {cells.map((d, i) => {
              if (!d) return <span key={`x${i}`} />;
              const future = d > today;
              const size = worstSize(days.get(d) || []);
              return (
                <button key={d} disabled={future} onClick={() => act.day(d)}
                  aria-label={`${shortDay(d, today)}${size ? `: ${SIZE_LABEL[size]}` : ""}${weighDays.has(d) ? ", weighed in" : ""}`}
                  className={cx("tabular flex h-12 flex-col items-center justify-center gap-1 rounded-[11px] text-sm",
                    future ? "text-faint/60" : size ? cx(SIZE_FILL[size], "font-extrabold") : "bg-surface-2 text-ink-2",
                    d === today && "outline-2 -outline-offset-2 outline-ink font-extrabold")}>
                  <span>{dayNum(d)}</span>
                  <span className={cx("h-[3px] w-3 rounded-full", weighDays.has(d) ? (size ? "bg-current opacity-80" : "bg-accent") : "")} />
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1"><SizeLegend /><span className="inline-flex items-center gap-1.5 text-xs text-mute"><span className="h-[3px] w-3 rounded-full bg-accent" />Weigh-in</span></div>
        </Card>

        <div className="grid grid-cols-3 gap-2">
          <Card className="px-3 py-2.5"><div className="text-xs font-semibold text-mute">{monthLabel(ym).split(" ")[0]}</div><div className="tabular text-[22px] font-extrabold">{list.length}</div><div className="text-xs text-mute">{list.length === 1 ? "splurge" : "splurges"}</div></Card>
          <Card className="px-3 py-2.5"><div className="text-xs font-semibold text-mute">Clean days</div><div className="tabular text-[22px] font-extrabold">{Math.max(0, elapsed - splurgeDays)}</div><div className="text-xs text-mute">of {elapsed}</div></Card>
          <Card className="px-3 py-2.5"><div className="text-xs font-semibold text-mute">Weight</div>
            <div className={cx("tabular text-[22px] font-extrabold", change === null ? "" : change < 0 ? "text-good" : change > 0 ? "text-bad" : "")}>{change === null ? "—" : `${change > 0 ? "+" : change < 0 ? "−" : ""}${Math.abs(change)}`}</div>
            <div className="text-xs text-mute">{change === null ? "needs 2 weigh-ins" : `${unit} this month`}</div></Card>
        </div>

        {list.length ? (
          <Card className="px-4 py-1">
            {list.map((s, i) => (
              <button key={s.id} onClick={() => act.day(s.day)} className={cx("flex w-full items-center gap-3 py-3 text-left", i > 0 && "border-t border-line")}>
                <span className={cx("size-2.5 shrink-0 rounded-[3px]", SIZE_DOT[s.size])} />
                <span className="min-w-0 flex-1 truncate font-semibold">{s.what}</span>
                <span className="shrink-0 text-[13px] text-mute">{shortDay(s.day, today)}</span>
              </button>
            ))}
          </Card>
        ) : splurges.data ? <p className="px-1 py-2 text-center text-sm text-mute">No splurges in {monthLabel(ym)}.</p> : null}
        <p className="pb-4 text-center text-xs text-faint">Tap any day to open it</p>
      </div>
    </main>
  );
}
