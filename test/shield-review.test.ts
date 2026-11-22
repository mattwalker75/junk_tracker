/** Veggie Shield (review, Nov 22 2026): a shield whose blocked heal no longer happens goes back up — a monster's own heals too (ARCHITECTURE Stage 4). */
import { describe, expect, it } from "vitest";
import { addDays, deadlineFor, newRun, settle, simulateFight, fightInputFor, usePowerUp, type ActivityEv, type GameClock, type GameLog, type SplurgeEv } from "../shared/game/index.js";

const D = "2026-11-10";
let ids = 0;
const clock = (today: string, nowTime = "", nowIso = `${today}T20:00:00.000Z`): GameClock => ({ today, nowTime, nowIso, newId: () => `id${++ids}` });
const logOf = (splurges: SplurgeEv[] = [], activities: ActivityEv[] = []): GameLog => ({ splurges, activities, entriesSinceStart: 0, weekStart: 0 });
const runAt = (level: number) => {
  const st = newRun(1, "normal", clock(D, "", `${D}T00:00:01.000Z`)).state;
  st.fights[0].level = level; st.fights[0].deadlineOn = deadlineFor(level, D, false);
  return st;
};

describe("a shield spent on a heal that no longer happens", () => {
  it("Slurp's blocked +5 vanishes when a workout is backdated to that day, but the shield stays spent", () => {
    // Shake Ooze (level 28, Slurp: +5 every day without a workout). Hit it first so the +5 is a real heal.
    const hit: ActivityEv = { id: "hit", what: "Run", day: addDays(D, -1), time: "07:00", minutes: null, calories: null, createdAt: `${D}T00:00:00.000Z` };
    const w1: ActivityEv = { id: "w1", what: "Run", day: D, time: "07:00", minutes: 100, calories: null, createdAt: `${D}T07:00:00.000Z` };
    let st = runAt(28);
    st.run.shields = 1;
    // day 1 (D): a workout at 07:00, then the shield goes up at 10:00 — nothing heals on D (it worked out)
    st = usePowerUp(st, logOf([], [hit, w1]), clock(D, "10:00", `${D}T10:00:00.000Z`), "shield").state;
    // day 2 (D+1): no workout; at its midnight Slurp heals +5 and the shield blocks it (synced on D+2)
    const D2 = addDays(D, 1), D3 = addDays(D, 2);
    let out = settle(st, logOf([], [hit, w1]), clock(D3));
    expect(out.added.filter((e) => e.kind === "powerup_used").map((e) => e.data.healId)).toEqual([`slurp:${D2}`]);
    st = out.state;
    expect(st.run.shieldArmed).toBe(false);
    // the person remembers a walk on D+1 and logs it (backdated): Slurp no longer heals that night
    const walk: ActivityEv = { id: "w2", what: "Walk", day: D2, time: "08:00", minutes: 20, calories: null, createdAt: `${D3}T09:00:00.000Z` };
    const feast: SplurgeEv = { id: "f1", what: "Pizza", day: D3, time: "12:00", size: "feast", planned: false, createdAt: `${D3}T12:00:00.000Z` };
    const log = logOf([feast], [hit, w1, walk]);
    out = settle(st, log, clock(D3, "", `${D3}T13:00:00.000Z`));
    const f = out.state.fights[0];
    const sim = simulateFight(fightInputFor(out.state, f, log, D3));
    // nothing was blocked in the fight any more …
    expect(sim.lines.some((l) => l.kind === "heal" && l.sourceId === `slurp:${D2}`)).toBe(false);
    // … so, like a deleted splurge, the shield should be up again and block the pizza
    expect({ armed: out.state.run.shieldArmed, pizzaBlocked: sim.lines.some((l) => l.kind === "blocked" && l.sourceId === "f1") }).toEqual({ armed: false, pizzaBlocked: true });
  });

  it("Long Chew's blocked 'then 5 more' vanishes when the snack is changed to a Meal, but the shield stays spent", () => {
    // Jerky Gator (level 3): Snacks heal 10, then 5 more the next day
    const D2 = addDays(D, 1);
    const hit: ActivityEv = { id: "hit", what: "Run", day: D, time: "06:00", minutes: 60, calories: null, createdAt: `${D}T06:00:00.000Z` };
    const warm: ActivityEv = { id: "warm", what: "Walk", day: addDays(D, -1), time: "07:00", minutes: null, calories: null, createdAt: `${D}T00:00:00.000Z` };
    const snack: SplurgeEv = { id: "sn", what: "Chips", day: D, time: "09:00", size: "snack", planned: false, createdAt: `${D}T09:00:00.000Z` };
    let st = runAt(3);
    st.run.shields = 1;
    st = settle(st, logOf([snack], [warm, hit]), clock(D, "", `${D}T09:30:00.000Z`)).state;
    // the shield goes up at 10:00 on D: the snack (09:00) already healed; tomorrow's +5 is the next heal
    st = usePowerUp(st, logOf([snack], [warm, hit]), clock(D, "10:00", `${D}T10:00:00.000Z`), "shield").state;
    let out = settle(st, logOf([snack], [warm, hit]), clock(D2, "", `${D2}T08:00:00.000Z`));
    expect(out.added.filter((e) => e.kind === "powerup_used").map((e) => e.data.healId)).toEqual(["sn:later"]);
    // the person corrects the size: it was a Meal (no "then 5 more"); then a Feast on D+1
    const meal = { ...snack, size: "meal" as const };
    const feast: SplurgeEv = { id: "fe", what: "Pizza", day: D2, time: "12:00", size: "feast", planned: false, createdAt: `${D2}T12:00:00.000Z` };
    const log = logOf([meal, feast], [warm, hit]);
    out = settle(out.state, log, clock(D2, "", `${D2}T13:00:00.000Z`));
    const sim = simulateFight(fightInputFor(out.state, out.state.fights[0], log, D2));
    expect({ armed: out.state.run.shieldArmed, pizzaBlocked: sim.lines.some((l) => l.kind === "blocked" && l.sourceId === "fe") }).toEqual({ armed: false, pizzaBlocked: true });
  });
});
