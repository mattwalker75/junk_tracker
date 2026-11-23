/** Health import (review, Nov 22 2026): the "same workout" test and the summary the Health card reads */
import { afterEach, describe, expect, it } from "vitest";
import type { HealthWorkout } from "../shared/types.js";
import { scratch, type Scratch } from "./helpers.js";

let s: Scratch | undefined;
afterEach(async () => { await s?.close(); s = undefined; });

const TODAY = "2026-11-22";
const w = (o: Partial<HealthWorkout> = {}): HealthWorkout => ({ id: "hk-1", what: "Run", day: TODAY, time: "07:00", minutes: 45, calories: 400, ...o });
const imp = (b: ReturnType<Scratch["browser"]>, workouts: HealthWorkout[], today = TODAY) => b.call("POST", "/api/health/import", { source: "apple-health", today, workouts });
const acts = async (b: ReturnType<Scratch["browser"]>) => (await b.call("GET", `/api/activities?from=2026-11-01&to=2026-11-30`)).body as { what: string; time: string; source: string }[];

describe("same workout", () => {
  it("a run logged by hand when it ended (Log activity's time starts at now) is not brought in again", async () => {
    s = await scratch();
    const b = s.browser();
    // ran 07:00–07:45 with the watch; opened the app and logged it by hand at 07:47 (the sheet's time = now)
    await b.call("POST", "/api/activities", { what: "Run", minutes: 45, calories: null, day: TODAY, time: "07:47", notes: "" });
    const r = await imp(b, [w()]);
    console.log("added:", r.body.added.length, "skipped:", r.body.skipped, "log:", JSON.stringify((await acts(b)).map((a) => [a.what, a.time, a.source])));
    expect(r.body.added).toHaveLength(0);
  });

  it("one workout recorded by two apps (watch + Strava) comes in once", async () => {
    s = await scratch();
    const b = s.browser();
    const r = await imp(b, [w({ id: "watch-uuid" }), w({ id: "strava-uuid", time: "07:01", minutes: 44, calories: 390 })]);
    console.log("added:", r.body.added.length, JSON.stringify(r.body.added.map((a: { what: string; time: string }) => [a.what, a.time])));
    expect(r.body.added).toHaveLength(1);
  });
});

describe("the card's 'Nothing coming in?' hint", () => {
  it("is not shown to someone whose workouts have been coming in fine", async () => {
    s = await scratch();
    const b = s.browser();
    // last week: three workouts came in
    expect((await imp(b, [w({ id: "a", day: "2026-11-17" }), w({ id: "b", day: "2026-11-19" }), w({ id: "c", day: "2026-11-21" })], "2026-11-21")).body.added).toHaveLength(3);
    // Sunday (the week starts on Sunday): the app opens, nothing new yet
    await imp(b, [w({ id: "a", day: "2026-11-17" }), w({ id: "b", day: "2026-11-19" }), w({ id: "c", day: "2026-11-21" })]);
    const sum = (await b.call("GET", `/api/health/summary?today=${TODAY}`)).body;
    console.log("summary:", JSON.stringify(sum));
    // HealthCard.tsx: {iphone && summary.data?.everSeen === 0 ? "Nothing coming in? …"} — only when nothing has ever come through
    const hintShows = sum.everSeen === 0;
    expect(hintShows).toBe(false);
  });
});
