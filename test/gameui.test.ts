/** Craving Crusher's screen words (web/src/game/logic.ts): the countdown, "So close!", the deadline cards, the battle log rows and the live panels. */
import { describe, expect, it } from "vitest";
import { addDays, deadlineFor, type ActivityEv, type FightInput, type SplurgeEv } from "../shared/game/index.js";
import { attackPanel, betPlan, countdown, dayExample, healPanel, lineRow, mixFor, previewStamp, savedText, shortDate, sizeHeals, soClose } from "../web/src/game/logic";

const D = "2026-11-10"; // a Tuesday
const A = (id: string, minutes: number | null, o: Partial<ActivityEv> = {}): ActivityEv =>
  ({ id, what: "Walk", day: D, time: "07:00", minutes, calories: null, createdAt: `${o.day ?? D}T09:00:00.000Z`, ...o });

/** Fry Hydra (level 11, 250 HP, Regrow: Meals heal 35) at 92 HP: a 158 hit this morning, an activity the day before (no comeback ×2). */
function hydra(o: Partial<FightInput> = {}): FightInput {
  return {
    level: 11, startedOn: D, startedAfter: null, deadlineOn: deadlineFor(11, D, false), today: D,
    splurges: [], activities: [A("warm", null, { day: addDays(D, -1) }), A("big", 158)], ...o,
  };
}
const workout = (minutes: number | null, calories: number | null, o: Partial<{ day: string; time: string }> = {}) =>
  ({ what: "Walk", day: o.day ?? D, time: o.time ?? "18:00", minutes, calories, createdAt: `${D}T23:00:00.000Z` });
const splurge = (size: SplurgeEv["size"] | null, planned = false) => ({ what: "Cheeseburger", day: D, time: "", size, planned, createdAt: `${D}T23:00:00.000Z` });

describe("the deadline countdown", () => {
  it("counts down to midnight at the end of the last day on the phone's clock", () => {
    const c = countdown("2026-11-14", new Date(2026, 10, 11, 19, 47, 12));
    expect(c.digits).toBe("3 · 04:12:48");
    expect(c.big).toBe("3 days 4 h left");
    expect(c.kicker).toBe("DUE END OF SAT NOV 14");
    expect(c.passed).toBe(false);
  });
  it("says hours and minutes on the last day, and Time’s up after", () => {
    expect(countdown("2026-11-14", new Date(2026, 10, 14, 18, 47, 0)).big).toBe("5 h 13 min left");
    expect(countdown("2026-11-14", new Date(2026, 10, 14, 23, 40, 0)).big).toBe("20 min left");
    // the last minute still counts: a log at 23:59 is on the deadline day
    expect(countdown("2026-11-14", new Date(2026, 10, 14, 23, 59, 30)).big).toBe("Under a minute left");
    const over = countdown("2026-11-14", new Date(2026, 10, 15, 0, 5, 0));
    expect(over).toMatchObject({ secs: 0, passed: true, digits: "0 · 00:00:00", big: "Time’s up!", kicker: "DEADLINE PASSED" });
  });
  it("one day", () => {
    expect(countdown("2026-11-14", new Date(2026, 10, 14, 0, 0, 0)).big).toBe("1 day left");
  });
});

describe("So close!", () => {
  it("says it in minutes, calories and a mix (the mockup's 92 HP)", () => {
    expect(soClose(92)).toEqual({ title: "So close!", hp: 92, minutes: "92", calories: "920", mix: "a 45-min run burning 470 cal" });
  });
  it("further off it is still in reach; at 0 it is finished", () => {
    expect(soClose(250).title).toBe("Still in reach!");
    expect(soClose(250).calories).toBe("2,500");
    expect(soClose(0).title).toBe("Finished!");
  });
  it("mixes a workout for any size of hit", () => {
    expect(mixFor(15)).toBe("one 15-min walk");
    expect(mixFor(30)).toBe("a 20-min walk burning 100 cal");
    expect(mixFor(160)).toBe("a 60-min ride burning 1,000 cal");
  });
});

describe("Choose your fight", () => {
  it("works out what a day takes for each deadline (Queso Kraken, 260 HP, 5 days)", () => {
    const p = betPlan({ bet: 1, deadlineOn: addDays(D, 4) }, { hp: 260, max: 260, boss: false }, D, false);
    expect(p).toMatchObject({ label: "Steady", days: 5, perDay: 52, example: "a 35-min walk burning 170 cal", worth: 520, speedPerDay: 50, flawless: 100 });
    const d = betPlan({ bet: 2, deadlineOn: addDays(D, 2) }, { hp: 260, max: 260, boss: false }, D, false);
    expect(d).toMatchObject({ label: "Daredevil", days: 3, perDay: 87, worth: 1040, speedPerDay: 100, flawless: 200 });
  });
  it("adds the boss bonus and Hardcore's ×1.25", () => {
    expect(betPlan({ bet: 1.5, deadlineOn: D }, { hp: 310, max: 310, boss: true }, D, true).worth).toBe(Math.round((620 + 500) * 1.5 * 1.25));
  });
  it("a small day is just a walk", () => {
    expect(dayExample(12)).toBe("a 12-min walk");
    expect(dayExample(65)).toBe("a 45-min walk burning 200 cal");
  });
  it("dates read like the cards", () => {
    expect(shortDate("2026-11-20")).toBe("Fri Nov 20");
  });
});

describe("the battle log rows", () => {
  it("shows hits as minus, heals as plus, a block as 0, today as Today", () => {
    expect(lineRow({ day: D, time: "07:00", kind: "hit", amount: 66, text: "Walk hits Fry Hydra for 66." }, D, 0)).toMatchObject({ day: "Today", icon: "hit", value: "−66", tone: "hit" });
    expect(lineRow({ day: addDays(D, -1), time: "", kind: "heal", amount: 35, text: "x" }, D, 1)).toMatchObject({ day: "Mon", icon: "heal", value: "+35" });
    expect(lineRow({ day: D, time: "", kind: "crit", amount: 25, text: "x" }, D, 2)).toMatchObject({ icon: "crit", value: "−25" });
    expect(lineRow({ day: D, time: "", kind: "blocked", amount: 25, text: "x" }, D, 3)).toMatchObject({ icon: "block", value: "0" });
    expect(lineRow({ day: D, time: "", kind: "note", amount: 0, text: "x" }, D, 4)).toMatchObject({ icon: "note", value: "" });
  });
});

describe("the live damage panel (Log activity, game skin)", () => {
  it("says what it hits for and what would finish it — the brief's example", () => {
    const p = attackPanel(hydra(), workout(45, 210));
    expect(p.state).toBe("short");
    expect(p.dmg).toBe(66);
    expect(p.formula).toBe("45 min + 210 cal ÷ 10 = 66 damage");
    expect(p.line).toBe("This hits Fry Hydra for 66 · 26 short. 26 more min or 260 more cal would finish it!");
    expect(savedText("activity", p)).toBe("Logged · Fry Hydra −66");
  });
  it("FINISHING BLOW! once it is enough, with the overkill", () => {
    const p = attackPanel(hydra(), workout(60, 400));
    expect(p.state).toBe("finish");
    expect(p.line).toBe("Fry Hydra goes down. Overkill by 8.");
    expect(savedText("activity", p)).toBe("Logged · Fry Hydra −100 · K.O.!");
  });
  it("an empty workout does nothing yet; a day outside the fight doesn't count", () => {
    expect(attackPanel(hydra(), workout(null, null)).state).toBe("idle");
    const out = attackPanel(hydra(), workout(30, null, { day: addDays(D, -2) }));
    expect(out.state).toBe("outside");
    expect(out.line).toContain("outside Fry Hydra's fight");
  });
  it("uses the engine, so the comeback ×2 shows (the first workout after a day with none)", () => {
    const p = attackPanel(hydra({ activities: [] }), workout(30, null));
    expect(p.dmg).toBe(60);
    expect(p.note).toContain("comeback ×2");
  });
  it("matches the engine when editing an entry (it replaces it, not adds)", () => {
    const p = attackPanel(hydra(), { ...workout(100, null, { time: "07:00" }), id: "big" });
    expect(p.hpBefore).toBe(92);
    expect(p.hpAfter).toBe(150);
  });
});

describe("the live heal panel (Log a splurge, game skin)", () => {
  it("Fry Hydra's Regrow: a Meal heals +35", () => {
    const p = healPanel(hydra(), splurge("meal"));
    expect(p).toMatchObject({ state: "heal", heal: 35, hpBefore: 92, hpAfter: 127 });
    expect(p.line).toBe("Fry Hydra heals +35 (Regrow).");
    expect(savedText("splurge", p)).toBe("Logged · Fry Hydra +35 · +5 points");
  });
  it("a planned treat heals half (rounded up)", () => {
    const p = healPanel(hydra(), splurge("meal", true));
    expect(p.heal).toBe(18);
    expect(p.line).toBe("Fry Hydra heals +18, planned treat, half heal.");
  });
  it("no size yet asks for one; each size's badge shows its heal", () => {
    expect(healPanel(hydra(), splurge(null)).state).toBe("none");
    expect(sizeHeals(hydra(), splurge(null))).toEqual({ snack: "+10 heal", meal: "+35 heal", feast: "+60 heal" });
    expect(sizeHeals(hydra({ activities: [] }), splurge(null)).meal).toBe("full HP");
  });
  it("a Veggie Shield that is up blocks it", () => {
    const p = healPanel(hydra({ shieldFrom: "start" }), splurge("feast"));
    expect(p.state).toBe("blocked");
    expect(p.heal).toBe(0);
  });
  it("at full HP it heals nothing", () => {
    expect(healPanel(hydra({ activities: [] }), splurge("snack")).state).toBe("full");
  });
});

describe("preview stamps", () => {
  it("an entry made now counts after a fight that began partway through today", () => {
    const inp = hydra({ startedAfter: `${D}T15:00:00.000Z` });
    expect(previewStamp(inp, `${D}T14:59:00.000Z`) > inp.startedAfter!).toBe(true);
    expect(previewStamp(inp, `${D}T16:00:00.000Z`)).toBe(`${D}T16:00:00.000Z`);
  });
  it("never stamps before the newest server time in the input (a phone clock behind the server)", () => {
    const inp = hydra({ shieldFrom: { day: D, time: "", at: `${D}T18:00:00.000Z` } });
    expect(previewStamp(inp, `${D}T17:00:00.000Z`) > `${D}T18:00:00.000Z`).toBe(true);
    const later = hydra({ splurges: [{ id: "x", what: "Chips", day: D, time: "", size: "snack", planned: false, createdAt: `${D}T19:00:00.000Z` }] });
    expect(previewStamp(later, `${D}T18:30:00.000Z`) > `${D}T19:00:00.000Z`).toBe(true);
  });
});
