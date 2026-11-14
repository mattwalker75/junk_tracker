/**
 * Log activity (Matt's mockup, round 4, Nov 9 2026): "Again?" buttons for recent different
 * activities, What did you do? (the only thing needed), six quick picks that fill it in (the
 * person's own from Settings → You, or Walk / Run / Bike / Gym / Swim / Yoga), How long and
 * Calories burned (optional; How long takes minutes "90" or hours:minutes "1:30"), the Day (the same picker as a splurge) with a time that
 * starts at now, and Notes. The same sheet edits an activity (with Delete).
 *
 * Two skins, one form (Craving Crusher, Nov 11 2026): `skin="game"` on game pages ("Attack! Log
 * activity") restyles the same fields in the same order with the same labels, and adds the live
 * damage panel from the shared engine's preview, so the numbers match the server: "This hits Fry
 * Hydra for 66 · 26 short…", "FINISHING BLOW!". After a save or delete in game mode the game is synced.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { attackPanel, previewStamp, savedText } from "../game/logic";
import { Sword } from "../game/icons";
import { AttackPreview, NoFightNote } from "../game/Panels";
import { syncAfterLog, useGame } from "../game/state";
import { toast } from "sonner";
import { quickPickNames, type Activity, type Day } from "../../../shared/types";
import { LOG_KEYS, refresh } from "../lib/actions";
import { api } from "../lib/api";
import { nowTime } from "../lib/dates";
import { durationInput, minutesLabel, parseDuration } from "../lib/stats";
import { useToday } from "../lib/useToday";
import { DayPicker } from "./DayPicker";
import { Button, cx, ErrorLine, Field, Input, Sheet, TextArea, Label, type Skin } from "./ui";

/** "45" → 45, "" → null, "4.5" or "-3" → NaN (refused) */
const whole = (v: string) => (v.trim() === "" ? null : /^\d+$/.test(v.replace(/[, ]/g, "")) ? Number(v.replace(/[, ]/g, "")) : NaN);

/** Under How long: what the box will save ("= 1 h 30 min"), or how to write it. */
function durationHint(v: string): string {
  const n = parseDuration(v);
  if (n === null) return "optional · minutes, or h:mm";
  return Number.isNaN(n) || n === 0 ? "minutes (90) or h:mm (1:30)" : `= ${minutesLabel(n)}`;
}

export function ActivitySheet({ open, onOpenChange, day, edit, skin = "tracker" }: { open: boolean; onOpenChange: (o: boolean) => void; day?: Day; edit?: Activity; skin?: Skin }) {
  const qc = useQueryClient();
  const today = useToday();
  const game = skin === "game";
  const gameView = useGame(open && game).view;
  const fight = game ? gameView?.fight ?? null : null; // tracker pages never show the game
  const overview = useQuery({ queryKey: ["overview", today], queryFn: () => api.overview(today), enabled: open });
  const settings = overview.data?.settings;
  const picks = quickPickNames(settings?.quickPicks);
  const [what, setWhat] = useState("");
  const [minutes, setMinutes] = useState("");
  const [calories, setCalories] = useState("");
  const [when, setWhen] = useState({ day: today, time: "" });
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // every open starts fresh: a new activity now (or on the day it was opened from), or the one being edited
  useEffect(() => {
    if (!open) return;
    setError(null); setConfirmDelete(false);
    if (edit) {
      setWhat(edit.what); setMinutes(durationInput(edit.minutes)); setCalories(edit.calories === null ? "" : String(edit.calories));
      setWhen({ day: edit.day, time: edit.time }); setNotes(edit.notes);
    } else {
      setWhat(""); setMinutes(""); setCalories(""); setNotes("");
      setWhen({ day: day ?? today, time: nowTime() });
    }
  }, [open, edit, day, today]);

  const again = (r: { what: string; minutes: number | null; calories: number | null }) => {
    setWhat(r.what); setMinutes(durationInput(r.minutes)); setCalories(r.calories === null ? "" : String(r.calories));
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!what.trim()) return setError("Say what you did.");
    const mins = parseDuration(minutes), cal = whole(calories);
    if (Number.isNaN(mins) || mins === 0) return setError("How long is minutes (90) or hours and minutes (1:30), or leave it empty.");
    if (Number.isNaN(cal)) return setError("Calories burned are a whole number, or leave it empty.");
    const input = { what: what.trim(), minutes: mins, calories: cal, day: when.day, time: when.time, notes };
    setBusy(true);
    try {
      if (edit) await api.saveActivity(edit.id, input); else await api.addActivity(input);
      void refresh(qc, LOG_KEYS);
      if (game) { void syncAfterLog(qc, today); toast.success(edit ? "Saved." : savedText("activity", panel)); }
      else toast.success(edit ? "Saved." : `Logged: ${input.what}`);
      onOpenChange(false);
    } catch (e2) { setError((e2 as Error).message); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await api.deleteActivity(edit.id);
      void refresh(qc, LOG_KEYS);
      if (game) void syncAfterLog(qc, today);
      toast.success("Deleted.");
      onOpenChange(false);
    } catch (e2) { setError((e2 as Error).message); }
    finally { setBusy(false); }
  };

  const recent = !edit ? overview.data?.recentActivities ?? [] : [];
  // the game skin's live damage panel: what this workout would do to the open fight (a box that
  // doesn't read yet counts as empty, as it would be saved once fixed)
  const pm = parseDuration(minutes), pc = whole(calories);
  const panel = fight ? attackPanel(fight.input, {
    id: edit?.id, what, day: when.day, time: when.time,
    minutes: pm === null || Number.isNaN(pm) ? null : pm, calories: pc === null || Number.isNaN(pc) ? null : pc,
    createdAt: edit?.createdAt ?? previewStamp(fight.input, new Date().toISOString()),
  }) : null;
  const title = edit ? "Edit activity" : "Log activity";
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} skin={skin}
      lead={game ? <span aria-hidden className="grid size-11 shrink-0 -rotate-[4deg] place-items-center rounded-[14px] border-[3px] border-g-line bg-g-red shadow-[0_4px_0_var(--g-line)]"><Sword className="size-8" /></span> : undefined}
      titleNode={game ? <span className="flex items-baseline gap-2"><span className="g-stroke-thin" style={{ color: "#ff4d6d" }}>Attack!</span><span>{title}</span></span> : undefined}>
      <form onSubmit={save} className={game ? "space-y-3 pb-2" : "space-y-4 pb-2"}>
        {panel && fight ? <AttackPreview p={panel} slug={fight.slug} /> : game && !fight && gameView?.next ? <NoFightNote name={gameView.next.name} kind="hit" /> : null}
        {recent.length ? (
          <div>
            <Label>Again?</Label>
            <div className={game ? "flex flex-wrap gap-x-1.5 gap-y-[7px]" : "flex flex-wrap gap-2"}>
              {recent.map((r) => (
                <button type="button" key={r.what} onClick={() => again(r)}
                  className={game ? "g-btn inline-flex h-[34px] items-center rounded-full border-[2.5px] bg-g-soft-green px-[11px] text-sm font-black text-g-text shadow-[0_3px_0_var(--g-line)] [overflow-wrap:anywhere]"
                    : "inline-flex min-h-10 items-center rounded-full bg-active-soft px-3.5 text-sm font-bold text-active-text hover:brightness-95 [overflow-wrap:anywhere]"}>
                  {r.what}{r.minutes ? ` · ${minutesLabel(r.minutes)}` : ""}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Field label="What did you do?" required>
          {(id) => <Input id={id} value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Walk around the lake" maxLength={120} autoCapitalize="sentences" />}
        </Field>

        <fieldset>
          <legend className={game ? "mb-[7px] font-game text-[17px] text-g-text" : "mb-1.5 text-[13px] font-bold text-mute"}>Or pick one</legend>
          <div className={game ? "grid grid-cols-3 gap-[9px]" : "grid grid-cols-3 gap-2"}>
            {picks.map((p, i) => {
              const on = what.trim().toLowerCase() === p.toLowerCase();
              return (
                <button type="button" key={i} aria-pressed={on} onClick={() => setWhat(p)}
                  className={game ? cx("g-btn min-h-[52px] rounded-2xl px-1 text-[15px] leading-tight font-black [overflow-wrap:anywhere]", on ? "g-sunk bg-g-yellow" : "bg-g-panel-2 text-g-text")
                    : cx("min-h-11 rounded-xl px-2 text-[15px] leading-tight [overflow-wrap:anywhere]",
                    on ? "border-2 border-active bg-active-soft font-extrabold text-active-text" : "border border-line-2 bg-surface font-bold text-ink hover:bg-surface-2")}>
                  {p}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="How long" hint={durationHint(minutes)}>{(id) => <Input id={id} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="90 or 1:30" />}</Field>
          <Field label="Calories burned">{(id) => <Input id={id} value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="optional" inputMode="numeric" />}</Field>
        </div>

        <DayPicker value={when.day} onChange={(d) => setWhen({ ...when, day: d })} today={today} weekStart={settings?.weekStart ?? 0} />
        <Field label="Time">
          {(id) => <div className="w-44"><Input id={id} type="time" value={when.time} onChange={(e) => setWhen({ ...when, time: e.target.value })} /></div>}
        </Field>

        <Field label="Notes">{(id) => <TextArea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional — the route, who you went with, how it felt" maxLength={2000} />}</Field>

        <ErrorLine text={error} />
        <Button type="submit" variant="active" size="xl" className={cx("w-full", game && panel?.state === "finish" && "g-anim-pulse")} disabled={busy}>
          {game ? <Sword className="size-[30px]" /> : null}{game && !edit ? "Attack! Save activity" : edit ? "Save" : "Save activity"}
        </Button>
        {edit ? (
          confirmDelete
            ? <div className="grid grid-cols-2 gap-2.5"><Button size="lg" onClick={() => setConfirmDelete(false)}>Keep it</Button><Button size="lg" variant="danger" onClick={remove} disabled={busy}>Delete it</Button></div>
            : <Button size="lg" variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>Delete this activity</Button>
        ) : null}
      </form>
    </Sheet>
  );
}
