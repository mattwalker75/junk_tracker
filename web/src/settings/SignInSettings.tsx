/**
 * Users and sign-in — one switch, like People Manager and the trading desk.
 * Off (the default): no sign-in, one log (yours). On: several users, each with their own log,
 * each signing in with a name and password. Turning it on asks for your name and a password;
 * turning it off needs everyone else removed first and removes your password.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { AuthState } from "../../../shared/types";
import { Button, Card, Confirm, ErrorLine, Field, Input, Segmented, Sheet, Toggle } from "../components/ui";
import { api } from "../lib/api";

type Ok = Extract<AuthState, { status: "ok" }>;

export function SignInSettings({ state }: { state: Ok }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const [turningOn, setTurningOn] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const c = q.data?.config;
  if (!c) return null;
  const on = state.loginEnabled;
  const others = state.users - 1;
  const refresh = async (st: AuthState) => {
    qc.setQueryData(["me"], st);
    await qc.invalidateQueries({ queryKey: ["settings"] });
    void qc.invalidateQueries({ queryKey: ["users"] });
  };
  const saveDays = async (days: number) => {
    try { await api.saveSettings({ security: { sessionDays: days } }); await qc.invalidateQueries({ queryKey: ["settings"] }); toast.success("Saved. It applies after a restart."); }
    catch (e) { toast.error((e as Error).message); }
  };
  return (
    <>
      <Card className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-bold">Several users, each signing in</div>
            <p className="mt-0.5 text-[13px] leading-snug text-mute">
              {on ? (state.users === 1 ? "On — you sign in with your name and password. Add people in Settings → Users; each gets their own log." : `On — ${state.users} users, each with their own log and password.`)
                : "Off — no sign-in and one log: yours. Turn it on to add other people (each gets their own log), or to ask for a password before anyone can open the app."}
            </p>
          </div>
          <Toggle label="Several users, each signing in" checked={on} onChange={(v) => (v ? setTurningOn(true) : setConfirmOff(true))} />
        </div>
        {!on && c.server.allowNetwork ? <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">Other devices on your network can open the app, and nobody is asked to sign in. Turn this on unless you trust every device on the network.</p> : null}
        {on ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <span className="text-sm font-semibold">Stay signed in for</span>
            <Segmented label="Stay signed in for" value={c.security.sessionDays} options={[[1, "1 day"], [7, "1 week"], [30, "30 days"], [90, "90 days"]]} onChange={(v) => void saveDays(v)} />
          </div>
        ) : null}
      </Card>
      {on ? <p className="px-1 text-[13px] text-mute">Signed in as <strong>{state.me.name}</strong>. Passwords are set per person in Settings → Users.</p> : null}
      <TurnOnSheet open={turningOn} onClose={() => setTurningOn(false)} name={state.me.name} onDone={refresh} />
      <Confirm open={confirmOff} onOpenChange={setConfirmOff} title="Turn off users and sign-in?" confirmLabel="Turn it off" danger word={others ? undefined : "TURN OFF"}
        body={others
          ? <>There {others === 1 ? "is 1 other user" : `are ${others} other users`}. With sign-in off there is only one log, so remove everyone but yourself in Settings → Users first.</>
          : <>Anyone who can open the app goes straight into your log, with no password. Your log stays; your password is removed (you choose a new one if you turn this on again).</>}
        onConfirm={async () => {
          if (others) { setConfirmOff(false); window.location.hash = "/settings"; return; }
          try { const st = await api.disableUsers(); setConfirmOff(false); await refresh(st); toast.success("Users and sign-in are off."); }
          catch (e) { toast.error((e as Error).message); }
        }} />
    </>
  );
}

function TurnOnSheet({ open, onClose, name: initial, onDone }: { open: boolean; onClose: () => void; name: string; onDone: (st: AuthState) => Promise<void> }) {
  const [name, setName] = useState(initial === "Me" ? "" : initial);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => { setPassword(""); setAgain(""); setError(null); onClose(); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== again) return setError("The two passwords are not the same.");
    setBusy(true);
    try { const st = await api.enableUsers(name, password); await onDone(st); toast.success("Users and sign-in are on. Add people in Settings → Users."); close(); window.location.hash = "/settings"; }
    catch (e2) { setError((e2 as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) close(); }} title="Turn on users and sign-in" subtitle="You become the first user. Your log stays as it is.">
      <form onSubmit={submit} className="space-y-3 pb-2">
        <Field label="Your name" required hint="What you type to sign in.">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoCapitalize="words" maxLength={40} autoFocus />}</Field>
        <Field label="Password" required hint="At least 8 characters.">{(id) => <Input id={id} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />}</Field>
        <Field label="Password again" required>{(id) => <Input id={id} type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />}</Field>
        <ErrorLine text={error} />
        <Button type="submit" variant="accent" size="lg" className="w-full" disabled={busy || !name.trim() || !password}>Turn on</Button>
      </form>
    </Sheet>
  );
}
