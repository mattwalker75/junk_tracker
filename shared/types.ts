/** The data model both the server and the page use. */

export type Id = string;
export type Size = "snack" | "meal" | "feast";
export const SIZES: Size[] = ["snack", "meal", "feast"];
export const SIZE_LABEL: Record<Size, string> = { snack: "Snack", meal: "Meal", feast: "Feast" };
/** what each size means when a person has not written their own examples */
export const DEFAULT_EXAMPLES: Record<Size, string> = { snack: "a candy bar", meal: "burger & fries", feast: "a whole pizza" };

/** a day as the person lives it: "2026-10-15" (no time zone — the day on their calendar) */
export type Day = string;

export interface Splurge {
  id: Id;
  what: string;
  size: Size;
  where: string;
  calories: number | null;
  /** the day it was eaten, and the time ("HH:MM") */
  day: Day;
  time: string;
  notes: string;
  /** a treat the person planned, like a birthday dinner (Nov 11 2026): in game mode it heals the monster half */
  planned: boolean;
  createdAt: string;
  updatedAt: string;
}
export type SplurgeInput = Pick<Splurge, "what" | "size" | "where" | "calories" | "day" | "time" | "notes" | "planned">;

/**
 * Something active the person did (Matt, Nov 9 2026: a walk, a run, the gym). Only the name is
 * needed; how long and the calories burned are optional whole numbers.
 */
export interface Activity {
  id: Id;
  what: string;
  /** how long, in minutes */
  minutes: number | null;
  /** calories burned */
  calories: number | null;
  /** the day it was done, and the time ("HH:MM", or "" when not said) */
  day: Day;
  time: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
export type ActivityInput = Pick<Activity, "what" | "minutes" | "calories" | "day" | "time" | "notes">;
/** the six quick-pick buttons on Log activity when a person has not written their own */
export const DEFAULT_QUICK_PICKS = ["Walk", "Run", "Bike", "Gym", "Swim", "Yoga"] as const;
export const QUICK_PICK_MAX = 40;
/** The six names on the quick-pick buttons: the person's own, or the default where a box is empty. */
export function quickPickNames(own: readonly string[] | undefined): string[] {
  return DEFAULT_QUICK_PICKS.map((d, i) => own?.[i]?.trim() || d);
}

/** kilograms in a pound */
export const KG = 0.45359237;

export interface WeighIn {
  day: Day;
  /** always stored in pounds; the page shows the person's unit */
  pounds: number;
}

export interface UserSettings {
  units: "lb" | "kg";
  /** the weight trend is measured over this many days */
  trendDays: 7 | 14 | 30;
  /** 0 = weeks start on Sunday, 1 = Monday */
  weekStart: 0 | 1;
  /** the person's own yardstick for each size; "" = the default example */
  examples: Record<Size, string>;
  /** the six quick picks on Log activity, in order; "" = the default (Walk, Run, Bike, Gym, Swim, Yoga) */
  quickPicks: string[];
  /** where the app opens: the tracker (Home) or Calorie Crusher (Matt, Nov 12 2026) */
  openIn: "tracker" | "game";
  /**
   * Keep the monsters coming (Matt, Nov 14 2026): the first time game mode opens each day, if no run
   * is going, a new one starts by itself (in the last run's mode)
   */
  autoStart: boolean;
}
export const DEFAULT_USER_SETTINGS: UserSettings = { units: "lb", trendDays: 14, weekStart: 0, examples: { snack: "", meal: "", feast: "" }, quickPicks: ["", "", "", "", "", ""], openIn: "tracker", autoStart: false };

export interface UserInfo {
  id: Id;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  isYou: boolean;
}

export type AuthState =
  /** the login is on but nobody has a password yet (config.json edited by hand): the page asks for one */
  | { status: "setup" }
  /** the login is on and this browser is not signed in */
  | { status: "signin" }
  | { status: "ok"; loginEnabled: boolean; /** how many users there are */ users: number; me: { id: Id; name: string }; acting: { id: Id; name: string } | null };

/** How long a goal runs once it is at the top: a week, two weeks, a month — or null, until it is checked off. */
export type GoalDays = 7 | 14 | 30 | null;

/**
 * Something to aim for ("Eat extra clean for the next 2 weeks"). Each person keeps a list; the open
 * goal at the top is the one on Home, and checking it off moves the next one up.
 */
export interface Goal {
  id: Id;
  text: string;
  days: GoalDays;
  /** the day it reached the top of the list — its day 1 — or null while it waits further down */
  startedOn: Day | null;
  /** the day it was checked off, or null while it is open */
  doneOn: Day | null;
  createdAt: string;
}
export interface GoalInput { text: string; days: GoalDays }

/** The most a goal may say (Matt, Nov 9 2026: was 120). */
export const GOAL_MAX = 300;
/**
 * The size the sticky note writes a goal at: big while it is short, smaller as it grows, never below
 * 19px so it still reads at arm's length (Matt picked these steps from the mockups, Nov 9 2026).
 */
export function goalFontPx(text: string): number {
  const n = text.trim().length;
  if (n <= 40) return 36;
  if (n <= 80) return 31;
  if (n <= 140) return 26;
  if (n <= 220) return 22;
  return 19;
}
export interface GoalList {
  /** in order: the first is the goal now */
  open: Goal[];
  /** newest first (the latest 100) */
  done: Goal[];
  /** how many have been checked off in all */
  doneCount: number;
  /** splurges since the goal now's day 1 (as on Home) */
  goalSplurges: number;
}

export interface Overview {
  /** the most recent splurge ever, for "days clean" */
  last: Splurge | null;
  /** splurges from `from` to `today`, newest first */
  splurges: Splurge[];
  /** weigh-ins from `weighFrom` to `today`, oldest first */
  weighIns: WeighIn[];
  /** recent different things, for the "Again?" buttons */
  recent: Pick<Splurge, "what" | "size" | "where" | "calories">[];
  /** activities from `from` to `today`, newest first (this week and the 14-day strip) */
  activities: Activity[];
  /** the most recent activity on or before today, for "Last: Walk, 45 min · today" */
  lastActivity: Activity | null;
  /** recent different activities, for the "Again?" buttons on Log activity */
  recentActivities: Pick<Activity, "what" | "minutes" | "calories">[];
  settings: UserSettings;
  /** the goal now (the top of the list), for the note on Home */
  goal: Goal | null;
  /** splurges from the goal's day 1 to today (or to its last day, when its time is up) */
  goalSplurges: number;
  /** how many open goals there are, for the menu */
  goals: number;
}

export interface CustomTheme { id: string; name: string; dark: boolean; tokens: Record<string, string> }
