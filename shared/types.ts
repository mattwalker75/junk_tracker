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
  createdAt: string;
  updatedAt: string;
}
export type SplurgeInput = Pick<Splurge, "what" | "size" | "where" | "calories" | "day" | "time" | "notes">;

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
}
export const DEFAULT_USER_SETTINGS: UserSettings = { units: "lb", trendDays: 14, weekStart: 0, examples: { snack: "", meal: "", feast: "" } };

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
  settings: UserSettings;
  /** the goal now (the top of the list), for the note on Home */
  goal: Goal | null;
  /** splurges from the goal's day 1 to today (or to its last day, when its time is up) */
  goalSplurges: number;
  /** how many open goals there are, for the menu */
  goals: number;
}

export interface CustomTheme { id: string; name: string; dark: boolean; tokens: Record<string, string> }
