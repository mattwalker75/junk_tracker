/**
 * Settings → You, in the phone apps only: workouts from Apple Health (iPhone) or Health Connect (Android)
 * (Matt, Nov 22 2026; canvas round 17, boards H1–H3 and H6). Off: what it does. Turning it on: what it reads, then
 * the phone's own permission sheet. On: when workouts last came in, how many this week, Bring in now.
 */
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, HeartPulse, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { HEALTH_FIRST_DAYS, HEALTH_SOURCES, type UserSettings } from "../../../shared/types";
import { Button, Card, Toggle } from "../components/ui";
import { api } from "../lib/api";
import { addDays, clock, nowTime, shortDay, today as todayOf } from "../lib/dates";
import { bringInWorkouts } from "../lib/health";
import { phoneHealth } from "../lib/phone";

type Status = "ok" | "unavailable" | "needs-app" | "no-build";

export function HealthCard({ s, save }: { s: UserSettings | undefined; save: (patch: Partial<UserSettings>, quiet?: boolean) => Promise<void> }) {
  const health = phoneHealth();
  const qc = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = todayOf();
  const status = useQuery({ queryKey: ["health", "status"], queryFn: () => (health ? health.status() : Promise.resolve("unavailable" as Status)), enabled: !!health });
  const summary = useQuery({ queryKey: ["health", "summary", today], queryFn: () => api.healthSummary(today), enabled: !!health && !!s?.healthImport });
  if (!health) return null;
  const name = HEALTH_SOURCES[health.source];
  const iphone = health.source === "apple-health";
  const on = !!s?.healthImport;
  const st = status.data;

  const turnOn = async () => {
    setBusy(true);
    try {
      const now = await health.status();
      void qc.invalidateQueries({ queryKey: ["health", "status"] });
      if (now !== "ok") { setAsking(false); return; }
      const allowed = await health.authorize();
      if (!allowed) { toast.error(iphone ? "Apple Health didn't finish asking. Try again." : "Health Connect didn't allow it. Turn it on again and allow Exercise and Active calories burned."); return; }
      setAsking(false);
      await save({ healthImport: true, healthSince: addDays(today, -(HEALTH_FIRST_DAYS - 1)) }, true);
      toast.success(`On: workouts from ${name} come in by themselves.`);
      await bringInWorkouts(qc, { now: true });
    } catch (e) {
      toast.error(`${name} could not be turned on: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };
  const bringNow = async () => { setBusy(true); try { await bringInWorkouts(qc, { now: true }); } finally { setBusy(false); } };

  const last = summary.data?.lastAt ? new Date(summary.data.lastAt) : null;
  const lastText = last ? `${todayOf(last) === today ? "today" : todayOf(last) === addDays(today, -1) ? "yesterday" : shortDay(todayOf(last), today)}, ${clock(nowTime(last))}` : null;
  const week = summary.data?.thisWeek ?? 0;

  return (
    <Card className="space-y-2.5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-extrabold">{name}</h2>
        {s ? <Toggle label={name} checked={on} disabled={busy || (!on && st !== undefined && st !== "ok")}
          onChange={(v) => { if (v) setAsking(true); else void save({ healthImport: false }); }} /> : null}
      </div>

      {st === "needs-app" ? (
        <>
          <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm leading-snug text-warn">This phone needs the Health Connect app first (it is built into Android 14 and newer). Get it from the Play Store, then turn this on.</p>
          {health.getApp ? <Button size="md" variant="soft" className="w-full" onClick={() => health.getApp?.()}>Get Health Connect</Button> : null}
        </>
      ) : st === "unavailable" ? (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm leading-snug text-warn">{name} isn't on this device{iphone ? " (an iPad has none)" : ""}, so there are no workouts to bring in.</p>
      ) : st === "no-build" ? (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm leading-snug text-warn">This copy of the app was built without {name}. Build it again with it on (APP_PORTS/{iphone ? "ios" : "android"}/BUILD_APP.sh), then turn this on.</p>
      ) : on ? (
        <>
          <p className="flex items-center gap-2 rounded-xl bg-active-soft px-3 py-2 text-sm font-bold text-active-text"><span aria-hidden>●</span>On{lastText ? ` · last brought in ${lastText}` : " · nothing brought in yet"}</p>
          <p className="text-sm text-ink-2">{week === 1 ? "1 workout" : `${week} workouts`} brought in this week. New ones come in each time you open the app.</p>
          {iphone && summary.data?.everSeen === 0 ? (
            <p className="rounded-xl bg-warn-soft px-3 py-2 text-[13px] leading-snug text-warn">Nothing coming in? Apple Health may not be sharing your workouts yet: open the Health app → your picture → Apps → Craving Crusher, and turn on Workouts and Active Energy.</p>
          ) : null}
          <Button size="md" variant="soft" className="w-full" disabled={busy} onClick={() => void bringNow()}>{busy ? "Bringing them in…" : "Bring in now"}</Button>
          <p className="text-[13px] text-mute">Only reads your workouts. Writes nothing to {name}; nothing leaves your phone.</p>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-2">Bring in the workouts you record ({iphone ? "a walk, a run, a ride, a gym session from your watch or a fitness app" : "from Fitbit, Samsung Health, Google Fit, a watch…"}) as activities, with their minutes and calories. They hit monsters in Calorie Crusher like any activity.</p>
          <p className="text-sm text-ink-2">The first time, it brings in the last {HEALTH_FIRST_DAYS} days; after that, new ones each time you open the app. One you already logged by hand (starting within half an hour of it) isn't brought in twice.</p>
          <p className="text-[13px] text-mute">Craving Crusher only reads your workouts. It writes nothing to {name}, and nothing leaves your phone.</p>
        </>
      )}

      <Dialog.Root open={asking} onOpenChange={(o) => { if (!o && !busy) setAsking(false); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/55" />
          <Dialog.Content aria-describedby="health-ask-what" className="fixed inset-x-0 bottom-0 z-[70] mx-auto max-w-lg rounded-t-3xl bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))] text-ink shadow-sheet outline-none">
            <div className="grid size-11 place-items-center rounded-2xl bg-danger-soft text-danger"><HeartPulse className="size-6" /></div>
            <Dialog.Title className="mt-3 text-xl leading-tight font-extrabold tracking-tight">Bring in your workouts from {name}?</Dialog.Title>
            <ul id="health-ask-what" className="mt-3 space-y-2 text-[15px] leading-snug text-ink-2">
              <Li ok>Your workouts: what kind, when, how long</Li>
              <Li ok>The calories each one burned</Li>
              <Li>Not your steps, heart rate, weight or anything else</Li>
              <Li>Nothing is written to {name}, and nothing leaves your phone</Li>
            </ul>
            <p className="mt-3 rounded-2xl border-2 border-dashed border-line-2 px-3 py-2.5 text-[13px] leading-snug text-mute">
              {iphone ? <>Next, your iPhone asks what to share. Turn on <b>Workouts</b> and <b>Active Energy</b>, then tap Allow.</>
                : <>Next, Health Connect asks what to share. Allow <b>Exercise</b> and <b>Active calories burned</b>.</>}
            </p>
            <Button size="lg" variant="accent" className="mt-4 w-full" disabled={busy} onClick={() => void turnOn()}>{busy ? "Asking…" : "Continue"}</Button>
            <Button size="lg" variant="soft" className="mt-2 w-full" disabled={busy} onClick={() => setAsking(false)}>Not now</Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Card>
  );
}

function Li({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      {ok ? <Check className="mt-0.5 size-4 shrink-0 text-active" aria-label="Yes" /> : <X className="mt-0.5 size-4 shrink-0 text-danger" aria-label="No" />}
      <span>{children}</span>
    </li>
  );
}
