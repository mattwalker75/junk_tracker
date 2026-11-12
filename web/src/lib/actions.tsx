/** The sheets any screen can open: log or edit a splurge or an activity, open a day, weigh in. */
import type { QueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import type { Activity, Day, Splurge } from "../../../shared/types";

export interface Actions {
  /** log a new splurge (optionally on a given day), or edit one */
  log: (opts?: { day?: Day; edit?: Splurge }) => void;
  /** log a new activity (optionally on a given day), or edit one */
  activity: (opts?: { day?: Day; edit?: Activity }) => void;
  /** open a day: its splurges, activities and weigh-in */
  day: (day: Day) => void;
  /** weigh in (today, or a given day) */
  weigh: (day?: Day) => void;
}
export const ActionsContext = createContext<Actions>({ log: () => {}, activity: () => {}, day: () => {}, weigh: () => {} });
export const useActions = () => useContext(ActionsContext);

/**
 * Everything that reads the log, so one change refreshes every screen — Craving Crusher's view and
 * the Hall of Heroes too: a workout logged on the tracker can KO the monster, and the game screens
 * read again (and sync) the next time they show.
 */
export const LOG_KEYS = [["overview"], ["month"], ["day"], ["game"], ["game-hall"]] as const;
/** Everything that shows goals: the list, and the note and menu on Home. */
export const GOAL_KEYS = [["goals"], ["overview"]] as const;
/** Refetch everything under these keys, all at once. */
export const refresh = (qc: QueryClient, keys: readonly (readonly string[])[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [...k] })));
