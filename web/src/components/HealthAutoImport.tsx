/** The phone apps only: workouts come in by themselves as the app opens and each time it comes back (lib/health.ts). */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { bringInWorkouts } from "../lib/health";

export function HealthAutoImport() {
  const qc = useQueryClient();
  useEffect(() => {
    void bringInWorkouts(qc);
    const onVis = () => { if (document.visibilityState === "visible") void bringInWorkouts(qc); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [qc]);
  return null;
}
