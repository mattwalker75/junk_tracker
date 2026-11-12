/**
 * Which screen: create the first person, sign in, or the app (home, calendar, goals, settings, and
 * Craving Crusher's game pages) with its sheets. On game pages the log sheets wear the game skin.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Activity, Day, Splurge } from "../../shared/types";
import { ActivitySheet } from "./components/ActivitySheet";
import { AuthScreen } from "./components/AuthScreen";
import { CalendarPage } from "./components/CalendarPage";
import { DaySheet } from "./components/DaySheet";
import { GoalsPage } from "./components/GoalsPage";
import { Home } from "./components/Home";
import { LogSheet } from "./components/LogSheet";
import { SwitchedStrip } from "./components/SwitchedStrip";
import { WeighSheet } from "./components/WeighSheet";
import { GamePage } from "./game/GamePage";
import { SettingsPage } from "./settings/SettingsPage";
import { ActionsContext, type Actions } from "./lib/actions";
import { api } from "./lib/api";
import { useRoute } from "./lib/route";
import { applyTheme, onSystemThemeChange, rememberTheme } from "./lib/theme";

export function App() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const look = useQuery({ queryKey: ["appearance"], queryFn: api.appearance });
  const route = useRoute();

  // the theme follows the saved setting (and the system, when that is the choice)
  useEffect(() => {
    if (!look.data) return;
    const apply = () => applyTheme(look.data.theme, look.data.customThemes);
    apply(); rememberTheme(look.data.theme, look.data.customThemes);
    return onSystemThemeChange(apply);
  }, [look.data]);

  // any 401 (signed out elsewhere, password changed) brings the sign-in screen back
  useEffect(() => {
    const on = () => void qc.invalidateQueries({ queryKey: ["me"] });
    window.addEventListener("jt:signed-out", on);
    return () => window.removeEventListener("jt:signed-out", on);
  }, [qc]);

  const [logOpen, setLogOpen] = useState<{ day?: Day; edit?: Splurge } | null>(null);
  const [activityOpen, setActivityOpen] = useState<{ day?: Day; edit?: Activity } | null>(null);
  const [dayOpen, setDayOpen] = useState<Day | null>(null);
  const [weighOpen, setWeighOpen] = useState<Day | null | undefined>(undefined);
  const actions = useMemo<Actions>(() => ({
    log: (opts) => setLogOpen(opts ?? {}),
    activity: (opts) => setActivityOpen(opts ?? {}),
    day: (d) => setDayOpen(d),
    weigh: (d) => setWeighOpen(d ?? null),
  }), []);
  const closeLog = useCallback((o: boolean) => { if (!o) setLogOpen(null); }, []);
  const closeActivity = useCallback((o: boolean) => { if (!o) setActivityOpen(null); }, []);

  if (me.isPending) return <div className="min-h-dvh" />;
  if (me.isError) return <div className="grid min-h-dvh place-items-center p-6 text-center text-mute">{me.error.message}</div>;
  const st = me.data;
  if (st.status !== "ok") return <AuthScreen mode={st.status} />;

  // the person whose log is on screen: changing it starts every screen afresh
  const owner = st.acting?.id ?? st.me.id;
  const skin = route.page === "game" ? "game" : "tracker";
  return (
    <ActionsContext.Provider value={actions}>
      <div key={owner} className="mx-auto min-h-dvh w-full max-w-xl">
        {st.acting ? <SwitchedStrip acting={st.acting.name} me={st.me.name} /> : null}
        {route.page === "home" ? <Home who={st.acting?.name ?? st.me.name} loginEnabled={st.loginEnabled} /> : null}
        {route.page === "calendar" ? <CalendarPage month={route.month} /> : null}
        {route.page === "goals" ? <GoalsPage /> : null}
        {route.page === "settings" ? <SettingsPage section={route.section} state={st} /> : null}
        {route.page === "game" ? <GamePage screen={route.screen} world={route.world} who={st.acting?.name ?? st.me.name} person={owner} loginEnabled={st.loginEnabled} /> : null}
        <LogSheet open={!!logOpen} onOpenChange={closeLog} day={logOpen?.day} edit={logOpen?.edit} skin={skin} />
        <ActivitySheet open={!!activityOpen} onOpenChange={closeActivity} day={activityOpen?.day} edit={activityOpen?.edit} skin={skin} />
        <DaySheet day={dayOpen} onClose={() => setDayOpen(null)} />
        <WeighSheet open={weighOpen !== undefined} day={weighOpen ?? undefined} onOpenChange={(o) => { if (!o) setWeighOpen(undefined); }} />
      </div>
    </ActionsContext.Provider>
  );
}
