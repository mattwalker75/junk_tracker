/** The weigh-in and activity reminders (Matt, Nov 21 2026): the rule, the settings, the route. */
import { afterEach, describe, expect, it } from "vitest";
import { reminderDays, remindersDue } from "../shared/reminders.js";
import { DEFAULT_USER_SETTINGS } from "../shared/types.js";
import { scratch, type Scratch } from "./helpers.js";

const on = { weighReminder: true, weighReminderDays: 7, activityReminder: true, activityReminderDays: 3 };

describe("which reminders are due", () => {
  it("defaults: on, weigh in after 7 days, activity after 3", () => {
    expect(DEFAULT_USER_SETTINGS).toMatchObject(on);
  });

  it("'not in the last N days' = nothing today or the N − 1 days before", () => {
    // activity on Monday Nov 16: still fine on Wednesday, due on Thursday (3 days)
    expect(remindersDue(on, "2026-11-18", { weighIn: "2026-11-18", activity: "2026-11-16" }, "2026-01-01")).toEqual([]);
    expect(remindersDue(on, "2026-11-19", { weighIn: "2026-11-18", activity: "2026-11-16", activityWhat: "Walk" }, "2026-01-01"))
      .toEqual([{ kind: "activity", days: 3, last: "2026-11-16", since: 3, what: "Walk" }]);
    // weigh-in a week ago: due; six days ago: not yet
    expect(remindersDue(on, "2026-11-21", { weighIn: "2026-11-14", activity: "2026-11-21" }, "2026-01-01").map((r) => r.kind)).toEqual(["weighIn"]);
    expect(remindersDue(on, "2026-11-21", { weighIn: "2026-11-15", activity: "2026-11-21" }, "2026-01-01")).toEqual([]);
    // both at once, weigh-in first
    expect(remindersDue(on, "2026-12-01", { weighIn: "2026-11-01", activity: "2026-11-01" }, "2026-01-01").map((r) => r.kind)).toEqual(["weighIn", "activity"]);
    // one day = something today, every day
    expect(remindersDue({ ...on, activityReminderDays: 1 }, "2026-11-21", { weighIn: "2026-11-21", activity: "2026-11-20" }, "2026-01-01").map((r) => r.kind)).toEqual(["activity"]);
  });

  it("each one can be turned off on its own", () => {
    const last = { weighIn: "2026-01-01", activity: "2026-01-01" };
    expect(remindersDue({ ...on, weighReminder: false }, "2026-11-21", last, "2026-01-01").map((r) => r.kind)).toEqual(["activity"]);
    expect(remindersDue({ ...on, activityReminder: false }, "2026-11-21", last, "2026-01-01").map((r) => r.kind)).toEqual(["weighIn"]);
    expect(remindersDue({ ...on, weighReminder: false, activityReminder: false }, "2026-11-21", last, "2026-01-01")).toEqual([]);
  });

  it("never logged: counted from the day the person was added, so a new person isn't nagged at once", () => {
    const none = { weighIn: null, activity: null };
    expect(remindersDue(on, "2026-11-21", none, "2026-11-21")).toEqual([]);
    expect(remindersDue(on, "2026-11-24", none, "2026-11-21")).toEqual([{ kind: "activity", days: 3, last: null, since: null }]);
    expect(remindersDue(on, "2026-11-28", none, "2026-11-21").map((r) => r.kind)).toEqual(["weighIn", "activity"]);
  });

  it("days outside 1–60 (a hand-edited file) fall back to the default", () => {
    expect(reminderDays(5, 7)).toBe(5);
    expect(reminderDays(0, 7)).toBe(7);
    expect(reminderDays(61, 3)).toBe(3);
    expect(reminderDays(2.5, 3)).toBe(3);
    expect(reminderDays("4", 3)).toBe(3);
  });
});

let s: Scratch;
afterEach(async () => { await s?.close(); });

describe("reminders through the app", () => {
  it("settings save and check; the route reads the person's own log", async () => {
    s = await scratch();
    const b = s.browser();
    const got = (await b.call("GET", "/api/me/settings")).body;
    expect(got).toMatchObject(on);
    expect((await b.call("PUT", "/api/me/settings", { activityReminderDays: 5 })).body).toMatchObject({ activityReminderDays: 5, weighReminderDays: 7 });
    expect((await b.call("PUT", "/api/me/settings", { weighReminder: false })).body).toMatchObject({ weighReminder: false, activityReminder: true });
    for (const bad of [0, 61, 2.5, "7"]) {
      expect((await b.call("PUT", "/api/me/settings", { weighReminderDays: bad })).body.error).toBe("A reminder waits 1 to 60 days (a whole number).");
    }
    expect((await b.call("PUT", "/api/me/settings", { weighReminder: "yes" })).body.error).toBe("The weigh-in reminder is on or off.");
    await b.call("PUT", "/api/me/settings", { weighReminder: true });

    // far ahead of the day the person was added, so "never logged" counts as long ago
    expect((await b.call("GET", "/api/reminders?today=2030-01-20")).body.due.map((r: { kind: string }) => r.kind)).toEqual(["weighIn", "activity"]);
    await b.call("PUT", "/api/weigh-ins/2030-01-18", { weight: 180, unit: "lb" });
    await b.call("POST", "/api/activities", { what: "Swim", day: "2030-01-14" });
    // a weigh-in in the future doesn't count today
    await b.call("PUT", "/api/weigh-ins/2030-02-01", { weight: 181, unit: "lb" });
    expect((await b.call("GET", "/api/reminders?today=2030-01-20")).body.due).toEqual([{ kind: "activity", days: 5, last: "2030-01-14", since: 6, what: "Swim" }]);
    await b.call("POST", "/api/activities", { what: "Run", day: "2030-01-20" });
    expect((await b.call("GET", "/api/reminders?today=2030-01-20")).body.due).toEqual([]);
    expect((await b.call("GET", "/api/reminders?today=2030-13-01")).status).toBe(400);
  });
});
