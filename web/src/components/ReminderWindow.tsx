/**
 * The reminder window (Matt, Nov 21 2026): when the app opens and the person hasn't weighed in, or
 * logged an activity, for their number of days (Settings → You; 7 and 3 to begin with), a window comes
 * up over the app. It closes only with its own button: no tap outside, no Esc, no X. It comes back each
 * time the app opens until something is logged, so the way to stop it is to log one (or turn it off).
 *
 * "Opens" = the page loads, or comes back to the screen after being away for half an hour or more (a
 * phone keeps a page open in the background, so going back to it is opening the app for the person).
 */
import * as Dialog from "@radix-ui/react-dialog";
import { Activity as ActivityIcon, Bell, Scale } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Reminder } from "../../../shared/reminders";
import { useActions } from "../lib/actions";
import { api } from "../lib/api";
import { ago, today as todayOf } from "../lib/dates";
import { Button } from "./ui";

/** away this long, coming back counts as opening the app again */
const AWAY_MS = 30 * 60_000;
/** once per page load, whoever's log is on screen (switching to another person doesn't bring it up) */
let checkedThisLoad = false;

export function ReminderWindow() {
  const act = useActions();
  const [due, setDue] = useState<Reminder[]>([]);
  const [open, setOpen] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    let live = true;
    const check = async () => {
      try {
        const day = todayOf();
        const r = await api.reminders(day);
        if (live && r.due.length) { setDue(r.due); setOpen(true); }
      } catch { /* a reminder is never worth an error message */ }
    };
    if (!checkedThisLoad) { checkedThisLoad = true; void check(); }
    const onVis = () => {
      if (document.visibilityState === "hidden") { hiddenAt.current = Date.now(); return; }
      const away = hiddenAt.current; hiddenAt.current = null;
      if (away !== null && Date.now() - away >= AWAY_MS) void check();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { live = false; document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const close = () => setOpen(false);
  const now = todayOf();
  const weigh = due.find((r) => r.kind === "weighIn");
  const active = due.find((r) => r.kind === "activity");
  const both = !!weigh && !!active;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (o) setOpen(true); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/55" />
        <Dialog.Content
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed top-1/2 left-1/2 z-[70] w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-surface p-5 text-ink shadow-sheet outline-none"
        >
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-text"><Bell className="size-6" /></div>
          <Dialog.Title className="mt-3 text-center text-xl font-extrabold tracking-tight">
            {both ? "Time to check in" : weigh ? "Time to weigh in" : "Time to get moving"}
          </Dialog.Title>
          <div className="mt-4 space-y-3">
            {weigh ? (
              <Item icon={<Scale className="size-5" />} title="Weigh in"
                line={weigh.last ? `Your last weigh-in was ${ago(weigh.last, now)}.` : "You haven't weighed in yet."}
                note={`Reminder after ${days(weigh.days)} without one.`}
                button="Weigh in now" onPress={() => { close(); act.weigh(); }} variant="accent" />
            ) : null}
            {active ? (
              <Item icon={<ActivityIcon className="size-5" />} title="Activity"
                line={active.last ? `Your last activity${active.what ? ` (${active.what})` : ""} was ${ago(active.last, now)}.` : "You haven't logged an activity yet."}
                note={`Reminder after ${days(active.days)} without one.`}
                button="Log an activity now" onPress={() => { close(); act.activity(); }} variant="active" />
            ) : null}
          </div>
          <p className="mt-4 text-center text-[13px] leading-snug text-mute">
            This comes up each time you open Craving Crusher until you log {both ? "them" : "one"}. You can change it in Settings → You.
          </p>
          <Button size="lg" variant="strong" className="mt-4 w-full" onClick={close}>Close</Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const days = (n: number) => (n === 1 ? "day" : `${n} days`);

function Item({ icon, title, line, note, button, onPress, variant }: {
  icon: ReactNode; title: string; line: string; note: string; button: string; onPress: () => void; variant: "accent" | "active";
}) {
  return (
    <div className="rounded-2xl border border-line p-3.5">
      <div className="flex items-center gap-2 text-[15px] font-extrabold">{icon}{title}</div>
      <p className="mt-1 text-[15px] leading-snug text-ink-2">{line}</p>
      <p className="mt-0.5 text-[13px] text-mute">{note}</p>
      <Button size="md" variant={variant} className="mt-2.5 w-full" onClick={onPress}>{button}</Button>
    </div>
  );
}
