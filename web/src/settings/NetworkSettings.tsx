/** Network access: this computer only, or other devices too; other names (Tailscale); the port. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Field, Input, Toggle } from "../components/ui";
import { api } from "../lib/api";

export function NetworkSettings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const c = q.data?.config;
  const [hosts, setHosts] = useState("");
  const [port, setPort] = useState("");
  useEffect(() => { if (c) { setHosts(c.server.extraHosts.join(", ")); setPort(String(c.server.port)); } }, [c]);
  if (!c || !q.data) return null;
  const save = async (patch: unknown, msg: string) => {
    try { await api.saveSettings(patch); await qc.invalidateQueries({ queryKey: ["settings"] }); toast.success(msg); }
    catch (e) { toast.error((e as Error).message); }
  };
  return (
    <>
      <Card className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-bold">Allow other devices on my network</div>
            <p className="mt-0.5 text-[13px] leading-snug text-mute">{c.server.allowNetwork ? "On — phones and other computers on your network can open it." : "Off — only this computer can open it (127.0.0.1)."} Applies after a restart.</p>
          </div>
          <Toggle label="Allow other devices on my network" checked={c.server.allowNetwork} onChange={(v) => void save({ server: { allowNetwork: v } }, "Saved. Restart Junk Tracker to apply it.")} />
        </div>
        {c.server.allowNetwork && !c.security.loginEnabled ? <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">Nobody is asked to sign in. Consider Settings → Sign-in.</p> : null}
        {q.data.networkUrls.length ? (
          <div className="border-t border-line pt-3">
            <div className="text-xs font-bold text-mute">Open it from another device at</div>
            <ul className="mt-1 space-y-0.5 font-mono text-[13px]">{q.data.networkUrls.map((u) => <li key={u} className="[overflow-wrap:anywhere]">{u}</li>)}</ul>
          </div>
        ) : null}
      </Card>
      <Card className="space-y-3 p-4">
        <Field label="Other names for this computer" hint="If you reach the app through a VPN such as Tailscale, add that name — for example my-mac.tailnet-name.ts.net. Separate several with commas. Applies at once.">
          {(id) => <Input id={id} value={hosts} onChange={(e) => setHosts(e.target.value)} placeholder="none" autoCapitalize="off" autoCorrect="off" spellCheck={false} className="font-mono" />}
        </Field>
        <Button className="w-full" onClick={() => void save({ server: { extraHosts: hosts.split(/[,\s]+/).filter(Boolean) } }, "Saved.")}>Save names</Button>
      </Card>
      <Card className="space-y-3 p-4">
        <Field label="Port" hint="Applies after a restart; the address becomes http://localhost:<port>.">
          {(id) => <Input id={id} value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="tabular w-32" />}
        </Field>
        <Button className="w-full" onClick={() => void save({ server: { port: Number(port) } }, "Saved. Restart Junk Tracker to apply it.")}>Save port</Button>
      </Card>
    </>
  );
}
