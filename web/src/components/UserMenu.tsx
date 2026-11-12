/**
 * The round button with your initials, top right of Home: a menu with Goals, Settings and — with
 * users and sign-in on — Sign out (Matt's pick, Oct 26 2026: Goals sits where people look for it).
 * Craving Crusher (mockup GameMenuSwitch, Nov 11 2026): on tracker pages **Game mode** (a gamepad)
 * sits above them all; on game pages the same menu wears the game's look and starts with **Back to
 * tracker**. There is no setting: the item is always there and the run waits until you start one.
 */
import { useQueryClient } from "@tanstack/react-query";
import { House, LogOut, Settings, Target } from "lucide-react";
import { Gamepad } from "../game/icons";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { cx, initials } from "./ui";

export function UserMenu({ who, loginEnabled, goals, place = "tracker" }: { who: string; loginEnabled: boolean; goals: number | undefined; place?: "tracker" | "game" }) {
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

  if (place === "game") {
    const gItem = "flex min-h-11 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[15px] font-extrabold text-g-text hover:bg-g-soft-yellow";
    return (
      <div className="relative">
        <button ref={button} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={`Menu — ${who}`}
          className="g-btn grid size-11 shrink-0 place-items-center rounded-full bg-g-yellow text-sm font-black">
          {initials(who) || "?"}
        </button>
        {open ? (
          <>
            <button aria-label="Close the menu" tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default bg-[#2b1d3a]/20" />
            <div role="menu" aria-label="Menu" className="g-panel absolute top-[54px] right-0 z-40 w-[230px] rounded-2xl p-1.5">
              <div className="truncate px-2.5 pt-1.5 pb-1 text-[13px] font-bold text-g-mute">{who}</div>
              <a ref={first} role="menuitem" href="#/" onClick={() => setOpen(false)} className={cx(gItem, "bg-g-yellow text-g-on hover:bg-g-yellow")}>
                <House className="size-5" strokeWidth={2.6} aria-hidden /><span className="flex-1">Back to tracker</span>
              </a>
              <div className="mx-1.5 my-1 h-0.5 bg-g-dash" />
              <a role="menuitem" href="#/goals" onClick={() => setOpen(false)} className={gItem}>
                <Target className="size-5" aria-hidden /><span className="flex-1">Goals</span>
              </a>
              <a role="menuitem" href="#/settings" onClick={() => setOpen(false)} className={gItem}>
                <Settings className="size-5" aria-hidden /><span className="flex-1">Settings</span>
              </a>
              {loginEnabled ? (
                <>
                  <div className="mx-1.5 my-1 h-0.5 bg-g-dash" />
                  <button role="menuitem" onClick={() => void signOut()} className={gItem}>
                    <LogOut className="size-5" aria-hidden /><span className="flex-1">Sign out</span>
                  </button>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    );
  }

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
            <a ref={first} role="menuitem" href="#/game" onClick={() => setOpen(false)} className={item}>
              <Gamepad className="size-[22px] text-ink-2" /><span className="flex-1">Game mode</span>
            </a>
            <div className="mx-1.5 my-1 h-px bg-line" />
            <a role="menuitem" href="#/goals" onClick={() => setOpen(false)} className={item}>
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
