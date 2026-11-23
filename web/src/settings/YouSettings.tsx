/** The person's own settings: their splurge-size examples, their six activity quick picks, and how weight is shown. Saved as they change. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { DEFAULT_EXAMPLES, DEFAULT_QUICK_PICKS, QUICK_PICK_MAX, REMINDER_DAYS_MAX, REMINDER_DAYS_MIN, SIZE_LABEL, SIZES, TOUGHNESS, type Size, type Toughness, type UserSettings } from "../../../shared/types";
import { Card, cx, Input, Segmented, SIZE_DOT, Toggle } from "../components/ui";
import { api } from "../lib/api";
import { HealthCard } from "./HealthCard";

export function YouSettings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["me-settings"], queryFn: api.mySettings });
  const [examples, setExamples] = useState<Record<Size, string>>({ snack: "", meal: "", feast: "" });
  const [picks, setPicks] = useState<string[]>(["", "", "", "", "", ""]);
  // filled in once from the server: refilling after each save would wipe a box being typed in
  const seeded = useRef(false);
  useEffect(() => { if (q.data && !seeded.current) { seeded.current = true; setExamples(q.data.examples); setPicks(q.data.quickPicks); } }, [q.data]);

  const save = async (patch: Parameters<typeof api.saveMySettings>[0], quiet = false) => {
    try {
      const s = await api.saveMySettings(patch);
      qc.setQueryData(["me-settings"], s);
      // Home, and the game (Keep the monsters coming, toughness, when the app opens) read these settings
      void qc.invalidateQueries({ queryKey: ["overview"] });
      void qc.invalidateQueries({ queryKey: ["game"] });
      if (!quiet) toast.success("Saved.");
    } catch (e) { toast.error((e as Error).message); }
  };
  const s: UserSettings | undefined = q.data;

  return (
    <>
      <Card className="p-4">
        <h2 className="text-[15px] font-extrabold">Your splurge sizes</h2>
        <p className="mt-0.5 text-[13px] leading-snug text-mute">Your own yardstick. These show under Snack, Meal and Feast when you log, so an in-between treat is easy to place. Leave one empty for the usual example.</p>
        <div className="mt-3 space-y-2">
          {SIZES.map((size) => (
            <label key={size} className="flex items-center gap-2.5">
              <span className="flex w-[72px] shrink-0 items-center gap-1.5 text-sm font-extrabold"><span className={cx("size-2.5 rounded-[3px]", SIZE_DOT[size])} />{SIZE_LABEL[size]}</span>
              <Input value={examples[size]} placeholder={DEFAULT_EXAMPLES[size]} maxLength={120} aria-label={`What a ${SIZE_LABEL[size]} is for you`}
                onChange={(e) => setExamples({ ...examples, [size]: e.target.value })}
                onBlur={() => { if (s && examples[size] !== s.examples[size]) void save({ examples: { [size]: examples[size] } }); }}
                className="h-11" />
            </label>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-[15px] font-extrabold">Your quick picks</h2>
        <p className="mt-0.5 text-[13px] leading-snug text-mute">The six buttons under <i>Or pick one</i> when you log an activity. Write the things you do most. Leave one empty for the usual one.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEFAULT_QUICK_PICKS.map((d, i) => (
            <Input key={i} value={picks[i] ?? ""} placeholder={d} maxLength={QUICK_PICK_MAX} aria-label={`Quick pick ${i + 1} (empty = ${d})`}
              onChange={(e) => setPicks(picks.map((p, j) => (j === i ? e.target.value : p)))}
              onBlur={() => { if (s && (picks[i] ?? "").trim() !== (s.quickPicks[i] ?? "")) void save({ quickPicks: picks }); }}
              className="h-11" />
          ))}
        </div>
      </Card>

      <ReminderCard title="Weigh-in reminder" what="weigh-in" s={s}
        on={s?.weighReminder} days={s?.weighReminderDays}
        onToggle={(v) => void save({ weighReminder: v })} onDays={(n) => void save({ weighReminderDays: n }, true)} />
      <ReminderCard title="Activity reminder" what="activity" s={s}
        on={s?.activityReminder} days={s?.activityReminderDays}
        onToggle={(v) => void save({ activityReminder: v })} onDays={(n) => void save({ activityReminderDays: n }, true)} />
      <HealthCard s={s} save={save} />

      <Card className="space-y-3 p-4">
        <h2 className="text-[15px] font-extrabold">When the app opens</h2>
        <p className="text-sm text-mute">Where you land each time you open Craving Crusher. You can still switch any time from the menu under your initials.</p>
        {s ? (
          <Segmented label="When the app opens" value={s.openIn} options={[["tracker", "Tracker"], ["game", "Calorie Crusher"]]} onChange={(v) => void save({ openIn: v })} />
        ) : <div className="h-11 animate-pulse rounded-xl bg-surface-2" />}
      </Card>
      <Card className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-extrabold">Keep the monsters coming</h2>
          {s ? <Toggle label="Keep the monsters coming" checked={s.autoStart} onChange={(v) => void save({ autoStart: v })} /> : null}
        </div>
        <p className="text-sm text-mute">
          With this on, the first time you open Calorie Crusher each day, if no monster is going, the next one starts by itself — never on the same day you beat one (start it yourself if you want it sooner). If your last run is over (or you never started one), a new run starts with Crumbs, in the same mode as the last one; when a run ends, you see how it went first, and the new one starts the next day.
        </p>
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="text-[15px] font-extrabold">Monster toughness</h2>
        <p className="text-sm text-mute">For Calorie Crusher. Tougher monsters have more HP and the same deadline, so they take more activity each day — and they are worth more points. A change counts from the next monster you start; the one you are fighting now stays as it is.</p>
        {s ? (
          <>
            <Segmented label="Monster toughness" value={s.toughness} options={TOUGHNESS.map((t): [Toughness, string] => [t.id, t.label])} onChange={(v) => void save({ toughness: v })} />
            <p className="text-[13px] text-mute">{s.toughness === "standard" ? "Standard: the usual HP." : s.toughness === "tough" ? "Tough: one and a half times the HP." : "Brutal: twice the HP."}</p>
          </>
        ) : <div className="h-11 animate-pulse rounded-xl bg-surface-2" />}
      </Card>
      <Card className="space-y-3.5 p-4">
        <h2 className="text-[15px] font-extrabold">Weight and weeks</h2>
        {s ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">Units</span>
              <Segmented label="Weight units" value={s.units} options={[["lb", "lb"], ["kg", "kg"]]} onChange={(v) => void save({ units: v })} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">Show the trend over</span>
              <Segmented label="Weight trend period" value={s.trendDays} options={[[7, "1 week"], [14, "2 weeks"], [30, "Month"]]} onChange={(v) => void save({ trendDays: v })} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">Weeks start on</span>
              <Segmented label="Weeks start on" value={s.weekStart} options={[[0, "Sunday"], [1, "Monday"]]} onChange={(v) => void save({ weekStart: v })} />
            </div>
          </>
        ) : <div className="h-28 animate-pulse rounded-xl bg-surface-2" />}
      </Card>
    </>
  );
}

/**
 * A reminder's entry (Matt, Nov 21 2026): on or off, and how many days without a weigh-in / an activity
 * before the reminder window comes up as the app opens.
 */
function ReminderCard({ title, what, s, on, days, onToggle, onDays }: {
  title: string; what: "weigh-in" | "activity"; s: UserSettings | undefined; on: boolean | undefined; days: number | undefined;
  onToggle: (v: boolean) => void; onDays: (n: number) => void;
}) {
  const [text, setText] = useState("");
  // quick taps count from the number on screen and save once they stop: each used to start from the saved
  // number, so three fast taps on + went 3 → 5 (review, Nov 22 2026)
  const pending = useRef<{ t: ReturnType<typeof setTimeout>; v: number } | null>(null);
  useEffect(() => { if (days !== undefined && !pending.current) setText(String(days)); }, [days]);
  useEffect(() => () => { const p = pending.current; if (p) { clearTimeout(p.t); onDays(p.v); } }, []);
  const set = (n: number) => {
    const v = Math.min(REMINDER_DAYS_MAX, Math.max(REMINDER_DAYS_MIN, Math.round(n)));
    setText(String(v));
    if (pending.current) clearTimeout(pending.current.t);
    if (v === days) { pending.current = null; return; }
    pending.current = { v, t: setTimeout(() => { pending.current = null; onDays(v); }, 450) };
  };
  const typed = () => {
    const n = Number(text.trim());
    if (!Number.isFinite(n) || text.trim() === "") { setText(String(days ?? "")); toast.error(`Type a number of days from ${REMINDER_DAYS_MIN} to ${REMINDER_DAYS_MAX}.`); return; }
    set(n);
  };
  const shown = Number(text);
  const n = text !== "" && Number.isFinite(shown) ? shown : days ?? 0;
  const thing = what === "weigh-in" ? "a weigh-in" : "an activity";
  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-extrabold">{title}</h2>
        {s && on !== undefined ? <Toggle label={title} checked={on} onChange={onToggle} /> : null}
      </div>
      {!s ? <div className="h-11 animate-pulse rounded-xl bg-surface-2" /> : on ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">Remind me after</span>
            <div className="flex items-center gap-1.5">
              <button type="button" aria-label="One day fewer" disabled={n <= REMINDER_DAYS_MIN} onClick={() => set(n - 1)}
                className="grid size-11 place-items-center rounded-xl bg-surface-2 text-ink disabled:opacity-40"><Minus className="size-4" /></button>
              <div className="w-16">
                <Input value={text} inputMode="numeric" aria-label={`${title}: days`} className="h-11 px-1 text-center text-[17px] font-bold"
                  onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} onBlur={typed}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              </div>
              <button type="button" aria-label="One day more" disabled={n >= REMINDER_DAYS_MAX} onClick={() => set(n + 1)}
                className="grid size-11 place-items-center rounded-xl bg-surface-2 text-ink disabled:opacity-40"><Plus className="size-4" /></button>
              <span className="w-9 text-sm font-semibold">{n === 1 ? "day" : "days"}</span>
            </div>
          </div>
          <p className="text-sm text-mute">
            {n === 1
              ? `When you open Craving Crusher and there's no ${what} today, a reminder comes up. It keeps coming up each time you open the app until you log ${thing}.`
              : `When you open Craving Crusher and there's been no ${what} today or in the ${n - 1 === 1 ? "day" : `${n - 1} days`} before, a reminder comes up. It keeps coming up each time you open the app until you log ${thing}.`}
          </p>
        </>
      ) : <p className="text-sm text-mute">Off: no reminder to log {thing}.</p>}
    </Card>
  );
}
