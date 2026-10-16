/** Signing in (users and sign-in on), and — only if config.json turned the login on by hand — choosing the first name and password. */
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { Button, ErrorLine, Field, Input } from "./ui";

export function AuthScreen({ mode }: { mode: "setup" | "signin" }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setup = mode === "setup";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (setup && password !== again) return setError("The two passwords are not the same.");
    setBusy(true);
    try {
      const st = setup ? await api.setup(name, password) : await api.login(name, password);
      qc.setQueryData(["me"], st);
      qc.resetQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    } catch (e2) { setError((e2 as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-6 flex items-center gap-3">
        <img src="/icon.svg" alt="" className="size-11 rounded-xl" />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Junk Tracker</h1>
          <p className="text-sm text-mute">{setup ? "Let's set you up." : "Sign in to your log."}</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-3xl border border-line bg-surface p-5 shadow-soft">
        {setup ? <p className="text-[15px] leading-relaxed text-ink-2">Signing in is on, but nobody has a password yet. Choose your name and password — you can add more people afterwards in Settings → Users.</p> : null}
        <Field label="Name" required>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoCapitalize="words" autoFocus required />}</Field>
        <Field label="Password" required hint={setup ? "At least 8 characters." : undefined}>
          {(id) => <Input id={id} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={setup ? "new-password" : "current-password"} required />}
        </Field>
        {setup ? <Field label="Password again" required>{(id) => <Input id={id} type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />}</Field> : null}
        <ErrorLine text={error} />
        <Button type="submit" variant="accent" size="lg" className="w-full" disabled={busy || !name.trim() || !password}>{setup ? "Start tracking" : "Sign in"}</Button>
      </form>
    </main>
  );
}
