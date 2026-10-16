/**
 * Today's date that moves on at midnight. A phone can leave the page open for days: without this,
 * Home would still say "today" about yesterday when it is opened again in the morning.
 */
import { useEffect, useState } from "react";
import type { Day } from "../../../shared/types";
import { today as todayOf } from "./dates";

export function useToday(): Day {
  const [d, setD] = useState(todayOf);
  useEffect(() => {
    const check = () => setD(todayOf());
    // just after the next midnight, and whenever the page comes back into view (timers sleep with the phone)
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5).getTime() - now.getTime();
    const timer = window.setTimeout(check, next);
    const onShow = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", check);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", onShow); window.removeEventListener("focus", check); };
  }, [d]);
  return d;
}
