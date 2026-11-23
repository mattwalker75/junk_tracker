/**
 * True inside the iPhone / Android app (APP_PORTS/), where the log is kept on the phone and there is no
 * server: Settings then hides what only a server has (Users and sign-in, Network access, the files).
 * The phone build sets VITE_CC_PHONE; the web app's own build never does.
 */
import type { HealthSource } from "../../../shared/types";

export const PHONE_APP: boolean = import.meta.env.VITE_CC_PHONE === "1";

/**
 * The phone's health app (Matt, Nov 22 2026): Apple Health in the iPhone app, Health Connect in the Android app.
 * The app's shell answers these (APP_PORTS/shared/src/health.ts puts it on window.ccHealth); the web app has none.
 */
export interface PhoneHealth {
  source: HealthSource;
  /** "ok"; "unavailable" — this device has no health app (an iPad); "needs-app" — Android needs Health Connect
   *  installed or updated; "no-build" — this build of the app was made without health access */
  status(): Promise<"ok" | "unavailable" | "needs-app" | "no-build">;
  /** the phone's own permission sheet: true when it went through (iPhone can't tell whether reading was allowed) */
  authorize(): Promise<boolean>;
  /** the workouts recorded that started at or after sinceMs */
  workouts(sinceMs: number): Promise<RawWorkout[]>;
  /** Android only: opens Health Connect in the Play Store, to install or update it */
  getApp?(): void;
}
/** a workout as the phone's health app has it; `what` is already our name for its kind (Walk, Run, Strength training…) */
export interface RawWorkout { id: string; what: string; startMs: number; endMs: number; calories: number | null }

export function phoneHealth(): PhoneHealth | null {
  if (!PHONE_APP) return null;
  return (window as unknown as { ccHealth?: PhoneHealth | null }).ccHealth ?? null;
}
