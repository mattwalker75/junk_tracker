/** Random play-throughs (deep review, Nov 22 2026): settling twice adds nothing, every KO-day entry counts for one fight, hearts, lives and power-ups stay in bounds. FUZZ_RUNS=300 for the full set. */
import { describe, expect, it } from "vitest";
import {
  addDays, dropToNormal, fightInputFor, newRun, pendingLevel, settle, simulateFight, startNextFight, usePowerUp,
  type ActivityEv, type GameClock, type GameLog, type RunState, type SplurgeEv,
} from "../shared/game/index.js";

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const D0 = "2026-11-01";
const pad = (n: number) => String(n).padStart(2, "0");

function play(seed: number, levelStart = 1, mode: "normal" | "hardcore" = "normal", mult = 1) {
  const r = rng(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  let ids = 0;
  const splurges: SplurgeEv[] = [];
  const activities: ActivityEv[] = [];
  const clockAt = (today: string, hh: number, mm: number): GameClock => ({ today, nowTime: `${pad(hh)}:${pad(mm)}`, nowIso: `${today}T${pad(hh)}:${pad(mm)}:30.000Z`, newId: () => `e${++ids}` });
  const log = (): GameLog => ({ splurges, activities, entriesSinceStart: splurges.length + activities.length, weekStart: 0, hpMult: mult });
  let st: RunState = newRun(1, mode, clockAt(D0, 0, 0), false, mult).state;
  if (levelStart > 1) { st.fights[0].level = levelStart; }
  const problems: string[] = [];
  for (let day = 0; day < 40; day++) {
    const today = addDays(D0, day);
    for (let step = 0; step < 6; step++) {
      const hh = 6 + step * 3, mm = Math.floor(r() * 60);
      const c = clockAt(today, hh, mm);
      const roll = r();
      const backdate = r() < 0.15 ? -1 : 0;
      const eday = addDays(today, backdate);
      const timed = r() < 0.7;
      const etime = timed ? `${pad(Math.floor(r() * 24))}:${pad(Math.floor(r() * 60))}` : "";
      if (roll < 0.35) activities.push({ id: `a${++ids}`, what: "Run", day: eday, time: etime, minutes: pick([null, 5, 20, 45, 70, 150]), calories: pick([null, 100, 400]), createdAt: c.nowIso });
      else if (roll < 0.55) splurges.push({ id: `s${++ids}`, what: "Treat", day: eday, time: etime, size: pick(["snack", "meal", "feast"] as const), planned: r() < 0.2, createdAt: c.nowIso });
      else if (roll < 0.6 && st.run.potions > 0 && st.fights.some((f) => f.status === "open")) {
        try { st = usePowerUp(st, log(), c, "potion").state; } catch { /* rule */ }
      } else if (roll < 0.65 && st.run.shields > 0 && !st.run.shieldArmed && st.fights.some((f) => f.status === "open")) {
        try { st = usePowerUp(st, log(), c, "shield").state; } catch { /* rule */ }
      } else if (roll < 0.7 && st.run.winds > 0 && st.fights.some((f) => f.status === "open")) {
        try { st = usePowerUp(st, log(), c, "wind").state; } catch { /* rule */ }
      } else if (roll < 0.72) {
        try { st = dropToNormal(st, c).state; } catch { /* rule */ }
      }
      st = settle(st, log(), c).state;
      const R = st.run;
      if (R.hearts < 0 || R.hearts > 5 || R.lives < 0 || R.lives > 2 || R.shields > 3 || R.potions > 3 || R.winds > 3 || R.shields < 0 || R.potions < 0 || R.winds < 0) problems.push(`day ${today}: out of range ${JSON.stringify(R)}`);
      if (st.fights.filter((f) => f.status === "open").length > 1) problems.push(`day ${today}: two open fights`);
      if (st.run.endReason) return { st, problems };
      // a second settle with nothing new must change nothing
      const again = settle(st, log(), c);
      if (again.added.length) problems.push(`day ${today} ${hh}: settle twice added ${again.added.map((e) => e.kind).join(",")}`);
      if (pendingLevel(st) !== null && r() < 0.6) st = startNextFight(st, log(), c, pick([1, 1.5, 2] as const)).state;
    }
  }
  // the KO-day rule: on a part-day, the KO'd fight's used list and the next fight's counted entries never overlap
  for (let i = 1; i < st.fights.length; i++) {
    const f = st.fights[i];
    if (!f.startedAfter) continue;
    const prev = st.fights[i - 1];
    const ko = st.events.find((e) => e.kind === "ko" && e.fightId === prev.id)!;
    const used = new Set((ko.data.used as string[]) ?? []);
    const inp = fightInputFor(st, f, log(), f.endedOn ?? addDays(D0, 39));
    const sim = simulateFight(inp);
    const both = sim.counted.filter((a) => a.day === f.startedOn && used.has(a.id));
    if (both.length) problems.push(`fight ${f.level}: ${both.map((a) => a.id)} counted twice`);
  }
  return { st, problems };
}

describe("review: random play-throughs", () => {
  it("settle twice never adds anything, and no KO-day entry counts for two fights", () => {
    const all: string[] = [];
    for (let seed = 1; seed <= Number(process.env.FUZZ_RUNS ?? 80); seed++) {
      const { problems } = play(seed, 1 + (seed % 120), seed % 3 === 0 ? "hardcore" : "normal", [1, 1.5, 2][seed % 3]);
      all.push(...problems.map((p) => `seed ${seed} (level ${1 + (seed % 120)}): ${p}`));
    }
    expect(all.slice(0, 15)).toEqual([]);
  });
});
