/**
 * The daily check's news (Keep the monsters coming) waits for startFrom (web/src/game/state.ts); with nothing kept in the
 * browser (first open on this phone, site data cleared, storage blocked), startFrom marks every event in the view as
 * seen — and the view already holds what the daily check just settled — so the waiting push finds nothing new.
 * Runs state.ts verbatim (a copy with its private functions exported) against a pretend api.
 */
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addDays, buildView, newRun, settle, toEventView, type GameClock, type GameLog } from "../shared/game/index.js";

const auto = vi.fn();
vi.mock("../web/src/lib/api", () => ({ api: { gameAuto: (...a: unknown[]) => auto(...a), game: vi.fn(), gameSync: vi.fn() } }));

const COPY = path.join(__dirname, "../web/src/game/state-copy-for-test.ts");
type S = typeof import("../web/src/game/state") & {
  startFrom: (v: unknown) => void; dailyCheck: (t: string) => Promise<void>; queueNow: () => { result: { kind: string } }[];
};
let S: S;
beforeAll(async () => {
  fs.writeFileSync(COPY, fs.readFileSync(process.env.R2_STATE || path.join(__dirname, "../web/src/game/state.ts"), "utf8") + "\nexport { startFrom, dailyCheck };\nexport const queueNow = () => queue;\n");
  S = (await import("../web/src/game/state-copy-for-test")) as unknown as S;
});
afterAll(() => { fs.rmSync(COPY, { force: true }); });

const T = "2026-11-22";
let n = 0;
const clock = (today: string): GameClock => ({ today, nowTime: "12:00", nowIso: `${today}T12:00:00.000Z`, newId: () => `e${n++}` });
const snacks = Array.from({ length: 6 }, (_, i) => { const day = addDays(T, i - 5); return { id: `s${i}`, what: "Chips", day, time: "", size: "snack" as const, planned: false, createdAt: `${day}T20:00:00.000Z` }; });
const log: GameLog = { splurges: snacks, activities: [], entriesSinceStart: 0, entryDays: [], weekStart: 0, hpMult: 1 };

/** Crumbs started T-3 (due T-1): yesterday's missed deadline is settled by today's first look. */
function missedYesterday() {
  const st = newRun(1, "normal", clock(addDays(T, -3))).state;
  const before = buildView(st, log, T, true, true);
  const out = settle(st, log, clock(T));
  return { before, after: buildView(out.state, log, T, false, true), happened: out.added.map(toEventView) };
}

describe("first game open on a phone with nothing kept", () => {
  it("Keep the monsters coming OFF: yesterday's strike comes up (sync after the first view)", async () => {
    const { before, happened } = missedYesterday();
    expect(happened.map((e) => e.kind)).toContain("strike");
    S.setGamePerson("off");
    S.startFrom(before);
    S.pushHappened(happened); // what syncAfterLog does with the sync's answer
    console.log("autoStart off:", S.queueNow().map((q) => q.result.kind));
    expect(S.queueNow().map((q) => q.result.kind)).toEqual(["strike"]);
  });

  it("Keep the monsters coming ON: the same strike, settled by the daily check, should come up too", async () => {
    const { after, happened } = missedYesterday();
    S.setGamePerson("on");
    auto.mockResolvedValueOnce({ checked: true, started: false, happened, view: after });
    await S.dailyCheck(T); // useGame's queryFn: the daily check first, then GET /api/game (which now holds the strike)
    S.startFrom(after);
    console.log("autoStart on:", S.queueNow().map((q) => q.result.kind));
    expect(S.queueNow().map((q) => q.result.kind)).toEqual(["strike"]);
  });
});
