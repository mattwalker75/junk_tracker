/**
 * Home (mockup E/F, Matt's pick): Days clean with This week and 30 days beside it, the last 14 days
 * coloured by the biggest splurge of each day (tap a day to open it; Calendar for older days), the
 * weight card with the trend over the person's chosen period, and the two big buttons.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, LogOut } from "lucide-react";
import { toast } from "sonner";
import { SIZE_LABEL, type Overview, type WeighIn } from "../../../shared/types";
import { useActions } from "../lib/actions";
import { api } from "../lib/api";
import { addDays, ago, dayNum, shortDay, today as todayOf, WEEKDAY_SHORT, WEEKDAY_TINY, weekday } from "../lib/dates";
import { byDay, countBetween, daysClean, inUnit, periodLabel, startOfWeek, trend, worstSize } from "../lib/stats";
import { Button, Card, cx, SIZE_FILL, SizeLegend } from "./ui";

export function Home({ who, loginEnabled }: { who: string; loginEnabled: boolean }) {
  const qc = useQueryClient();
  const today = todayOf();
  const q = useQuery({ queryKey: ["overview", today], queryFn: () => api.overview(today) });
  const act = useActions();
  const initials = who.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  // sign out lives on the home screen, and only when signing in is on (with it off there is nothing to sign out of)
  const signOut = async () => {
    try { await api.logout(); qc.resetQueries(); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <main className="flex min-h-dvh flex-col pb-safe">
      <header className="flex items-center justify-between px-5 pt-4 pb-2">
        <a href="#/" className="flex items-center gap-2.5">
          <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
          <span className="text-[17px] font-extrabold tracking-tight">Junk Tracker</span>
        </a>
        <div className="flex items-center gap-1.5">
        {loginEnabled ? (
          <button onClick={() => void signOut()} aria-label="Sign out" title="Sign out"
            className="grid size-10 place-items-center rounded-full bg-surface-2 text-ink-2 hover:brightness-95"><LogOut className="size-[18px]" /></button>
        ) : null}
        <a href="#/settings" aria-label={`Settings — ${who}`} title="Settings and people"
          className="grid size-10 place-items-center rounded-full bg-surface-2 text-sm font-bold text-ink-2 hover:brightness-95">{initials || "?"}</a>
        </div>
      </header>

      {q.isError ? <p className="mx-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">{q.error.message}</p> : null}
      {q.data ? <Body o={q.data} today={today} /> : <Skeleton />}

      <div className="flex-1" />
      <div className="sticky bottom-0 grid grid-cols-2 gap-2.5 bg-gradient-to-t from-bg via-bg to-transparent px-4 pt-4 pb-4">
        <Button variant="accent" size="xl" onClick={() => act.log()}>+ Splurge</Button>
        <Button variant="strong" size="xl" onClick={() => act.weigh()}>Weigh in</Button>
      </div>
    </main>
  );
}

function Body({ o, today }: { o: Overview; today: string }) {
  const act = useActions();
  const clean = daysClean(o.last, today);
  const week = countBetween(o.splurges, startOfWeek(today, o.settings.weekStart), today);
  const month = countBetween(o.splurges, addDays(today, -29), today);
  const days = byDay(o.splurges);
  const strip = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const t = trend(o.weighIns, today, o.settings.trendDays);
  const unit = o.settings.units;

  return (
    <div className="space-y-2.5 px-4">
      <div className="grid grid-cols-[1.35fr_1fr] gap-2.5">
        <Card className="p-4">
          <div className="text-xs font-bold tracking-[0.08em] text-mute uppercase">Days clean</div>
          <div className="tabular mt-1 text-[76px] leading-[0.95] font-extrabold tracking-tight text-accent">{clean ?? "—"}</div>
          <div className="mt-1.5 text-[13px] leading-snug text-mute">
            {o.last
              ? <>{clean === 0 ? "splurged today" : `since ${WEEKDAY_SHORT[weekday(o.last.day)]}`}{o.last.where ? ` · ${o.last.where}` : ""}</>
              : "no splurges logged yet"}
          </div>
        </Card>
        <div className="grid gap-2.5">
          <Card className="px-3.5 py-2.5">
            <div className="text-xs font-semibold text-mute">This week</div>
            <div className="tabular text-2xl leading-tight font-extrabold">{week.all} <span className="text-[13px] font-semibold text-mute">{week.all === 1 ? "splurge" : "splurges"}</span></div>
          </Card>
          <Card className="px-3.5 py-2.5">
            <div className="text-xs font-semibold text-mute">30 days</div>
            <div className="tabular text-2xl leading-tight font-extrabold">{month.all} <span className="text-[13px] font-semibold text-mute">· {month.feasts} {month.feasts === 1 ? "feast" : "feasts"}</span></div>
          </Card>
        </div>
      </div>

      {o.last ? (
        <button onClick={() => act.day(o.last!.day)} className="flex w-full items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-left shadow-soft hover:bg-surface-2">
          <span className={cx("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-bold", SIZE_FILL[o.last.size])}>{SIZE_LABEL[o.last.size]}</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{o.last.what}</span>
          <span className="shrink-0 text-[13px] text-mute">{ago(o.last.day, today)}</span>
        </button>
      ) : null}

      <Card className="px-3.5 pt-3.5 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">Last 14 days</h2>
          <a href="#/calendar" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent-soft px-3 text-[13px] font-bold text-accent-text">
            <CalendarDays className="size-4" /> Calendar
          </a>
        </div>
        <div className="mt-2.5 grid grid-cols-7 gap-1.5 text-center">
          {strip.slice(0, 7).map((d) => <span key={d} className="text-[11px] font-semibold text-faint">{WEEKDAY_TINY[weekday(d)]}</span>)}
          {strip.map((d) => {
            const list = days.get(d) || [];
            const size = worstSize(list);
            return (
              <button key={d} onClick={() => act.day(d)}
                aria-label={`${shortDay(d, today)}: ${list.length ? list.map((s) => `${SIZE_LABEL[s.size]}, ${s.what}`).join("; ") : "no splurge"}`}
                className={cx("tabular grid h-10 place-items-center rounded-[10px] text-sm",
                  size ? cx(SIZE_FILL[size], "font-bold") : "bg-surface-2 text-mute",
                  d === today && "outline-2 -outline-offset-2 outline-ink font-extrabold")}>
                {dayNum(d)}
              </button>
            );
          })}
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2"><SizeLegend /><span className="text-xs text-faint">tap a day</span></div>
      </Card>

      <WeightCard t={t} unit={unit} days={o.settings.trendDays} today={today} />
    </div>
  );
}

function WeightCard({ t, unit, days, today }: { t: ReturnType<typeof trend>; unit: "lb" | "kg"; days: number; today: string }) {
  const act = useActions();
  if (!t.latest) {
    return (
      <Card className="p-4">
        <div className="flex items-baseline justify-between"><h2 className="text-[15px] font-bold">Weight</h2><span className="text-xs text-mute">trend over {periodLabel(days)}</span></div>
        <p className="mt-2 text-sm text-mute">No weigh-ins yet. Weigh in whenever you like — daily, weekly or now and then.</p>
      </Card>
    );
  }
  const change = t.change === null ? null : inUnit(Math.abs(t.change), unit);
  const down = (t.change ?? 0) < 0;
  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between"><h2 className="text-[15px] font-bold">Weight</h2><span className="text-xs text-mute">trend over {periodLabel(days)}</span></div>
      <button onClick={() => act.weigh()} className="mt-1.5 flex w-full items-end justify-between gap-3 text-left">
        <div>
          <div className="tabular text-[30px] font-extrabold tracking-tight">{inUnit(t.latest.pounds, unit)} <span className="text-[15px] font-semibold text-mute">{unit}</span></div>
          <div className={cx("text-[13px] font-bold", t.change === null ? "text-mute" : t.change === 0 ? "text-mute" : down ? "text-good" : "text-bad")}>
            {t.change === null ? "not enough weigh-ins for a trend yet" : t.change === 0 ? `no change in ${periodLabel(days)}` : `${down ? "↓" : "↑"} ${change} ${unit} in ${periodLabel(days)}`}
          </div>
          <div className="text-xs text-mute">{t.avg7 !== null ? `7-day avg ${inUnit(t.avg7, unit)} · ` : ""}weighed {ago(t.latest.day, today)}</div>
        </div>
        <Spark points={t.points} />
      </button>
    </Card>
  );
}

/** The trend line: each weigh-in in the period, placed by its day. */
function Spark({ points }: { points: WeighIn[] }) {
  if (points.length < 2) return null;
  const W = 140, H = 54, P = 4;
  const days = points.map((p) => Date.parse(p.day)), lbs = points.map((p) => p.pounds);
  const x0 = Math.min(...days), x1 = Math.max(...days), y0 = Math.min(...lbs), y1 = Math.max(...lbs);
  const x = (d: number) => P + ((d - x0) / (x1 - x0 || 1)) * (W - 2 * P);
  const y = (v: number) => (y1 === y0 ? H / 2 : P + (1 - (v - y0) / (y1 - y0)) * (H - 2 * P));
  const pts = points.map((p, i) => `${x(days[i]).toFixed(1)},${y(p.pounds).toFixed(1)}`);
  const last = pts.at(-1)!.split(",");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weight over the trend period" className="shrink-0 text-accent">
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="currentColor" />
    </svg>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2.5 px-4" aria-busy="true">
      {[150, 54, 170, 120].map((h, i) => <div key={i} className="animate-pulse rounded-2xl bg-surface-2" style={{ height: h }} />)}
    </div>
  );
}
