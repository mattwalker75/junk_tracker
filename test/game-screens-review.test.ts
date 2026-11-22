/**
 * Game screens (deep review, Nov 22 2026): render the real game screens to HTML (react-dom/server, no browser) from
 * views built by the real engine, and check that what they say matches what the engine will do.
 */
import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { addDays, deadlineFor, buildView, levelInfo, newRun, settle, startNextFight, toEventView, type GameClock, type GameLog, type GameView, type RunState } from "../shared/game/index.js";
import { today as phoneToday } from "../web/src/lib/dates";
import { ResultHost } from "../web/src/game/Results";
import { Book } from "../web/src/game/Book";
import { TitleScreen } from "../web/src/game/TitleScreen";
import { markShown, pushHappened, setGamePerson, clearResults } from "../web/src/game/state";

const T = phoneToday();
let n = 0;
const clock = (today: string, iso = `${today}T12:00:00.000Z`): GameClock => ({ today, nowTime: "12:00", nowIso: iso, newId: () => `id${n++}` });
const log = (o: Partial<GameLog> = {}): GameLog => ({ splurges: [], activities: [], entriesSinceStart: 0, entryDays: [], weekStart: 0, hpMult: 1, ...o });

function render(el: ReturnType<typeof h>, view: GameView | null): string {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  if (view) qc.setQueryData(["game", T], view);
  qc.setQueryData(["game-hall", T], { allTime: [], thisMonth: [], hardcore: [], mine: [], badges: [] });
  return renderToStaticMarkup(h(QueryClientProvider, { client: qc }, el));
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

/** Run N started on `on`, with its first fight moved to `level`. */
function runAt(level: number, on: string, hpMult = 1): RunState {
  const st = newRun(1, "normal", clock(on, `${on}T08:00:00.000Z`), false, hpMult).state;
  const f = st.fights[0];
  f.level = level;
  f.deadlineOn = deadlineFor(level, on, false);
  return st;
}
const act = (id: string, day: string, minutes: number) => ({ id, what: "Run", day, time: "18:00", minutes, calories: null, createdAt: `${day}T18:00:00.000Z` });
function showOnly(person: string, events: ReturnType<typeof toEventView>[]) {
  setGamePerson(person);
  clearResults();
  pushHappened(events);
}

describe("smoke", () => {
  it("renders the title with no run", () => {
    setGamePerson("p0");
    const html = render(h(TitleScreen), buildView(null, null, T, false));
    expect(text(html)).toContain("Start a run");
  });
});

describe("Victory's NEXT card", () => {
  it("names the next fight's HP and deadline as the engine will start it (Tough toughness, Long Frank's Long Haul)", () => {
    // level 17 (Tot Rock) on Tough goes down; level 18 is Long Frank: 360 HP x 1.5 = 540, deadline 4 + 1 (Long Haul) = 5 days
    const st = runAt(17, T, 1.5);
    const lg = log({ activities: [act("a1", T, 1400)], hpMult: 1.5 });
    const out = settle(st, lg, clock(T));
    const view = buildView(out.state, lg, T, false, false, 1.5);
    expect(view.next).toMatchObject({ level: 18, name: "Long Frank", hp: 540, days: 5 });
    showOnly("pA", out.added.map(toEventView));
    markShown(out.added.find((e) => e.kind === "ko")!.id);
    const t = text(render(h(ResultHost, { screen: "title" }), view));
    expect(t).toContain("Long Frank");
    // what the screen says about the fight that is up next
    const said = /Long Frank (\S+) HP · (\d+)-day deadline/.exec(t);
    expect(said?.slice(1)).toEqual(["540", "5"]);
  });
});

describe("the Strike screen with an extra life held", () => {
  it("says what missing the extra day really does (Normal, 1 heart left, 1 extra life)", () => {
    const start = addDays(T, -3); // Crumbs, 3 days: due T-1, missed by T
    const st = newRun(1, "normal", clock(start, `${start}T08:00:00.000Z`)).state;
    st.run.hearts = 2; st.run.lives = 1;
    // a snack every day, so no clean-day crit knocks Crumbs out
    const snacks = [-3, -2, -1, 0, 1].map((k, i) => ({ id: `s${i}`, what: "Chips", day: addDays(T, k), time: "", size: "snack" as const, planned: false, createdAt: `${addDays(T, k)}T20:00:00.000Z` }));
    const lg = log({ splurges: snacks });
    const out = settle(st, lg, clock(T));
    const strike = out.added.find((e) => e.kind === "strike")!;
    expect(strike.data).toMatchObject({ hearts: 1, extended: true });
    // what the engine does if the extra day is missed too: the life is spent, no knock-back
    const later = settle(out.state, lg, clock(addDays(T, 1)));
    expect(later.added.map((e) => e.kind)).toContain("life_used");
    expect(later.added.map((e) => e.kind)).not.toContain("knockback");
    const view = buildView(out.state, lg, T, false);
    showOnly("pB", out.added.map(toEventView));
    markShown(strike.id);
    const t = text(render(h(ResultHost, { screen: "battle" }), view));
    expect(t).toContain("Crumbs strikes!");
    expect(t).not.toContain("you are knocked back to the start of Snack Swamp");
  });
});

describe("Monster Book and map for the fight up next", () => {
  it("the Book card for Long Frank says the deadline the fight will really have", () => {
    const st = runAt(18, T);
    const view = buildView(st, log(), T, false);
    expect(view.fight).toMatchObject({ level: 18, daysLeft: 5 });
    setGamePerson("pC");
    const t = text(render(h(Book), view));
    const card = /Lv 18 Long Frank .*?Deadline (\d+) days/.exec(t);
    expect(card?.[1]).toBe("5");
  });
  it("the title screen names Crumbs' HP as Start a run will start it (Brutal)", () => {
    setGamePerson("pE");
    const view = buildView(null, null, T, false, false, 2);
    expect(view.hpMult).toBe(2);
    const t = text(render(h(TitleScreen), view));
    expect(t).not.toContain("Crumbs · 100 HP");
  });
});
