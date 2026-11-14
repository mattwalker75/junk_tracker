/** Every call to the server. Errors come back as plain sentences (the server writes them). */
import type { AutoResult, Bet, GameView, HallView, Mode, PowerUp, SyncResult } from "../../../shared/game/types";
import type { Activity, ActivityInput, AuthState, CustomTheme, Day, Goal, GoalInput, GoalList, Id, Overview, Splurge, SplurgeInput, UserInfo, UserSettings, WeighIn } from "../../../shared/types";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method, headers: body !== undefined ? { "content-type": "application/json" } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined, cache: "no-store" });
  } catch {
    throw new ApiError("Calorie Crusher is not answering. Is it running, and is this device on the same network?", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event("jt:signed-out"));
    throw new ApiError((data as { error?: string }).error || `The server answered ${res.status}.`, res.status);
  }
  return data as T;
}

export interface AppSettings {
  version: string;
  config: {
    server: { port: number; allowNetwork: boolean; extraHosts: string[] };
    security: { loginEnabled: boolean; sessionDays: number };
    database: { path: string };
    appearance: { theme: string; customThemes: CustomTheme[] };
  };
  restartRequired: string[];
  configFile?: string;
  databaseFile?: string;
  networkUrls: string[];
}

export const api = {
  me: () => call<AuthState>("GET", "/api/auth/me"),
  appearance: () => call<{ theme: string; customThemes: CustomTheme[] }>("GET", "/api/appearance"),
  setup: (name: string, password: string) => call<AuthState>("POST", "/api/auth/setup", { name, password }),
  login: (name: string, password: string) => call<AuthState>("POST", "/api/auth/login", { name, password }),
  logout: () => call<{ ok: true }>("POST", "/api/auth/logout"),
  enableUsers: (name: string, password: string) => call<AuthState>("POST", "/api/auth/enable", { name, password }),
  disableUsers: () => call<AuthState>("POST", "/api/auth/disable", { confirm: "TURN OFF" }),

  overview: (today: Day) => call<Overview>("GET", `/api/overview?today=${today}`),
  splurges: (from: Day, to: Day) => call<Splurge[]>("GET", `/api/splurges?from=${from}&to=${to}`),
  addSplurge: (s: SplurgeInput) => call<Splurge>("POST", "/api/splurges", s),
  saveSplurge: (id: Id, s: SplurgeInput) => call<Splurge>("PUT", `/api/splurges/${id}`, s),
  deleteSplurge: (id: Id) => call<{ ok: true }>("DELETE", `/api/splurges/${id}`),
  activities: (from: Day, to: Day) => call<Activity[]>("GET", `/api/activities?from=${from}&to=${to}`),
  addActivity: (a: ActivityInput) => call<Activity>("POST", "/api/activities", a),
  saveActivity: (id: Id, a: ActivityInput) => call<Activity>("PUT", `/api/activities/${id}`, a),
  deleteActivity: (id: Id) => call<{ ok: true }>("DELETE", `/api/activities/${id}`),
  weighIns: (from: Day, to: Day) => call<WeighIn[]>("GET", `/api/weigh-ins?from=${from}&to=${to}`),
  weighIn: (day: Day, weight: number, unit: "lb" | "kg") => call<WeighIn>("PUT", `/api/weigh-ins/${day}`, { weight, unit }),
  deleteWeighIn: (day: Day) => call<{ ok: true }>("DELETE", `/api/weigh-ins/${day}`),
  goals: (today: Day) => call<GoalList>("GET", `/api/goals?today=${today}`),
  // every change to the list sends the phone's day: the goal that ends up on top starts its days then
  addGoal: (g: GoalInput & { place: "now" | "later" }, today: Day) => call<Goal>("POST", "/api/goals", { ...g, today }),
  saveGoal: (id: Id, g: GoalInput) => call<Goal>("PUT", `/api/goals/${id}`, g),
  moveGoal: (id: Id, dir: "up" | "down", today: Day) => call<{ ok: true }>("POST", `/api/goals/${id}/move`, { dir, today }),
  goalDone: (id: Id, today: Day) => call<Goal>("POST", `/api/goals/${id}/done`, { today }),
  reopenGoal: (id: Id, today: Day) => call<Goal>("POST", `/api/goals/${id}/reopen`, { today }),
  deleteGoal: (id: Id, today: Day) => call<{ ok: true }>("DELETE", `/api/goals/${id}`, { today }),
  // Calorie Crusher (game mode). Reads never settle; the page calls gameSync when the view says needsSync, and after every log change
  game: (today: Day, now: string) => call<GameView>("GET", `/api/game?today=${today}&now=${encodeURIComponent(now)}`),
  gameSync: (today: Day, now: string) => call<SyncResult>("POST", "/api/game/sync", { today, now }),
  gameStart: (mode: Mode, today: Day, now: string) => call<SyncResult>("POST", "/api/game/run", { mode, today, now }),
  gameAuto: (today: Day, now: string) => call<AutoResult>("POST", "/api/game/auto", { today, now }),
  gameNext: (bet: Bet, today: Day, now: string) => call<SyncResult>("POST", "/api/game/next", { bet, today, now }),
  gameBet: (bet: Bet, today: Day, now: string) => call<SyncResult>("POST", "/api/game/bet", { bet, today, now }),
  gamePowerUp: (kind: PowerUp, today: Day, now: string) => call<SyncResult>("POST", "/api/game/powerup", { kind, today, now }),
  gameToNormal: (today: Day, now: string) => call<SyncResult>("POST", "/api/game/mode", { to: "normal", today, now }),
  gameHall: (today: Day) => call<HallView>("GET", `/api/game/hall?today=${today}`),
  mySettings: () => call<UserSettings>("GET", "/api/me/settings"),
  saveMySettings: (patch: Partial<Omit<UserSettings, "examples">> & { examples?: Partial<UserSettings["examples"]> }) => call<UserSettings>("PUT", "/api/me/settings", patch),

  users: () => call<UserInfo[]>("GET", "/api/users"),
  addUser: (name: string, password: string) => call<UserInfo>("POST", "/api/users", { name, password }),
  rename: (id: Id, name: string) => call<UserInfo>("PUT", `/api/users/${id}/name`, { name }),
  setPassword: (id: Id, password: string) => call<{ ok: true }>("PUT", `/api/users/${id}/password`, { password }),
  switchTo: (id: Id) => call<AuthState>("POST", `/api/users/${id}/switch`),
  switchBack: () => call<AuthState>("POST", "/api/users/switch-back"),
  removeUser: (id: Id) => call<{ ok: true }>("DELETE", `/api/users/${id}`, { confirm: "DELETE" }),

  settings: () => call<AppSettings>("GET", "/api/settings"),
  saveSettings: (patch: unknown) => call<Omit<AppSettings, "version">>("PUT", "/api/settings", patch),
};
