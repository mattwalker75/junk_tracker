/** Weigh in: one reading a day (a second one that day replaces it), in the person's unit. The day is picked like a splurge's: Today (the default), Yesterday or Other day. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { Day } from "../../../shared/types";
import { LOG_KEYS } from "../lib/actions";
import { api } from "../lib/api";
import { longDay, today as todayOf } from "../lib/dates";
import { inUnit } from "../lib/stats";
import { DayPicker } from "./DayPicker";
import { Button, ErrorLine, Field, Input, Sheet } from "./ui";

export function WeighSheet({ open, onOpenChange, day }: { open: boolean; onOpenChange: (o: boolean) => void; day?: Day }) {
  const qc = useQueryClient();
  const today = todayOf();
  const [d, setD] = useState<Day>(day ?? today);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const overview = useQuery({ queryKey: ["overview", today], queryFn: () => api.overview(today), enabled: open });
  const existing = useQuery({ queryKey: ["day", "weigh", d], queryFn: () => api.weighIns(d, d), enabled: open });
  const unit = overview.data?.settings.units ?? "lb";
  const have = existing.data?.[0];

  useEffect(() => { if (open) { setD(day ?? today); setError(null); setValue(""); } }, [open, day, today]);
  // the box starts with that day's reading when there is one
  useEffect(() => { if (open && have) setValue(String(inUnit(have.pounds, unit))); }, [open, have, unit]);

  const refresh = () => { for (const k of LOG_KEYS) void qc.invalidateQueries({ queryKey: [...k] }); };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const n = Number(value.replace(",", "."));
    if (!value.trim() || !Number.isFinite(n) || n <= 0) return setError("Type your weight.");
    setBusy(true);
    try { await api.weighIn(d, n, unit); refresh(); toast.success(`Weighed in: ${n} ${unit}`); onOpenChange(false); }
    catch (e2) { setError((e2 as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api.deleteWeighIn(d); refresh(); toast.success("Weigh-in removed."); onOpenChange(false); }
    catch (e2) { setError((e2 as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Weigh in" subtitle={longDay(d, today)}>
      <form onSubmit={save} className="space-y-4 pb-2">
        <Field label={`Weight (${unit})`} required>
          {(id) => <Input id={id} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={unit === "lb" ? "187.4" : "85.0"} autoFocus className="tabular text-lg font-bold" />}
        </Field>
        <DayPicker value={d} onChange={setD} today={today} weekStart={overview.data?.settings.weekStart ?? 0} />
        {have ? <p className="text-sm text-mute">{longDay(d, today)} already has {inUnit(have.pounds, unit)} {unit}; saving replaces it — one weigh-in a day.</p> : null}
        <ErrorLine text={error} />
        <Button type="submit" variant="strong" size="xl" className="w-full" disabled={busy}>Save weigh-in</Button>
        {have ? <Button size="lg" variant="danger" className="w-full" onClick={remove} disabled={busy}>Remove this day's weigh-in</Button> : null}
      </form>
    </Sheet>
  );
}
