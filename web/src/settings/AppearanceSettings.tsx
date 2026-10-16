/** Appearance: Light, Dark, System, or a theme of your own (made here, with a live preview). The same for everyone. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { CustomTheme } from "../../../shared/types";
import { Button, Card, Confirm, cx, Field, Input, Sheet, Toggle } from "../components/ui";
import { api } from "../lib/api";
import { applyTheme, currentTokens, rememberTheme, THEME_TOKENS } from "../lib/theme";

const BUILT_IN: [string, string, string[]][] = [
  ["light", "Light", ["#f6f7f9", "#ffffff", "#1d5fd1", "#e8711a"]],
  ["dark", "Dark", ["#0f1115", "#1a1e26", "#ffb547", "#ff9b4a"]],
  ["system", "System", ["#f6f7f9", "#0f1115", "#1d5fd1", "#ffb547"]],
];

export function AppearanceSettings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const [editing, setEditing] = useState<CustomTheme | null>(null);
  const [deleting, setDeleting] = useState<CustomTheme | null>(null);
  const a = q.data?.config.appearance;
  if (!a) return null;

  /** true when saved; on a failure the page goes back to the look that is really saved */
  const save = async (theme: string, customThemes = a.customThemes): Promise<boolean> => {
    try {
      await api.saveSettings({ appearance: { theme, customThemes } });
      applyTheme(theme, customThemes); rememberTheme(theme, customThemes);
      await qc.invalidateQueries({ queryKey: ["settings"] });
      await qc.invalidateQueries({ queryKey: ["appearance"] });
      return true;
    } catch (e) { toast.error((e as Error).message); applyTheme(a.theme, a.customThemes); return false; }
  };

  const Swatch = ({ colors }: { colors: string[] }) => (
    <span className="flex h-9 w-14 shrink-0 overflow-hidden rounded-lg border border-line" aria-hidden>{colors.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</span>
  );

  return (
    <>
      <Card className="px-4 py-1">
        <p className="pt-3 pb-1 text-[13px] text-mute">The look is the same for everyone who uses Junk Tracker. System follows the phone or computer, including dark mode at night.</p>
        {BUILT_IN.map(([id, name, colors]) => (
          <button key={id} onClick={() => void save(id)} className="flex min-h-14 w-full items-center gap-3 border-b border-line py-2.5 text-left" aria-pressed={a.theme === id}>
            <Swatch colors={colors} /><span className="flex-1 font-semibold">{name}</span>
            {a.theme === id ? <Check className="size-5 text-accent" aria-label="in use" /> : null}
          </button>
        ))}
        {a.customThemes.map((t) => (
          <div key={t.id} className="flex min-h-14 items-center gap-3 border-b border-line py-2.5">
            <button onClick={() => void save(t.id)} className="flex flex-1 items-center gap-3 text-left" aria-pressed={a.theme === t.id}>
              <Swatch colors={[t.tokens.bg, t.tokens.surface, t.tokens.accent, t.tokens.meal].filter(Boolean)} />
              <span className="flex-1 font-semibold [overflow-wrap:anywhere]">{t.name}</span>
              {a.theme === t.id ? <Check className="size-5 text-accent" aria-label="in use" /> : null}
            </button>
            <button className="grid size-10 place-items-center rounded-xl text-mute hover:bg-surface-2" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)}><Pencil className="size-4" /></button>
            <button className="grid size-10 place-items-center rounded-xl text-mute hover:bg-surface-2" aria-label={`Delete ${t.name}`} onClick={() => setDeleting(t)}><Trash2 className="size-4" /></button>
          </div>
        ))}
        <div className="py-3"><Button className="w-full" onClick={() => setEditing({ id: "", name: "", dark: document.documentElement.dataset.theme === "dark", tokens: currentTokens() })}>New theme…</Button></div>
      </Card>
      <ThemeEditor theme={editing} onClose={() => { setEditing(null); applyTheme(a.theme, a.customThemes); }}
        onSave={async (t) => {
          const list = t.id && a.customThemes.some((x) => x.id === t.id) ? a.customThemes.map((x) => (x.id === t.id ? t : x)) : [...a.customThemes, { ...t, id: `t${Date.now().toString(36)}` }];
          const id = t.id || list.at(-1)!.id;
          if (!(await save(id, list))) { applyTheme("", [], t); return; } // keep the editor (and its preview) open to try again
          setEditing(null);
          toast.success(`Theme “${t.name}” saved and in use.`);
        }} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title={`Delete “${deleting?.name}”?`} confirmLabel="Delete" danger
        body={a.theme === deleting?.id ? "It is in use now; the look goes back to System." : "Only the theme goes — nothing else changes."}
        onConfirm={async () => { if (!deleting) return; const list = a.customThemes.filter((x) => x.id !== deleting.id); await save(a.theme === deleting.id ? "system" : a.theme, list); setDeleting(null); }} />
    </>
  );
}

function ThemeEditor({ theme, onClose, onSave }: { theme: CustomTheme | null; onClose: () => void; onSave: (t: CustomTheme) => Promise<void> }) {
  const [t, setT] = useState<CustomTheme | null>(theme);
  useEffect(() => { setT(theme); }, [theme]);
  // the page wears the theme while it is being made
  useEffect(() => { if (t) applyTheme("", [], t); }, [t]);
  if (!t) return <Sheet open={false} onOpenChange={() => {}} title="">{null}</Sheet>;
  return (
    <Sheet open={!!theme} onOpenChange={(o) => { if (!o) onClose(); }} title={t.id ? `Edit “${t.name}”` : "New theme"} subtitle="The app changes as you pick colours.">
      <div className="space-y-3 pb-2">
        <Field label="Name">{(id) => <Input id={id} value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} placeholder="e.g. Midnight" maxLength={40} />}</Field>
        <div className="flex items-center justify-between"><span className="text-sm font-semibold">Dark theme (dark page, light text)</span><Toggle label="Dark theme" checked={t.dark} onChange={(v) => setT({ ...t, dark: v })} /></div>
        <div className="grid grid-cols-2 gap-2">
          {THEME_TOKENS.map(([k, label]) => (
            <label key={k} className="flex items-center gap-2.5 rounded-xl border border-line px-2.5 py-2">
              <input type="color" value={t.tokens[k] || "#888888"} onChange={(e) => setT({ ...t, tokens: { ...t.tokens, [k]: e.target.value } })} className={cx("size-8 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0")} aria-label={label} />
              <span className="text-[13px] leading-tight">{label}</span>
            </label>
          ))}
        </div>
        <Button variant="accent" size="lg" className="w-full" disabled={!t.name.trim()} onClick={() => void onSave({ ...t, name: t.name.trim() })}>Save and use</Button>
      </div>
    </Sheet>
  );
}
