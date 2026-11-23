/** The strip at the top while you look at someone else's log (Settings → Users → Switch to). */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Button } from "./ui";

export function SwitchedStrip({ acting, me }: { acting: string; me: string }) {
  const qc = useQueryClient();
  // its height goes to --jt-strip-h, so messages (main.tsx) sit below it and the header too, never over the initials
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement.style;
    const set = () => root.setProperty("--jt-strip-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); root.removeProperty("--jt-strip-h"); };
  }, []);
  const back = async () => {
    try { await api.switchBack(); qc.resetQueries(); }
    catch (e) { toast.error((e as Error).message); }
  };
  return (
    <div ref={ref} role="status" className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-accent-soft px-4 py-2 text-sm text-accent-text">
      <span className="min-w-0 flex-1">You are in <strong>{acting}</strong>'s log.</span>
      <Button size="sm" variant="accent" onClick={back}>Back to {me}</Button>
    </div>
  );
}
