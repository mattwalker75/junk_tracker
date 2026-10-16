/** The strip at the top while you look at someone else's log (Settings → Users → Switch to). */
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Button } from "./ui";

export function SwitchedStrip({ acting, me }: { acting: string; me: string }) {
  const qc = useQueryClient();
  const back = async () => {
    try { await api.switchBack(); qc.resetQueries(); }
    catch (e) { toast.error((e as Error).message); }
  };
  return (
    <div role="status" className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-accent-soft px-4 py-2 text-sm text-accent-text">
      <span className="min-w-0 flex-1">You are in <strong>{acting}</strong>'s log.</span>
      <Button size="sm" variant="accent" onClick={back}>Back to {me}</Button>
    </div>
  );
}
