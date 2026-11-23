/**
 * Start over (Matt, Nov 22 2026; canvas round 18, boards S1–S6): the last card in Settings → You, on the web app,
 * iPhone and Android. For someone back after a break: their log is cleared, their settings stay. Nothing is
 * destroyed — the log is set aside, and Undo brings it back (from the message right after, or from this card later,
 * until the next start over). A confirm window says what goes and what stays; pressing Start over there is the
 * confirmation (Matt: no word to type — "they will be able to restore it if need be").
 */
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { StartOverCounts } from "../../../shared/types";
import { Button, Card } from "../components/ui";
import { forgetGame } from "../game/state";
import { api } from "../lib/api";
import { longDay, today as todayOf } from "../lib/dates";
import { PHONE_APP } from "../lib/phone";

const many = (n: number, one: string, more: string) => `${n.toLocaleString()} ${n === 1 ? one : more}`;
export function heldText(c: StartOverCounts): string {
  // only what there was (no "0 goals")
  const parts = ([[c.splurges, "splurge", "splurges"], [c.activities, "activity", "activities"], [c.weighIns, "weigh-in", "weigh-ins"], [c.goals, "goal", "goals"]] as const)
    .filter(([n]) => n > 0).map(([n, one, more]) => many(n, one, more));
  if (c.run) parts.push(`Calorie Crusher Run #${c.run.number}${c.run.level ? ` (level ${c.run.level})` : ""}`);
  return parts.length ? parts.join(", ") : "nothing had been logged";
}

export function StartOverCard({ others }: { others?: string[] }) {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["start-over"], queryFn: api.startOverStatus });
  const [ask, setAsk] = useState<"start" | "undo" | null>(null);
  const [busy, setBusy] = useState(false);
  const today = todayOf();
  const held = status.data?.held ?? null;
  const where = PHONE_APP ? "on this phone" : "on this computer";

  // every screen reads again, and the game forgets what it remembered about the old runs
  const afresh = async () => { forgetGame(); await qc.resetQueries(); };
  const undo = async () => {
    setBusy(true);
    try {
      await api.undoStartOver(todayOf());
      await afresh();
      setAsk(null);
      toast.success("Your earlier log is back, with everything you logged since.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const start = async () => {
    setBusy(true);
    try {
      await api.startOver(today);
      await afresh();
      setAsk(null);
      toast.success("A fresh start: your log is empty. Your settings are as they were.", {
        duration: 12_000, action: { label: "Undo", onClick: () => void undo() },
      });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Card className="space-y-2.5 p-4">
      <h2 className="text-[15px] font-extrabold">Start over</h2>
      {held ? (
        <>
          <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm leading-snug text-accent-text">
            You started over on <b>{longDay(held.on, today)}</b>. Your earlier log is set aside: {heldText(held.counts)}.
          </p>
          <Button size="lg" variant="accent" className="w-full" disabled={busy} onClick={() => setAsk("undo")}><RotateCcw className="size-4" />Undo start over…</Button>
          <p className="text-[13px] leading-snug text-mute">Undo brings it all back. What you've logged since stays too (a weigh-in on the same day: the newer one stays). Calorie Crusher goes back to where it was; a run started since is removed.</p>
          <Button size="lg" variant="danger" className="w-full" disabled={busy} onClick={() => setAsk("start")}>Start over again…</Button>
          <p className="text-[13px] leading-snug text-mute">Starting over again replaces what's set aside: only the latest start over can be undone.</p>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-2">Back after a break? Clear your log and start fresh: every splurge, activity, weigh-in, goal and Calorie Crusher run goes. Your settings stay.</p>
          {others?.length ? <p className="text-[13px] text-mute">Only yours: {others.length === 1 ? `${others[0]}'s log isn't` : `${others.slice(0, -1).join(", ")} and ${others[others.length - 1]}'s logs aren't`} touched.</p> : null}
          <p className="text-[13px] text-mute">Changed your mind? Undo brings it all back.</p>
          <Button size="lg" variant="danger" className="w-full" disabled={busy || status.isPending} onClick={() => setAsk("start")}>Start over…</Button>
        </>
      )}

      <Dialog.Root open={!!ask} onOpenChange={(o) => { if (!o && !busy) setAsk(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/55" />
          <Dialog.Content aria-describedby="start-over-what" className="fixed inset-x-0 bottom-0 z-[70] mx-auto max-w-lg rounded-t-3xl bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))] text-ink shadow-sheet outline-none">
            {ask === "undo" && held ? (
              <>
                <Dialog.Title className="text-xl leading-tight font-extrabold tracking-tight">Bring back your earlier log?</Dialog.Title>
                <div id="start-over-what" className="mt-3 space-y-2 text-[15px] leading-snug text-ink-2">
                  <p>Everything set aside on {longDay(held.on, today)} comes back: {heldText(held.counts)}.</p>
                  <p>What you've logged since stays too. Calorie Crusher goes back to where it was{held.counts.run ? ` (Run #${held.counts.run.number})` : ""}; a run started since is removed.</p>
                </div>
                <Button size="lg" variant="accent" className="mt-4 w-full" disabled={busy} onClick={() => void undo()}>{busy ? "Bringing it back…" : "Undo start over"}</Button>
              </>
            ) : (
              <>
                <Dialog.Title className="text-xl leading-tight font-extrabold tracking-tight">Start over with an empty log?</Dialog.Title>
                <div id="start-over-what" className="mt-3 space-y-2 text-[15px] leading-snug text-ink-2">
                  <p className="text-[12.5px] font-extrabold tracking-[0.06em] text-mute">WHAT GOES</p>
                  <Li>Every splurge, activity and weigh-in</Li>
                  <Li>Your goals</Li>
                  <Li>Calorie Crusher: your runs, scores and the Hall of Heroes</Li>
                  <p className="pt-1 text-[12.5px] font-extrabold tracking-[0.06em] text-mute">WHAT STAYS</p>
                  <Li ok>Your settings: splurge sizes, quick picks, reminders, units, toughness, theme</Li>
                </div>
                <p className="mt-3 rounded-xl bg-active-soft px-3 py-2 text-[13px] leading-snug text-active-text">
                  Changed your mind later? <b>Undo start over</b> in this card brings it all back, with anything you log in the meantime kept too.{held ? " This replaces the start over set aside now." : ""} A copy of the log file is also kept {where} first.
                </p>
                {/* the confirmation itself: a solid red button (Matt: a click to verify, no word to type) */}
                <button type="button" disabled={busy} onClick={() => void start()}
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-danger text-base font-extrabold text-white hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-60">
                  {busy ? "Starting over…" : "Start over"}
                </button>
              </>
            )}
            <Button size="lg" variant="soft" className="mt-2 w-full" disabled={busy} onClick={() => setAsk(null)}>Cancel</Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Card>
  );
}

function Li({ ok, children }: { ok?: boolean; children: ReactNode }) {
  return (
    <p className="flex gap-2.5">
      {ok ? <Check className="mt-0.5 size-4 shrink-0 text-active" aria-label="Stays" /> : <X className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Goes" />}
      <span>{children}</span>
    </p>
  );
}
