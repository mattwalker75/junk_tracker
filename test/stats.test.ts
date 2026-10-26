import { describe, expect, it } from "vitest";
import type { Splurge } from "../shared/types";
import { addDays, daysBetween } from "../web/src/lib/dates";
import { countBetween, daysClean, goalLine, goalProgress, inUnit, startOfWeek, trend, worstSize } from "../web/src/lib/stats";

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
