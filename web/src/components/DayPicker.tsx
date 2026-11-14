/**
 * Which day a splurge or a weigh-in was (Matt: the day is enough, no time; the same picker for both). Today and Yesterday are one tap;
 * "Other day" opens a big month calendar right in the sheet — finger-sized days, no future days —
 * instead of the phone's small date wheel.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { Day } from "../../../shared/types";
import { addDays, addMonths, dayNum, longDay, monthEnd, monthLabel, monthOf, monthStart, WEEKDAY_TINY, weekday } from "../lib/dates";
import { cx, useSkin } from "./ui";

export function DayPicker({ value, onChange, today, weekStart }: { value: Day; onChange: (d: Day) => void; today: Day; weekStart: 0 | 1 }) {
  const yesterday = addDays(today, -1);
  const other = value !== today && value !== yesterday;
  const [open, setOpen] = useState(other);
  const [ym, setYm] = useState(monthOf(value));
  // a sheet opened on an older day (or an edit) shows the calendar on that day's month
  // and a sheet reset to Today (it can open still holding last time's older day) closes it again
  useEffect(() => { setYm(monthOf(value)); setOpen(value !== today && value !== yesterday); }, [value, today, yesterday]);

  // the game skin (Calorie Crusher's sheets): the same choices, chunky
  const game = useSkin() === "game";
  const chip = (on: boolean) => game
    ? cx("g-btn min-h-[50px] flex-1 rounded-2xl px-1 text-base font-black", on ? "g-sunk bg-g-blue" : "bg-g-panel-2 text-g-text")
    : cx("min-h-12 flex-1 rounded-2xl border px-3 text-[15px] font-bold",
      on ? "border-transparent bg-accent text-accent-ink" : "border-line-2 bg-surface text-ink hover:bg-surface-2");
  const navBtn = game ? "g-btn grid size-10 place-items-center rounded-xl bg-g-panel text-g-text disabled:opacity-30" : "grid size-11 place-items-center rounded-xl border border-line hover:bg-surface-2";

  const first = monthStart(ym);
  const lead = (weekday(first) - weekStart + 7) % 7;
  const days = Array.from({ length: dayNum(monthEnd(ym)) }, (_, i) => addDays(first, i));
  const heads = Array.from({ length: 7 }, (_, i) => WEEKDAY_TINY[(i + weekStart) % 7]);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className={game ? "font-game text-[17px] text-g-text" : "text-[13px] font-bold text-mute"}>Day</span>
        <span className={game ? "text-sm font-extrabold text-g-mute" : "text-[13px] font-semibold text-ink-2"}>{longDay(value, today)}</span>
      </div>
      <div className={game ? "flex gap-[9px]" : "flex gap-2"} role="group" aria-label="Day">
        <button type="button" className={chip(value === today && !open)} aria-pressed={value === today && !open} onClick={() => { onChange(today); setOpen(false); }}>Today</button>
        <button type="button" className={chip(value === yesterday && !open)} aria-pressed={value === yesterday && !open} onClick={() => { onChange(yesterday); setOpen(false); }}>Yesterday</button>
        <button type="button" className={chip(open)} aria-pressed={open} aria-expanded={open} onClick={() => setOpen(true)}>Other day</button>
      </div>
      {open ? (
        <div className={game ? "g-panel mt-2.5 bg-g-panel-2 p-2.5" : "mt-2.5 rounded-2xl border border-line bg-surface p-3"}>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Previous month" onClick={() => setYm(addMonths(ym, -1))} className={navBtn}><ChevronLeft className="size-5" /></button>
            <span className={game ? "font-game text-[19px]" : "text-[17px] font-extrabold"}>{monthLabel(ym)}</span>
            <button type="button" aria-label="Next month" disabled={ym >= monthOf(today)} onClick={() => setYm(addMonths(ym, 1))} className={game ? navBtn : "grid size-11 place-items-center rounded-xl border border-line hover:bg-surface-2 disabled:opacity-30"}><ChevronRight className="size-5" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {heads.map((h) => <div key={h} className={game ? "pb-1 text-xs font-black text-g-mute" : "pb-1 text-xs font-bold text-mute"}>{h}</div>)}
            {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} />)}
            {days.map((d) => {
              const future = d > today;
              const on = d === value;
              return (
                <button type="button" key={d} disabled={future} onClick={() => onChange(d)} aria-label={longDay(d, today)} aria-pressed={on}
                  className={game
                    ? cx("tabular grid aspect-square min-h-10 place-items-center rounded-[11px] text-base font-black",
                      on ? "border-[2.5px] border-g-line bg-g-blue text-g-on" : future ? "opacity-30" : cx("bg-g-panel", d === today ? "border-[2.5px] border-g-line" : "border-2 border-g-dash"))
                    : cx("tabular grid aspect-square min-h-11 place-items-center rounded-xl text-[17px] font-semibold",
                    on ? "bg-accent font-extrabold text-accent-ink" : future ? "text-mute/40" : "bg-surface-2 hover:brightness-95",
                    d === today && !on ? "ring-2 ring-ink/70 ring-inset" : "")}>
                  {dayNum(d)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
