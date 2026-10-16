/**
 * Settings (mockup, round 2): the person on screen, their own splurge sizes and weight options, the
 * Users table (only with users and sign-in on) — then Appearance, Users and sign-in, Network and About, which are the same for everyone.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, LogOut, Pencil } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import type { AuthState } from "../../../shared/types";
import { Button, Card, ErrorLine, Field, Input, Sheet } from "../components/ui";
import { api } from "../lib/api";
import { AppearanceSettings } from "./AppearanceSettings";
import { NetworkSettings } from "./NetworkSettings";
import { SignInSettings } from "./SignInSettings";
import { UsersSettings } from "./UsersSettings";
import { YouSettings } from "./YouSettings";

type Ok = Extract<AuthState, { status: "ok" }>;

const SECTIONS: Record<string, string> = { appearance: "Appearance", signin: "Users and sign-in", network: "Network access", about: "About" };

export function SettingsPage({ section, state }: { section: string | null; state: Ok }) {
  const app = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const sub = section && SECTIONS[section] ? section : null;
  return (
    <main className="pb-safe">
      <header className="flex items-center gap-1 px-2 pt-3 pb-1">
        <a href={sub ? "#/settings" : "#/"} aria-label={sub ? "Back to Settings" : "Back to home"} className="grid size-11 place-items-center rounded-xl hover:bg-surface-2"><ChevronLeft className="size-6" /></a>
        <h1 className="text-lg font-extrabold">{sub ? SECTIONS[sub] : "Settings"}</h1>
      </header>
      <div className="space-y-3 px-4 pb-8">
        {app.data?.restartRequired.length ? (
          <p role="status" className="rounded-xl bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
            Saved. Restart Junk Tracker for the change to take effect: <code className="font-mono font-semibold">./TRACKER.sh --restart</code>
          </p>
        ) : null}
        {sub === "appearance" ? <AppearanceSettings /> : null}
        {sub === "signin" ? <SignInSettings state={state} /> : null}
        {sub === "network" ? <NetworkSettings /> : null}
        {sub === "about" ? <About /> : null}
        {!sub ? <Main state={state} /> : null}
      </div>
    </main>
  );
}

function Main({ state }: { state: Ok }) {
  const qc = useQueryClient();
  const app = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const c = app.data?.config;
  const shown = state.acting ?? state.me;
  const initials = shown.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const [renaming, setRenaming] = useState(false);
  const signOut = async () => {
    try { await api.logout(); qc.resetQueries(); } catch (e) { toast.error((e as Error).message); }
  };
  const themeName = c ? (["light", "dark", "system"].includes(c.appearance.theme) ? { light: "Light", dark: "Dark", system: "System" }[c.appearance.theme] : c.appearance.customThemes.find((t) => t.id === c.appearance.theme)?.name ?? "Custom") : "";
  return (
    <>
      <Card className="flex items-center gap-3 px-4 py-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent font-extrabold text-accent-ink">{initials}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-extrabold">{shown.name}</div>
          <div className="text-[13px] text-mute">{state.acting ? `Switched to from ${state.me.name} · these settings are ${shown.name}'s` : state.loginEnabled ? "Signed in · the settings below are yours" : "The settings below are yours"}</div>
        </div>
        <button onClick={() => setRenaming(true)} className="grid size-10 place-items-center rounded-xl text-mute hover:bg-surface-2" aria-label={`Change the name ${shown.name}`} title="Change the name"><Pencil className="size-4.5" /></button>
        {state.loginEnabled ? <button onClick={signOut} className="grid size-10 place-items-center rounded-xl text-mute hover:bg-surface-2" aria-label="Sign out" title="Sign out"><LogOut className="size-5" /></button> : null}
      </Card>
      <RenameSheet open={renaming} onClose={() => setRenaming(false)} id={shown.id} name={shown.name} />
      <YouSettings />
      {state.loginEnabled ? <UsersSettings /> : null}
      <Card className="px-4 py-1">
        <Row href="#/settings/appearance" label="Appearance" value={themeName} />
        <Row href="#/settings/signin" label="Users and sign-in" value={state.loginEnabled ? `On · ${state.users} ${state.users === 1 ? "user" : "users"}` : "Off · just you"} />
        <Row href="#/settings/network" label="Network access" value={c ? (c.server.allowNetwork ? "Other devices too" : "This computer only") : ""} />
        <Row href="#/settings/about" label="About" value={app.data ? `Version ${app.data.version}` : ""} last />
      </Card>
    </>
  );
}

/** A new name for the person on screen (with the login off the one person starts as "Me"). */
function RenameSheet({ open, onClose, id, name }: { open: boolean; onClose: () => void; id: string; name: string }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setValue(name); setError(null); } }, [open, name]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try { await api.rename(id, value); await qc.invalidateQueries({ queryKey: ["me"] }); void qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Name changed."); onClose(); }
    catch (e2) { setError((e2 as Error).message); }
  };
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }} title="Change the name">
      <form onSubmit={submit} className="space-y-3 pb-2">
        <Field label="Name">{(fid) => <Input id={fid} value={value} onChange={(e) => setValue(e.target.value)} autoCapitalize="words" autoComplete="off" maxLength={40} autoFocus />}</Field>
        <ErrorLine text={error} />
        <Button type="submit" variant="accent" size="lg" className="w-full" disabled={!value.trim()}>Save name</Button>
      </form>
    </Sheet>
  );
}

function Row({ href, label, value, last }: { href: string; label: string; value: ReactNode; last?: boolean }) {
  return (
    <a href={href} className={`flex min-h-13 items-center justify-between gap-3 py-3.5 ${last ? "" : "border-b border-line"}`}>
      <span className="font-semibold">{label}</span>
      <span className="flex items-center gap-1 text-sm text-mute">{value}<ChevronRight className="size-4" /></span>
    </a>
  );
}

function About() {
  const app = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  if (!app.data) return null;
  return (
    <Card className="space-y-3 p-4 text-sm">
      <div><div className="font-bold">Junk Tracker {app.data.version}</div><div className="text-mute">Track only your junk food and your weight.</div></div>
      <div><div className="text-xs font-bold text-mute">Settings file</div><div className="font-mono text-[13px] [overflow-wrap:anywhere]">{app.data.configFile}</div></div>
      <div><div className="text-xs font-bold text-mute">Database</div><div className="font-mono text-[13px] [overflow-wrap:anywhere]">{app.data.databaseFile}</div>
        <div className="mt-1 text-mute">One SQLite file holds every person's log. To back it up, copy it (with the app stopped: <code className="font-mono">./TRACKER.sh --stop</code>).</div></div>
    </Card>
  );
}
