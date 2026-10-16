/** Sign-in: off (anyone who opens the app is its first person, and can switch), or on (everyone signs in with their name and password). */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { AuthState } from "../../../shared/types";
import { Card, Confirm, Segmented, Toggle } from "../components/ui";
import { api } from "../lib/api";

type Ok = Extract<AuthState, { status: "ok" }>;

export function SignInSettings({ state }: { state: Ok }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const [confirmOff, setConfirmOff] = useState(false);
  const c = q.data?.config;
  if (!c) return null;
  const save = async (patch: unknown, msg: string) => {
    try { await api.saveSettings(patch); await qc.invalidateQueries({ queryKey: ["settings"] }); await qc.invalidateQueries({ queryKey: ["me"] }); toast.success(msg); }
    catch (e) { toast.error((e as Error).message); }
  };
  const on = c.security.loginEnabled;
  return (
    <>
      <Card className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-bold">Ask everyone to sign in</div>
            <p className="mt-0.5 text-[13px] leading-snug text-mute">
              {on ? "On — each person signs in with their name and password. This browser stays signed in as you."
                : "Off — whoever opens the app is in the first person's log, and can switch to anyone in Settings → Users. Fine on a computer only you use."}
            </p>
          </div>
          <Toggle label="Ask everyone to sign in" checked={on} onChange={(v) => (v ? void save({ security: { loginEnabled: true } }, "Signing in is on. Everyone uses the password set for them in Users.") : setConfirmOff(true))} />
        </div>
        {!on && c.server.allowNetwork ? <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">Other devices on your network can open the app, and nobody is asked to sign in. Turn this on unless you trust every device on the network.</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <span className="text-sm font-semibold">Stay signed in for</span>
          <Segmented label="Stay signed in for" value={c.security.sessionDays} options={[[1, "1 day"], [7, "1 week"], [30, "30 days"], [90, "90 days"]]}
            onChange={(v) => void save({ security: { sessionDays: v } }, "Saved. It applies after a restart.")} />
        </div>
      </Card>
      <p className="px-1 text-[13px] text-mute">Signed in as <strong>{state.me.name}</strong>. Passwords are set per person in Settings → Users.</p>
      <Confirm open={confirmOff} onOpenChange={setConfirmOff} title="Turn signing in off?" confirmLabel="Turn it off" danger
        body="Anyone who can open the app will be in the first person's log, and can switch to anyone. The passwords are kept for when it is turned on again."
        onConfirm={async () => { setConfirmOff(false); await save({ security: { loginEnabled: false } }, "Signing in is off."); }} />
    </>
  );
}
