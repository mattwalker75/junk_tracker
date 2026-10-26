/**
 * The round button with your initials, top right of Home: a menu with Goals, Settings and — with
 * users and sign-in on — Sign out (Matt's pick, Oct 26 2026: Goals sits where people look for it).
 */
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Settings, Target } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { cx, initials } from "./ui";

export function UserMenu({ who, loginEnabled, goals }: { who: string; loginEnabled: boolean; goals: number | undefined }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLAnchorElement>(null);

  // open: the first item has the focus; Esc closes and gives it back to the button
  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const signOut = async () => {
    setOpen(false);
    try { await api.logout(); qc.resetQueries(); } catch (e) { toast.error((e as Error).message); }
  };
  const item = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-base font-bold text-ink hover:bg-surface-2";
  const hint = goals === undefined ? "" : goals ? `${goals} on your list` : "none yet";

  return (
    <div className="relative">
      <button ref={button} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={`Menu — ${who}`}
        className={cx("grid size-10 place-items-center rounded-full text-sm font-bold text-ink-2 hover:brightness-95", open ? "bg-line-2" : "bg-surface-2")}>
        {initials(who) || "?"}
      </button>
      {open ? (
        <>
          <button aria-label="Close the menu" tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default bg-black/10" />
          <div role="menu" aria-label="Menu" className="absolute top-12 right-0 z-40 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-menu">
            <div className="truncate px-3 pt-2 pb-1.5 text-[13px] text-mute">{who}</div>
            <a ref={first} role="menuitem" href="#/goals" onClick={() => setOpen(false)} className={item}>
              <Target className="size-5 text-ink-2" aria-hidden /><span className="flex-1">Goals</span><span className="text-xs font-semibold text-mute">{hint}</span>
            </a>
            <a role="menuitem" href="#/settings" onClick={() => setOpen(false)} className={item}>
              <Settings className="size-5 text-ink-2" aria-hidden /><span className="flex-1">Settings</span>
            </a>
            {/* with sign-in off there is nothing to sign out of */}
            {loginEnabled ? (
              <>
                <div className="mx-1.5 my-1 h-px bg-line" />
                <button role="menuitem" onClick={() => void signOut()} className={item}>
                  <LogOut className="size-5 text-ink-2" aria-hidden /><span className="flex-1">Sign out</span>
                </button>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
