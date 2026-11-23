/** Bring in now pressed while an automatic bring-in (open / come back) is still running (review, Nov 22 2026): it waits, then asks again and says what came of it. */
import { describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
let release: (v: unknown) => void = () => {};
let asked = 0;
vi.mock("sonner", () => ({ toast }));
vi.mock("../web/src/lib/actions", () => ({ LOG_KEYS: [], refresh: async () => {} }));
vi.mock("../web/src/lib/api", () => ({
  api: {
    mySettings: async () => ({ healthImport: true, healthSince: "2026-11-16" }),
    healthImport: async () => ({ added: [], skipped: 0 }),
  },
}));
vi.mock("../web/src/lib/phone", () => ({
  phoneHealth: () => ({
    source: "health-connect",
    status: async () => "ok",
    // Health Connect reads every session and adds up its calories: it takes a while
    workouts: () => (asked++ === 0 ? new Promise((r) => { release = r; }) : Promise.resolve([])),
  }),
}));

describe("Bring in now during an automatic bring-in", () => {
  it("still tells the person what happened", async () => {
    const { bringInWorkouts } = await import("../web/src/lib/health");
    const qc = {} as never;
    const auto = bringInWorkouts(qc); // the app came back to the front
    await new Promise((r) => setTimeout(r, 0));
    const pressed = bringInWorkouts(qc, { now: true }); // the person taps Bring in now on Settings → You
    release([]);
    await Promise.all([auto, pressed]);
    console.log("success toasts:", JSON.stringify(toast.success.mock.calls), "error toasts:", JSON.stringify(toast.error.mock.calls));
    expect(toast.success.mock.calls.length + toast.error.mock.calls.length).toBeGreaterThan(0);
  });
});
