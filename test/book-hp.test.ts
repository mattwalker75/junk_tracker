/** Monster Book HP (Matt, Nov 22 2026: your toughness): the Monster Book's HP for a monster not being fought, on Tough — the map and the Victory NEXT card were fixed to use monsterHp; the Book wasn't. */
import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildView, deadlineFor, newRun, settle, type GameClock, type GameLog, type GameView } from "../shared/game/index.js";
import { today as phoneToday } from "../web/src/lib/dates";
import { Book } from "../web/src/game/Book";
import { setGamePerson } from "../web/src/game/state";

const T = phoneToday();
let n = 0;
const clock = (today: string): GameClock => ({ today, nowTime: "12:00", nowIso: `${today}T12:00:00.000Z`, newId: () => `b${n++}` });
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
function render(view: GameView): string {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  qc.setQueryData(["game", T], view);
  return text(renderToStaticMarkup(h(QueryClientProvider, { client: qc }, h(Book))));
}
describe("Monster Book on Tough", () => {
  it("Long Frank, up next after Tot Rock goes down, shows the HP the fight will have (540, as the map and NEXT card say)", () => {
    const st = newRun(1, "normal", clock(T), false, 1.5).state;
    st.fights[0].level = 17; st.fights[0].deadlineOn = deadlineFor(17, T, false);
    const lg: GameLog = { splurges: [], activities: [{ id: "a", what: "Run", day: T, time: "18:00", minutes: 1400, calories: null, createdAt: `${T}T18:00:00.000Z` }], entriesSinceStart: 0, entryDays: [], weekStart: 0, hpMult: 1.5 };
    const out = settle(st, lg, clock(T));
    const view = buildView(out.state, lg, T, false, false, 1.5);
    expect(view.next).toMatchObject({ level: 18, hp: 540 });
    setGamePerson("book");
    const card = /Lv 18 Long Frank .*?HP (\d+) · Deadline/.exec(render(view));
    console.log("Book card for Long Frank:", card?.[0]);
    expect(card?.[1]).toBe("540");
  });
});
