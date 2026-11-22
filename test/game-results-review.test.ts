/**
 * Result screens (deep review, Nov 22 2026): the screens a sync's events turn into (web/src/game/outcomes.ts), with
 * events made by the real engine, and the game's routes for every world.
 */
import { describe, expect, it } from "vitest";
import { addDays, newRun, settle, toEventView, WORLDS, type GameClock, type GameLog } from "../shared/game/index.js";
import { planResults } from "../web/src/game/outcomes";
import { parse } from "../web/src/lib/route";

const T = "2026-11-22";
let n = 0;
const clock = (today: string): GameClock => ({ today, nowTime: "12:00", nowIso: `${today}T12:00:00.000Z`, newId: () => `e${n++}` });
// a snack every day, so no clean-day crit knocks Crumbs out
const snacks = Array.from({ length: 8 }, (_, i) => { const day = addDays(T, i - 6); return { id: `s${i}`, what: "Chips", day, time: "", size: "snack" as const, planned: false, createdAt: `${day}T20:00:00.000Z` }; });
const log: GameLog = { splurges: snacks, activities: [], entriesSinceStart: 0, entryDays: [], weekStart: 0, hpMult: 1 };

/** Crumbs, due T-3, with `hearts` left and `lives` extra lives; settled at T: one strike a day for T-3, T-2, T-1. */
function awayThreeDays(mode: "normal" | "hardcore", hearts: number, lives = 0) {
  const st = newRun(1, mode, clock(addDays(T, -5))).state;
  st.run.hearts = hearts; st.run.lives = lives;
  const out = settle(st, log, clock(T));
  return out.added.map(toEventView);
}

describe("several missed days in one sync, the last one taking the last heart", () => {
  for (const [mode, lives, last] of [["normal", 0, "knockback"], ["hardcore", 0, "defeat"], ["normal", 1, "life"]] as const) {
    it(`${mode}${lives ? " with an extra life" : ""}: the strikes come first, in order, and the ${last} screen is the one for the last heart`, () => {
      const events = awayThreeDays(mode, 3, lives);
      const strikes = events.filter((e) => e.kind === "strike");
      expect(strikes.map((e) => e.data.hearts)).toEqual([2, 1, 0]);
      const plan = planResults(events);
      expect(plan.results.map((r) => r.kind)).toEqual(["strike", "strike", last]);
      // the last-heart screen tells about the strike that took the last heart
      const end = plan.results[2] as { strike: { data: Record<string, unknown> } };
      expect(end.strike.data.hearts).toBe(0);
    });
  }
});

describe("the game's routes", () => {
  it("every world has its own up-close page (worlds 7 to 12 too)", () => {
    expect(WORLDS.length).toBe(12);
    for (let w = 1; w <= WORLDS.length; w++) expect(parse(`#/game/world/${w}`)).toEqual({ page: "game", screen: "world", world: w });
  });
});
