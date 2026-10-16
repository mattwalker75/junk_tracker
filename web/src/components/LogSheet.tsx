/**
 * Log a splurge (approved by Matt as mocked up): "Again?" buttons for recent things, What and How big
 * (required), then Where, Calories, the Day (no time — Matt: the day is enough) and Notes. Under each size: the person's own examples from
 * Settings, or the default ones. The same sheet edits a splurge (with Delete).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { DEFAULT_EXAMPLES, SIZE_LABEL, SIZES, type Day, type Size, type Splurge } from "../../../shared/types";
import { LOG_KEYS } from "../lib/actions";
import { api } from "../lib/api";
import { useToday } from "../lib/useToday";
import { today as todayOf } from "../lib/dates";
import { DayPicker } from "./DayPicker";
import { Button, cx, ErrorLine, Field, Input, Label, Sheet, SIZE_DOT, TextArea } from "./ui";

const SELECTED: Record<Size, string> = { snack: "border-snack-ink/0 ring-2 ring-snack", meal: "ring-2 ring-meal", feast: "ring-2 ring-feast" };

export function LogSheet({ open, onOpenChange, day, edit }: { open: boolean; onOpenChange: (o: boolean) => void; day?: Day; edit?: Splurge }) {
  const qc = useQueryClient();
  const today = useToday();
  const overview = useQuery({ queryKey: ["overview", today], queryFn: () => api.overview(today), enabled: open });
  const settings = overview.data?.settings;
  const [what, setWhat] = useState("");
  const [size, setSize] = useState<Size | null>(null);
  const [where, setWhere] = useState("");
  const [calories, setCalories] = useState("");
  const [when, setWhen] = useState({ day: today, time: "" });
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // every open starts fresh: a new splurge now (or on the day it was opened from), or the one being edited
  useEffect(() => {
    if (!open) return;
    setError(null); setConfirmDelete(false);
    if (edit) {
      setWhat(edit.what); setSize(edit.size); setWhere(edit.where); setCalories(edit.calories === null ? "" : String(edit.calories));
      setWhen({ day: edit.day, time: edit.time }); setNotes(edit.notes);
    } else {
      setWhat(""); setSize(null); setWhere(""); setCalories(""); setNotes("");
      setWhen({ day: day ?? today, time: "" });
    }
  }, [open, edit, day, today]);

  const again = (r: { what: string; size: Size; where: string; calories: number | null }) => {
    setWhat(r.what); setSize(r.size); setWhere(r.where); setCalories(r.calories === null ? "" : String(r.calories));
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!what.trim()) return setError("Say what you had.");
    if (!size) return setError("Pick Snack, Meal or Feast.");
    const cal = calories.trim() === "" ? null : Number(calories.replace(/[, ]/g, ""));
    if (cal !== null && (!Number.isInteger(cal) || cal < 0)) return setError("Calories are a whole number, or leave it empty.");
    const input = { what: what.trim(), size, where: where.trim(), calories: cal, day: when.day, time: when.time, notes };
    setBusy(true);
    try {
      if (edit) await api.saveSplurge(edit.id, input); else await api.addSplurge(input);
      for (const k of LOG_KEYS) void qc.invalidateQueries({ queryKey: [...k] });
      toast.success(edit ? "Saved." : `Logged: ${input.what}`);
      onOpenChange(false);
    } catch (e2) { setError((e2 as Error).message); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await api.deleteSplurge(edit.id);
      for (const k of LOG_KEYS) void qc.invalidateQueries({ queryKey: [...k] });
      toast.success("Deleted.");
      onOpenChange(false);
    } catch (e2) { setError((e2 as Error).message); }
    finally { setBusy(false); }
  };

  const recent = !edit ? overview.data?.recent ?? [] : [];
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={edit ? "Edit splurge" : "Log a splurge"}>
      <form onSubmit={save} className="space-y-4 pb-2">
        {recent.length ? (
          <div>
            <Label>Again?</Label>
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <button type="button" key={r.what} onClick={() => again(r)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full bg-surface-2 px-3.5 text-sm font-semibold hover:brightness-95">
                  <span className={cx("size-2.5 rounded-full", SIZE_DOT[r.size])} />{r.what}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Field label="What did you have?" required>
          {(id) => <Input id={id} value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Cheeseburger & fries" maxLength={120} autoCapitalize="sentences" />}
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-bold text-mute">How big a splurge? <span className="text-danger" aria-hidden>*</span></legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="How big a splurge">
            {SIZES.map((s) => {
              const example = settings?.examples[s] || DEFAULT_EXAMPLES[s];
              const on = size === s;
              return (
                <button type="button" key={s} role="radio" aria-checked={on} onClick={() => setSize(s)}
                  className={cx("flex min-h-[92px] flex-col items-center justify-start gap-1 rounded-2xl border px-2 py-2.5 text-center",
                    on ? cx("border-transparent bg-surface-2", SELECTED[s]) : "border-line-2 bg-surface")}>
                  <span className={cx("size-3.5 rounded-full", SIZE_DOT[s])} />
                  <span className="text-[15px] font-extrabold">{SIZE_LABEL[s]}</span>
                  <span className="text-xs leading-tight text-mute [overflow-wrap:anywhere]">{example}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Where">{(id) => <Input id={id} value={where} onChange={(e) => setWhere(e.target.value)} placeholder="optional" maxLength={80} />}</Field>
          <Field label="Calories">{(id) => <Input id={id} value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="optional" inputMode="numeric" />}</Field>
        </div>

        {/* an older splurge keeps the time it was logged with; new ones have none */}
        <DayPicker value={when.day} onChange={(d) => setWhen({ ...when, day: d })} today={today} weekStart={settings?.weekStart ?? 0} />

        <Field label="Notes">{(id) => <TextArea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional — who you were with, how it felt, anything" maxLength={2000} />}</Field>

        <ErrorLine text={error} />
        <Button type="submit" variant="accent" size="xl" className="w-full" disabled={busy}>{edit ? "Save" : "Save splurge"}</Button>
        {edit ? (
          confirmDelete
            ? <div className="grid grid-cols-2 gap-2.5"><Button size="lg" onClick={() => setConfirmDelete(false)}>Keep it</Button><Button size="lg" variant="danger" onClick={remove} disabled={busy}>Delete it</Button></div>
            : <Button size="lg" variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>Delete this splurge</Button>
        ) : null}
      </form>
    </Sheet>
  );
}
