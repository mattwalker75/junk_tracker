/** The person's own settings: their splurge-size examples, and how weight is shown. Saved as they change. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DEFAULT_EXAMPLES, SIZE_LABEL, SIZES, type Size, type UserSettings } from "../../../shared/types";
import { Card, cx, Input, Segmented, SIZE_DOT } from "../components/ui";
import { api } from "../lib/api";

export function YouSettings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["me-settings"], queryFn: api.mySettings });
  const [examples, setExamples] = useState<Record<Size, string>>({ snack: "", meal: "", feast: "" });
  useEffect(() => { if (q.data) setExamples(q.data.examples); }, [q.data]);

  const save = async (patch: Parameters<typeof api.saveMySettings>[0], quiet = false) => {
    try {
      const s = await api.saveMySettings(patch);
      qc.setQueryData(["me-settings"], s);
      void qc.invalidateQueries({ queryKey: ["overview"] });
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
