/** The sheets any screen can open: log or edit a splurge, open a day, weigh in. */
import { createContext, useContext } from "react";
import type { Day, Splurge } from "../../../shared/types";

export interface Actions {
  /** log a new splurge (optionally on a given day), or edit one */
  log: (opts?: { day?: Day; edit?: Splurge }) => void;
  /** open a day: its splurges and weigh-in */
  day: (day: Day) => void;
  /** weigh in (today, or a given day) */
  weigh: (day?: Day) => void;
}
export const ActionsContext = createContext<Actions>({ log: () => {}, day: () => {}, weigh: () => {} });
export const useActions = () => useContext(ActionsContext);

/** Everything that reads the log, so one change refreshes every screen. */
export const LOG_KEYS = [["overview"], ["month"], ["day"]] as const;
/** Everything that shows goals: the list, and the note and menu on Home. */
export const GOAL_KEYS = [["goals"], ["overview"]] as const;
