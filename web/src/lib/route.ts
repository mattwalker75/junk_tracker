/**
 * A tiny hash router: #/ (home), #/calendar, #/calendar/2026-09, #/goals, #/settings, #/settings/users…
 * and Craving Crusher's #/game (title), #/game/start, #/game/battle, #/game/choose. The game's other
 * screens (map, world, book, hall, how) come in the next update: until then they show a short note.
 * The phone's back button works.
 */
import { useEffect, useState } from "react";

export type GameScreen = "title" | "start" | "battle" | "choose" | "soon";
export type Route = { page: "home" } | { page: "calendar"; month: string | null } | { page: "goals" } | { page: "settings"; section: string | null }
  | { page: "game"; screen: GameScreen; soon?: string };

/** the game screens built so far; the rest of #/game/… shows "coming in the next update" */
const GAME_SCREENS: Record<string, GameScreen> = { "": "title", start: "start", battle: "battle", choose: "choose" };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "calendar") return { page: "calendar", month: /^\d{4}-\d{2}$/.test(parts[1] || "") ? parts[1] : null };
  if (parts[0] === "goals") return { page: "goals" };
  if (parts[0] === "settings") return { page: "settings", section: parts[1] || null };
  if (parts[0] === "game") {
    const screen = GAME_SCREENS[parts[1] ?? ""];
    return screen ? { page: "game", screen } : { page: "game", screen: "soon", soon: parts[1] };
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
