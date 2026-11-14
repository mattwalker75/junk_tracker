/**
 * "Activity this week" opened (Matt, Nov 14 2026): tap the card on Home for the week in detail —
 * days active, time and calories burned, each kind of activity, then the seven days one by one
 * (tap a day to open it, where activities are edited). The arrows step to other weeks.
 */
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { Day } from "../../../shared/types";
import { useActions } from "../lib/actions";
import { api } from "../lib/api";
import { useToday } from "../lib/useToday";
import { addDays, clock, shortDay, WEEKDAY_LONG, weekday } from "../lib/dates";
import { activeWeek, minutesLabel, startOfWeek, weekDetail } from "../lib/stats";
import { cx, Sheet } from "./ui";

export function WeekSheet({ from, weekStart, onFrom, onClose }: { from: Day | null; weekStart: 0 | 1; onFrom: (d: Day) => void; onClose: () => void }) {
  const act = useActions();
  const today = useToday();
  const start = from ?? startOfWeek(today, weekStart);
  const to = addDays(start, 6);
  const thisWeek = startOfWeek(today, weekStart);
  const q = useQuery({ queryKey: ["day", "week", start], queryFn: () => api.activities(start, to), enabled: !!from });
  const list = q.data ?? [];
  const w = activeWeek(list, to < today ? to : today, weekStart);
  const d = weekDetail(list, start, today);
  const title = start === thisWeek ? "Activity this week" : start === addDays(thisWeek, -7) ? "Activity last week" : `Activity · week of ${shortDay(start, today)}`;
  const nav = (
    <>
      <button className="grid size-10 place-items-center rounded-xl border border-line-2" aria-label="Week before" onClick={() => onFrom(addDays(start, -7))}><ChevronLeft className="size-5" /></button>
      <button className="grid size-10 place-items-center rounded-xl border border-line-2 disabled:opacity-40" aria-label="Week after" disabled={start >= thisWeek} onClick={() => onFrom(addDays(start, 7))}><ChevronRight className="size-5" /></button>
    </>
  );
  const open = (day: Day) => { onClose(); act.day(day); };

  return (
    <Sheet open={!!from} onOpenChange={(o) => { if (!o) onClose(); }} title={title} subtitle={`${shortDay(start, today)} – ${shortDay(to, today)}`} actions={nav}>
      <div className="space-y-4 pb-2">
        {q.isError ? <p className="text-sm text-danger">{q.error.message}</p> : null}

        {/* the week at a glance */}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Days active" value={String(w.days)} unit="of 7" strong />
          <Stat label="Time" value={w.minutes ? <Minutes n={w.minutes} /> : "—"} />
          <Stat label="Burned" value={w.calories !== null ? w.calories.toLocaleString() : "—"} unit={w.calories !== null ? "cal" : undefined} />
        </div>
        <p className="px-1 text-sm text-mute">
          {w.count ? `${w.count} ${w.count === 1 ? "activity" : "activities"}` : q.data ? (start === thisWeek ? "Nothing active yet this week." : "Nothing active that week.") : " "}
          {w.count ? ` · the week starts on ${WEEKDAY_LONG[weekStart]}` : ""}
        </p>

        {d.kinds.length ? (
          <section className="space-y-2">
            <Title>By activity</Title>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {d.kinds.map((k) => (
                <li key={k.what.toLowerCase()} className="flex items-baseline gap-2 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate font-bold">{k.what}</span>
                  <span className="tabular shrink-0 text-[13px] text-mute">
                    {[`${k.count}×`, k.minutes ? minutesLabel(k.minutes) : "", k.calories !== null ? `${k.calories.toLocaleString()} cal` : ""].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-2">
          <Title>Day by day</Title>
          <ul className="space-y-1.5">
            {d.days.map((x) => {
              const on = x.list.length > 0;
              const totals = [x.minutes ? minutesLabel(x.minutes) : "", x.calories !== null ? `${x.calories.toLocaleString()} cal` : ""].filter(Boolean).join(" · ");
              return (
                <li key={x.day}>
                  <button onClick={() => open(x.day)} disabled={x.later}
                    className={cx("flex w-full gap-3 rounded-2xl border px-3.5 py-2.5 text-left disabled:opacity-45",
                      on ? "border-active/30 bg-active-soft hover:brightness-[0.98]" : "border-line bg-surface hover:bg-surface-2")}>
                    <span className="flex w-11 shrink-0 flex-col items-center pt-0.5">
                      <span className={cx("text-xs font-bold", x.day === today ? "text-ink" : "text-mute")}>{x.day === today ? "Today" : WEEKDAY_LONG[weekday(x.day)].slice(0, 3)}</span>
                      <span className={cx("tabular text-lg leading-tight font-extrabold", on ? "text-active-text" : "text-ink-2")}>{Number(x.day.slice(8))}</span>
                    </span>
                    <span className="min-w-0 flex-1 self-center">
                      {on ? (
                        <>
                          {x.list.map((a) => (
                            <span key={a.id} className="flex items-baseline gap-1.5 py-px">
                              {a.time ? <span className="tabular w-[62px] shrink-0 text-xs font-semibold text-mute">{clock(a.time)}</span> : <span className="w-[62px] shrink-0" />}
                              <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{a.what}</span>
                              <span className="tabular shrink-0 text-[13px] text-ink-2">{[a.minutes ? minutesLabel(a.minutes) : "", a.calories !== null ? `${a.calories.toLocaleString()} cal` : ""].filter(Boolean).join(" · ")}</span>
                            </span>
                          ))}
                          {x.list.length > 1 && totals ? <span className="tabular mt-0.5 block border-t border-active/20 pt-1 text-right text-xs font-bold text-active-text">{totals}</span> : null}
                        </>
                      ) : (
                        <span className="text-sm text-mute">{x.later ? "Still to come" : "No activity"}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <p className="px-1 text-xs text-faint">Tap a day to see it, or to change or delete an activity.</p>
      </div>
    </Sheet>
  );
}

function Title({ children }: { children: string }) {
  return <h3 className="px-1 text-xs font-bold tracking-[0.08em] text-mute uppercase">{children}</h3>;
}

/** "5 h 35 min" with the units small, so it fits a third of a phone */
function Minutes({ n }: { n: number }) {
  const h = Math.floor(n / 60), m = n % 60;
  const u = "ml-0.5 mr-1 text-[13px] font-semibold text-mute last:mr-0";
  return <span className="whitespace-nowrap">{h ? <>{h}<span className={u}>h</span></> : null}{m || !h ? <>{m}<span className={u}>min</span></> : null}</span>;
}

function Stat({ label, value, unit, strong }: { label: string; value: ReactNode; unit?: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
      <div className="text-xs font-semibold text-mute">{label}</div>
      <div className={cx("tabular text-xl leading-tight font-extrabold", strong && "text-active-text")}>
        {value}{unit ? <span className="ml-1 text-[13px] font-semibold text-mute">{unit}</span> : null}
      </div>
    </div>
  );
}
