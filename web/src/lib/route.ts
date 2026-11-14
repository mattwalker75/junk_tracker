/**
 * A tiny hash router: #/ (home), #/calendar, #/calendar/2026-09, #/goals, #/settings, #/settings/users…
 * and Calorie Crusher's #/game (title), #/game/start, #/game/battle, #/game/choose, #/game/map,
 * #/game/world/2, #/game/book, #/game/hall, #/game/how. The phone's back button works.
 */
import { useEffect, useState } from "react";

export type GameScreen = "title" | "start" | "battle" | "choose" | "map" | "world" | "book" | "hall" | "how";
export type Route = { page: "home" } | { page: "calendar"; month: string | null } | { page: "goals" } | { page: "settings"; section: string | null }
  | { page: "game"; screen: GameScreen; world?: number };

/** the game's screens; anything else under #/game/ is the title screen */
const GAME_SCREENS: Record<string, GameScreen> = { "": "title", start: "start", battle: "battle", choose: "choose", map: "map", world: "world", book: "book", hall: "hall", how: "how" };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "calendar") return { page: "calendar", month: /^\d{4}-\d{2}$/.test(parts[1] || "") ? parts[1] : null };
  if (parts[0] === "goals") return { page: "goals" };
  if (parts[0] === "settings") return { page: "settings", section: parts[1] || null };
  if (parts[0] === "game") {
    // own keys only: "#/game/toString" or "#/game/constructor" is not a screen
    const name = parts[1] ?? "";
    const screen = Object.hasOwn(GAME_SCREENS, name) ? GAME_SCREENS[name] : "title";
    if (screen === "world") {
      const n = Number(parts[2]);
      return { page: "game", screen, world: Number.isInteger(n) && n >= 1 && n <= 6 ? n : undefined };
    }
    return { page: "game", screen };
  }
  return { page: "home" };
}

export function useRoute(): Route {
  const [r, setR] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => { setR(parse(window.location.hash)); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return r;
}

export function go(path: string): void { window.location.hash = path; }
