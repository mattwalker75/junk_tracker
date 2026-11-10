import { describe, expect, it } from "vitest";
import type { Activity, Splurge } from "../shared/types";
import { goalFontPx } from "../shared/types";
import { addDays, daysBetween } from "../web/src/lib/dates";
import { activeWeek, activityLabel, caloriesTotal, countBetween, daysClean, durationInput, minutesLabel, parseDuration, goalLine, goalProgress, inUnit, startOfWeek, trend, worstSize } from "../web/src/lib/stats";

const s = (day: string, size: Splurge["size"]): Splurge =>
  ({ id: day + size, what: "x", size, where: null, calories: null, day, time: null, notes: null, createdAt: "", updatedAt: "" });

describe("dates", () => {
  it("crosses months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(daysBetween("2026-02-27", "2026-03-01")).toBe(2);
  });
  it("is not thrown off by daylight saving", () => {
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
  });
});

describe("stats", () => {
  it("colours a day by its biggest splurge", () => {
    expect(worstSize([])).toBeNull();
    expect(worstSize([s("d", "snack"), s("d", "feast"), s("d", "meal")])).toBe("feast");
  });
  it("counts clean days", () => {
    expect(daysClean(null, "2026-10-16")).toBeNull();
    expect(daysClean(s("2026-10-16", "snack"), "2026-10-16")).toBe(0);
    expect(daysClean(s("2026-10-11", "meal"), "2026-10-16")).toBe(5);
  });
  it("starts the week on Sunday or Monday", () => {
    expect(startOfWeek("2026-10-16", 0)).toBe("2026-10-11"); // Fri → Sun
    expect(startOfWeek("2026-10-16", 1)).toBe("2026-10-12"); // Fri → Mon
    expect(startOfWeek("2026-10-11", 1)).toBe("2026-10-05"); // Sun → the Monday before
  });
  it("counts splurges and feasts in a range, both ends included", () => {
    const list = [s("2026-10-01", "feast"), s("2026-10-03", "snack"), s("2026-10-05", "feast"), s("2026-10-06", "meal")];
    expect(countBetween(list, "2026-10-01", "2026-10-05")).toEqual({ all: 3, feasts: 2 });
  });
  it("works out the weight trend against the start of the period", () => {
    const w = [{ day: "2026-09-30", pounds: 190 }, { day: "2026-10-02", pounds: 189 }, { day: "2026-10-10", pounds: 188.4 }, { day: "2026-10-16", pounds: 187.5 }];
    const t = trend(w, "2026-10-16", 14); // start = Oct 2
    expect(t.latest?.pounds).toBe(187.5);
    expect(t.change).toBe(-1.5);
    expect(t.avg7).toBe(188); // Oct 10 and Oct 16
    expect(t.points.map((p) => p.day)).toEqual(["2026-10-02", "2026-10-10", "2026-10-16"]);
  });
  it("has no trend with one weigh-in, and ignores future days", () => {
    expect(trend([{ day: "2026-10-16", pounds: 180 }], "2026-10-16", 7).change).toBeNull();
    expect(trend([{ day: "2026-10-20", pounds: 180 }], "2026-10-16", 7).latest).toBeNull();
  });
  it("shows kilograms to one decimal", () => {
    expect(inUnit(187.5, "kg")).toBe(85);
    expect(inUnit(187.46, "lb")).toBe(187.5);
  });
});

describe("goals", () => {
  it("counts a goal's days from the day it reached the top, and knows when its time is up", () => {
    expect(goalProgress({ days: 14, startedOn: null }, "2026-10-26")).toBeNull();
    expect(goalProgress({ days: 14, startedOn: "2026-10-21" }, "2026-10-21")).toEqual({ day: 1, of: 14, over: false });
    expect(goalProgress({ days: 14, startedOn: "2026-10-21" }, "2026-10-26")).toEqual({ day: 6, of: 14, over: false });
    expect(goalProgress({ days: 14, startedOn: "2026-10-21" }, "2026-11-03")).toEqual({ day: 14, of: 14, over: false });
    expect(goalProgress({ days: 14, startedOn: "2026-10-21" }, "2026-11-04")).toEqual({ day: 15, of: 14, over: true });
    expect(goalProgress({ days: null, startedOn: "2026-10-21" }, "2027-01-01").over).toBe(false);
  });
});

describe("the goal line", () => {
  it("says the day, and how it is going", () => {
    expect(goalLine({ days: 14, startedOn: "2026-10-21" }, "2026-10-26", 0)).toBe("Day 6 of 14 · clean so far");
    expect(goalLine({ days: null, startedOn: "2026-10-21" }, "2026-10-23", 1)).toBe("Day 3 · 1 splurge since you started");
    expect(goalLine({ days: 14, startedOn: "2026-10-01" }, "2026-10-26", 2)).toBe("Your 2 weeks are up · 2 splurges since you started");
    expect(goalLine({ days: 7, startedOn: "2026-10-01" }, "2026-10-26", 0)).toBe("Your week is up · clean all the way");
  });
});

describe("the sticky note's writing size (Nov 9 2026)", () => {
  it("is big while the goal is short and steps down as it grows, never below 19px", () => {
    expect(goalFontPx("Eat extra clean for the next 2 weeks")).toBe(36);
    expect(goalFontPx("x".repeat(40))).toBe(36);
    expect(goalFontPx("x".repeat(41))).toBe(31);
    expect(goalFontPx("x".repeat(80))).toBe(31);
    expect(goalFontPx("x".repeat(140))).toBe(26);
    expect(goalFontPx("x".repeat(220))).toBe(22);
    expect(goalFontPx("x".repeat(300))).toBe(19);
    expect(goalFontPx("   short   ")).toBe(36); // spaces at the ends don't count
  });
});

const act = (day: string, minutes: number | null, calories: number | null = null): Activity =>
  ({ id: day + minutes, what: "Walk", minutes, calories, day, time: "", notes: "", createdAt: "", updatedAt: "" });

describe("activity", () => {
  it("writes minutes the way people say them", () => {
    expect(minutesLabel(45)).toBe("45 min");
    expect(minutesLabel(60)).toBe("1 h");
    expect(minutesLabel(140)).toBe("2 h 20 min");
    expect(activityLabel({ what: "Walk", minutes: 45 })).toBe("Walk, 45 min");
    expect(activityLabel({ what: "Yoga", minutes: null })).toBe("Yoga");
  });

  it("How long takes minutes or hours:minutes (Nov 9 2026)", () => {
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration(" 45 ")).toBe(45);
    expect(parseDuration("1:30")).toBe(90);
    expect(parseDuration("0:45")).toBe(45);
    expect(parseDuration(":45")).toBe(45);
    expect(parseDuration("2:05")).toBe(125);
    expect(parseDuration("1:5")).toBe(65);
    expect(parseDuration("")).toBeNull();
    for (const bad of ["1:60", "1:", "1.5", "-3", "1:30:00", "abc", "1h"]) expect(parseDuration(bad)).toBeNaN();
    expect(durationInput(null)).toBe("");
    expect(durationInput(45)).toBe("45");
    expect(durationInput(90)).toBe("1:30");
    expect(durationInput(125)).toBe("2:05");
    for (const n of [1, 59, 60, 61, 1440]) expect(parseDuration(durationInput(n))).toBe(n);
  });

  it("Active this week: days active of 7, minutes, calories only from the ones that say", () => {
    // Monday Nov 9 2026; a week from Sunday is Nov 8 – 14
    const list = [act("2026-11-09", 45, 210), act("2026-11-09", 30), act("2026-11-08", 65, 700), act("2026-11-07", 90, 500), act("2026-11-10", 20)];
    const w = activeWeek(list, "2026-11-09", 0);
    expect(w.from).toBe("2026-11-08");
    expect(w.days).toBe(2); // Saturday is last week; Tuesday is after today
    expect(w.count).toBe(3);
    expect(w.minutes).toBe(140);
    expect(w.calories).toBe(910);
    expect(w.week.map((x) => x.active)).toEqual([true, true, false, false, false, false, false]);
    expect(w.week[6].day).toBe("2026-11-14");
  });

  it("follows the person's week start", () => {
    const list = [act("2026-11-08", 30), act("2026-11-09", 30)];
    const w = activeWeek(list, "2026-11-09", 1); // the week from Monday Nov 9
    expect(w.from).toBe("2026-11-09");
    expect(w.days).toBe(1);
    expect(w.week.map((x) => x.active)).toEqual([true, false, false, false, false, false, false]);
  });

  it("an empty week, and one where nothing says its calories", () => {
    expect(activeWeek([], "2026-11-09", 0)).toMatchObject({ days: 0, count: 0, minutes: 0, calories: null });
    expect(activeWeek([act("2026-11-09", null)], "2026-11-09", 0)).toMatchObject({ days: 1, minutes: 0, calories: null });
    expect(activeWeek([act("2026-11-09", null, 0)], "2026-11-09", 0).calories).toBe(0);
  });
});

describe("the day sheet's calorie totals (Matt, Nov 9 2026)", () => {
  const sp = (calories: number | null) => ({ ...s("2026-11-09", "meal"), calories });
  it("none with calories: no total, just the heading", () => {
    expect(caloriesTotal([])).toBeNull();
    expect(caloriesTotal([sp(null), sp(null)])).toBeNull();
    expect(caloriesTotal([act("2026-11-09", 30), act("2026-11-09", 20)])).toBeNull();
  });
  it("some with calories: the total of those", () => {
    expect(caloriesTotal([sp(1320), sp(null), sp(1130)])).toBe(2450);
    expect(caloriesTotal([act("2026-11-09", 45, 210), act("2026-11-09", 30), act("2026-11-09", 50, 210)])).toBe(420);
  });
  it("all with calories, several on the day; 0 is a total too", () => {
    expect(caloriesTotal([sp(400), sp(2050)])).toBe(2450);
    expect(caloriesTotal([act("2026-11-09", 45, 210), act("2026-11-09", 50, 400), act("2026-11-09", 20, 90)])).toBe(700);
    expect(caloriesTotal([sp(0)])).toBe(0);
    expect((2450).toLocaleString("en-US")).toBe("2,450");
  });
});
