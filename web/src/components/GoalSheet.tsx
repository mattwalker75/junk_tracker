/**
 * Add a goal, or change one (as mocked up, Oct 26 2026): what it is (or tap an idea), how long it
 * runs once it is at the top, and — for a new one — whether it is the goal now or waits at the end
 * of the list. Changing one also offers Delete.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { Goal, GoalDays } from "../../../shared/types";
import { GOAL_KEYS } from "../lib/actions";
import { api } from "../lib/api";
import { Button, cx, ErrorLine, Field, Sheet, TextArea } from "./ui";

const IDEAS: { text: string; days: GoalDays }[] = [
  { text: "Eat extra clean for the next 2 weeks", days: 14 },
  { text: "No fast food this month", days: 30 },
  { text: "Snacks only — no feasts", days: 14 },
  { text: "No splurges on weeknights", days: 30 },
  { text: "Weigh in every morning for a week", days: 7 },
];
const LENGTHS: [GoalDays, string][] = [[null, "No end"], [7, "1 week"], [14, "2 weeks"], [30, "1 month"]];
const PLACES: ["now" | "later", string, string][] = [["now", "Now", "It goes on your Home screen"], ["later", "Later", "At the end of your list"]];

export function GoalSheet({ open, onOpenChange, edit, hasGoals }: { open: boolean; onOpenChange: (o: boolean) => void; edit?: Goal; hasGoals: boolean }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [days, setDays] = useState<GoalDays>(14);
  const [place, setPlace] = useState<"now" | "later">("now");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // every open starts fresh: a new goal, or the one being changed
  useEffect(() => {
    if (!open) return;
    setError(null); setConfirmDelete(false); setPlace("now");
    setText(edit?.text ?? ""); setDays(edit ? edit.days : 14);
  }, [open, edit]);

  const refresh = () => { for (const k of GOAL_KEYS) void qc.invalidateQueries({ queryKey: [...k] }); };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!text.trim()) return setError("Say what your goal is.");
    setBusy(true);
    try {
      if (edit) { await api.saveGoal(edit.id, { text: text.trim(), days }); toast.success("Saved."); }
      else {
        // with no goals yet the new one is the goal now, wherever it was asked to go
        await api.addGoal({ text: text.trim(), days, place: hasGoals ? place : "now" });
        toast.success(!hasGoals || place === "now" ? "Your goal is on the Home screen." : "Added to the end of your list.");
      }
      refresh();
      onOpenChange(false);
    } catch (e2) { setError((e2 as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!edit) return;
    setBusy(true);
    try { await api.deleteGoal(edit.id); refresh(); toast.success("Goal removed."); onOpenChange(false); }
    catch (e2) { setError((e2 as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={edit ? "Change the goal" : "Add a goal"}>
      <form onSubmit={save} className="space-y-4 pb-2">
        <Field label="Your goal" required>
          {(id) => <TextArea id={id} rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder="Something you can do, in your own words" className="resize-none text-lg font-bold" />}
        </Field>

        {!edit ? (
          <div>
            <div className="mb-1.5 text-[13px] font-bold text-mute">Ideas</div>
            <div className="flex flex-wrap gap-2">
              {IDEAS.map((i) => (
                <button type="button" key={i.text} onClick={() => { setText(i.text); setDays(i.days); }}
                  className="inline-flex min-h-10 items-center rounded-full bg-surface-2 px-3.5 text-sm font-semibold hover:brightness-95">{i.text}</button>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-bold text-mute">How long?</span>
            <span className="text-xs text-mute">counts from when it is at the top</span>
          </div>
          <div role="radiogroup" aria-label="How long" className="grid grid-cols-4 gap-1 rounded-2xl bg-surface-2 p-1">
            {LENGTHS.map(([d, label]) => (
              <button type="button" key={label} role="radio" aria-checked={days === d} onClick={() => setDays(d)}
                className={cx("min-h-10 rounded-xl text-sm", days === d ? "bg-surface font-extrabold text-ink shadow-soft" : "font-semibold text-mute")}>{label}</button>
            ))}
          </div>
        </div>

        {!edit && hasGoals ? (
          <div>
            <div className="mb-1.5 text-[13px] font-bold text-mute">Where in your list?</div>
            <div role="radiogroup" aria-label="Where in your list" className="grid grid-cols-2 gap-2">
              {PLACES.map(([p, label, sub]) => (
                <button type="button" key={p} role="radio" aria-checked={place === p} onClick={() => setPlace(p)}
                  className={cx("min-h-15 rounded-2xl border-2 px-3 py-2.5 text-left", place === p ? "border-accent bg-accent-soft" : "border-line-2 bg-surface")}>
                  <span className="block text-[15px] font-extrabold">{label}</span>
                  <span className="mt-0.5 block text-xs text-mute">{sub}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <ErrorLine text={error} />
        <Button type="submit" variant="accent" size="xl" className="w-full" disabled={busy}>{edit ? "Save" : "Save goal"}</Button>
        {edit ? (
          confirmDelete
            ? <div className="grid grid-cols-2 gap-2.5"><Button size="lg" onClick={() => setConfirmDelete(false)}>Keep it</Button><Button size="lg" variant="danger" onClick={remove} disabled={busy}>Delete it</Button></div>
            : <Button size="lg" variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>Delete this goal</Button>
        ) : null}
      </form>
    </Sheet>
  );
}
