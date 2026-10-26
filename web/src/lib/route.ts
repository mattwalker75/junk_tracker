/** A tiny hash router: #/ (home), #/calendar, #/calendar/2026-09, #/goals, #/settings, #/settings/users… The phone's back button works. */
import { useEffect, useState } from "react";

export type Route = { page: "home" } | { page: "calendar"; month: string | null } | { page: "goals" } | { page: "settings"; section: string | null };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "calendar") return { page: "calendar", month: /^\d{4}-\d{2}$/.test(parts[1] || "") ? parts[1] : null };
  if (parts[0] === "goals") return { page: "goals" };
  if (parts[0] === "settings") return { page: "settings", section: parts[1] || null };
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
