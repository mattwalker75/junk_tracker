/**
 * Settings (mockup, round 2): the person on screen, their own splurge sizes and weight options, the
 * Users table — then Appearance, Sign-in, Network and About, which are the same for everyone.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import type { AuthState } from "../../../shared/types";
import { Card } from "../components/ui";
import { api } from "../lib/api";
import { AppearanceSettings } from "./AppearanceSettings";
import { NetworkSettings } from "./NetworkSettings";
import { SignInSettings } from "./SignInSettings";
import { UsersSettings } from "./UsersSettings";
import { YouSettings } from "./YouSettings";

type Ok = Extract<AuthState, { status: "ok" }>;

const SECTIONS: Record<string, string> = { appearance: "Appearance", signin: "Sign-in", network: "Network access", about: "About" };

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
        {state.loginEnabled ? <button onClick={signOut} className="grid size-10 place-items-center rounded-xl text-mute hover:bg-surface-2" aria-label="Sign out" title="Sign out"><LogOut className="size-5" /></button> : null}
      </Card>
      <YouSettings />
      <UsersSettings />
      <Card className="px-4 py-1">
        <Row href="#/settings/appearance" label="Appearance" value={themeName} />
        <Row href="#/settings/signin" label="Sign-in" value={c ? (c.security.loginEnabled ? "On" : "Off") : ""} />
        <Row href="#/settings/network" label="Network access" value={c ? (c.server.allowNetwork ? "Other devices too" : "This computer only") : ""} />
        <Row href="#/settings/about" label="About" value={app.data ? `Version ${app.data.version}` : ""} last />
      </Card>
    </>
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
