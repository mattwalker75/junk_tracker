/** Which screen: create the first person, sign in, or the app (home, calendar, settings) with its sheets. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Day, Splurge } from "../../shared/types";
import { AuthScreen } from "./components/AuthScreen";
import { CalendarPage } from "./components/CalendarPage";
import { DaySheet } from "./components/DaySheet";
import { Home } from "./components/Home";
import { LogSheet } from "./components/LogSheet";
import { SwitchedStrip } from "./components/SwitchedStrip";
import { WeighSheet } from "./components/WeighSheet";
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
  const [dayOpen, setDayOpen] = useState<Day | null>(null);
  const [weighOpen, setWeighOpen] = useState<Day | null | undefined>(undefined);
  const actions = useMemo<Actions>(() => ({
    log: (opts) => setLogOpen(opts ?? {}),
    day: (d) => setDayOpen(d),
    weigh: (d) => setWeighOpen(d ?? null),
  }), []);
  const closeLog = useCallback((o: boolean) => { if (!o) setLogOpen(null); }, []);

  if (me.isPending) return <div className="min-h-dvh" />;
  if (me.isError) return <div className="grid min-h-dvh place-items-center p-6 text-center text-mute">{me.error.message}</div>;
  const st = me.data;
  if (st.status !== "ok") return <AuthScreen mode={st.status} />;

  // the person whose log is on screen: changing it starts every screen afresh
  const owner = st.acting?.id ?? st.me.id;
  return (
    <ActionsContext.Provider value={actions}>
      <div key={owner} className="mx-auto min-h-dvh w-full max-w-xl">
        {st.acting ? <SwitchedStrip acting={st.acting.name} me={st.me.name} /> : null}
        {route.page === "home" ? <Home who={st.acting?.name ?? st.me.name} loginEnabled={st.loginEnabled} /> : null}
        {route.page === "calendar" ? <CalendarPage month={route.month} /> : null}
        {route.page === "settings" ? <SettingsPage section={route.section} state={st} /> : null}
        <LogSheet open={!!logOpen} onOpenChange={closeLog} day={logOpen?.day} edit={logOpen?.edit} />
        <DaySheet day={dayOpen} onClose={() => setDayOpen(null)} />
        <WeighSheet open={weighOpen !== undefined} day={weighOpen ?? undefined} onOpenChange={(o) => { if (!o) setWeighOpen(undefined); }} />
      </div>
    </ActionsContext.Provider>
  );
}
