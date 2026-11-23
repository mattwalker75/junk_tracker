/**
 * Health import before the game's daily settle (review, Nov 22 2026): last night's run still coming in from Health
 * must count before a missed deadline costs a heart. The game screen's view (web/src/game/state.ts) waits for the
 * bring-in (workoutsIn) before its daily check; workoutsIn joins a bring-in that is already running.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

let release: (v: unknown) => void = () => {};
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../web/src/lib/actions", () => ({ LOG_KEYS: [], refresh: async () => {} }));
vi.mock("../web/src/lib/api", () => ({
  api: { mySettings: async () => ({ healthImport: true, healthSince: "2026-11-16" }), healthImport: async () => ({ added: [], skipped: 0 }) },
}));
vi.mock("../web/src/lib/phone", () => ({
  phoneHealth: () => ({ source: "apple-health", status: async () => "ok", workouts: () => new Promise((r) => { release = r; }) }),
}));

describe("the game waits for workouts still coming in", () => {
  it("workoutsIn joins the running bring-in and only resolves once it is done", async () => {
    const { bringInWorkouts, workoutsIn } = await import("../web/src/lib/health");
    const qc = {} as never;
    const auto = bringInWorkouts(qc);
    let gameMayGo = false;
    const wait = workoutsIn(qc).then(() => { gameMayGo = true; });
    await new Promise((r) => setTimeout(r, 10));
    expect(gameMayGo).toBe(false);
    release([]);
    await Promise.all([auto, wait]);
    expect(gameMayGo).toBe(true);
  });

  it("the game's view asks for workouts first, then the daily check, then the view", () => {
    const src = fs.readFileSync(path.join(import.meta.dirname, "../web/src/game/state.ts"), "utf8");
    expect(src).toMatch(/queryFn: async \(\) => \{ await workoutsIn\(qc\); await dailyCheck\(today\); return api\.game\(/);
  });
});
