/** Users: everyone with a log. Add someone (name + password), set anyone's password, switch to them, remove them. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { UserInfo } from "../../../shared/types";
import { Button, Card, Confirm, ErrorLine, Field, Input, Sheet } from "../components/ui";
import { api } from "../lib/api";
import { ago, today as todayOf } from "../lib/dates";

export function UsersSettings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["users"], queryFn: api.users });
  const [pw, setPw] = useState<UserInfo | null>(null);
  const [removing, setRemoving] = useState<UserInfo | null>(null);
  const today = todayOf();

  const switchTo = async (u: UserInfo) => {
    try { const st = await api.switchTo(u.id); qc.setQueryData(["me"], st); qc.resetQueries({ predicate: (x) => x.queryKey[0] !== "me" }); window.location.hash = "/"; toast.success(`You are in ${u.name}'s log.`); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Card className="p-4">
      <h2 className="text-[15px] font-extrabold">Users</h2>
      <p className="mt-0.5 text-[13px] text-mute">Each person has their own log and settings and signs in with their own password. Anyone can switch to anyone — to see their log or fill it in for them.</p>
      {/* a list rather than a table: on a phone the name gets its own line and the buttons sit under it */}
      <ul className="mt-2">
        {(q.data ?? []).map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line py-3">
            <div className="min-w-0 flex-1 basis-40">
              <div className="font-bold [overflow-wrap:anywhere]">{u.name}{u.isYou ? <span className="font-medium text-mute"> (you)</span> : null}</div>
              <div className="text-[13px] text-mute">{u.isYou ? "Using it now" : u.lastUsedAt ? `Last used ${ago(u.lastUsedAt.slice(0, 10), today)}` : "Not used yet"}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {!u.isYou ? <Button size="sm" variant="soft" onClick={() => void switchTo(u)}>Switch to</Button> : null}
              <Button size="sm" onClick={() => setPw(u)}>Password</Button>
              {!u.isYou ? <Button size="sm" variant="danger" onClick={() => setRemoving(u)} aria-label={`Remove ${u.name}`}>Remove</Button> : null}
            </div>
          </li>
        ))}
      </ul>
      <AddUser />
      <PasswordSheet user={pw} onClose={() => setPw(null)} />
      <Confirm open={!!removing} onOpenChange={(o) => { if (!o) setRemoving(null); }} title={`Remove ${removing?.name}?`} word="DELETE" danger confirmLabel="Remove"
        body={<>{removing?.name}'s splurges, weigh-ins and settings are deleted with them. This cannot be undone.</>}
        onConfirm={async () => {
          if (!removing) return;
          try { await api.removeUser(removing.id); toast.success(`Removed ${removing.name}.`); setRemoving(null); void qc.invalidateQueries({ queryKey: ["users"] }); void qc.invalidateQueries({ queryKey: ["me"] }); }
          catch (e) { toast.error((e as Error).message); }
        }} />
    </Card>
  );
}

function AddUser() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== again) return setError("The two passwords are not the same.");
    setBusy(true);
    try { const u = await api.addUser(name, password); toast.success(`Added ${u.name}.`); setName(""); setPassword(""); setAgain(""); void qc.invalidateQueries({ queryKey: ["users"] }); }
    catch (e2) { setError((e2 as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="mt-3 space-y-2.5 border-t border-line pt-3.5">
      <h3 className="text-sm font-extrabold">Add a user</h3>
      <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jordan" autoCapitalize="words" autoComplete="off" className="h-11" />}</Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Password">{(id) => <Input id={id} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="h-11" />}</Field>
        <Field label="Password again">{(id) => <Input id={id} type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" className="h-11" />}</Field>
      </div>
      <ErrorLine text={error} />
      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={busy || !name.trim() || !password}>Create user</Button>
    </form>
  );
}

function PasswordSheet({ user, onClose }: { user: UserInfo | null; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const close = () => { setPassword(""); setAgain(""); setError(null); onClose(); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (password !== again) return setError("The two passwords are not the same.");
    try { await api.setPassword(user.id, password); toast.success(user.isYou ? "Your password is changed." : `${user.name}'s password is changed.`); close(); }
    catch (e2) { setError((e2 as Error).message); }
  };
  return (
    <Sheet open={!!user} onOpenChange={(o) => { if (!o) close(); }} title={user?.isYou ? "Change your password" : `New password for ${user?.name}`}>
      <form onSubmit={submit} className="space-y-3 pb-2">
        <Field label="New password" hint="At least 8 characters.">{(id) => <Input id={id} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />}</Field>
        <Field label="New password again">{(id) => <Input id={id} type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />}</Field>
        {!user?.isYou ? <p className="text-sm text-mute">If signing in is on, {user?.name} is signed out on every device and signs in with this one.</p> : null}
        <ErrorLine text={error} />
        <Button type="submit" variant="accent" size="lg" className="w-full" disabled={!password}>Set password</Button>
      </form>
    </Sheet>
  );
}
