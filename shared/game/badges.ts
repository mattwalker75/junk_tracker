/**
 * The Hall of Heroes badges (mockup MonHall), worked out from a person's stored fights in all their
 * runs. Pure; tested in test/game3.test.ts. Each badge is earned by the first fight that qualifies,
 * so "earned on" is the day that fight ended.
 *
 * - First Blood: your first monster beaten.
 * - Flawless: a monster beaten with no heal landing in the whole fight.
 * - Daredevil: a monster beaten on the Daredevil bet (×2, two days less).
 * - World 1 Clear: Sir Soda (level 10, the Snack Swamp boss) beaten.
 * - Comeback Kid: a monster beaten in a rematch, after it struck you at that level in the same run.
 */
import type { Day } from "../types.js";
import { levelInfo } from "./levels.js";
import type { Bet, FightStatus } from "./types.js";

export type BadgeId = "first-blood" | "flawless" | "daredevil" | "world-1" | "comeback";

/** One stored fight, with the run it belongs to. `seq` is its order in that run. */
export interface BadgeFight { run: number; seq: number; level: number; status: FightStatus; bet: Bet; flawless: boolean; endedOn: Day | null }

export interface Badge {
  id: BadgeId;
  name: string;
  /** how to earn it, one plain sentence */
  how: string;
  earned: boolean;
  earnedOn: Day | null;
  /** what earned it ("Gummo took a heart, then got squished (Run #3)."), once earned */
  detail: string | null;
}

const RULES: { id: BadgeId; name: string; how: string }[] = [
  { id: "first-blood", name: "First Blood", how: "Beat your first monster." },
  { id: "flawless", name: "Flawless", how: "Beat a monster without a single heal landing in the fight." },
  { id: "daredevil", name: "Daredevil", how: "Beat a monster on the Daredevil bet (×2, two days less)." },
  { id: "world-1", name: "World 1 Clear", how: "Beat Sir Soda, the boss of the Snack Swamp." },
  { id: "comeback", name: "Comeback Kid", how: "Win the rematch with a monster that struck you." },
];

export function badgesFor(fights: readonly BadgeFight[]): Badge[] {
  const all = [...fights].sort((a, b) => a.run - b.run || a.seq - b.seq);
  const won = all.filter((f) => f.status === "won");
  const name = (f: BadgeFight) => levelInfo(f.level).name;
  const firstComeback = won.find((w) => all.some((s) => s.run === w.run && s.seq < w.seq && s.level === w.level && s.status === "struck"));
  const found: Record<BadgeId, { f: BadgeFight; detail: string } | null> = {
    "first-blood": pick(won[0], (f) => `${name(f)} went down first (Run #${f.run}).`),
    flawless: pick(won.find((f) => f.flawless), (f) => `${name(f)} never got a bite in (Run #${f.run}).`),
    daredevil: pick(won.find((f) => f.bet === 2), (f) => `${name(f)}, beaten on two days less (Run #${f.run}).`),
    "world-1": pick(won.find((f) => f.level === 10), (f) => `Sir Soda fizzled out (Run #${f.run}).`),
    comeback: pick(firstComeback, (f) => `${name(f)} took a heart, then got squished (Run #${f.run}).`),
  };
  return RULES.map((r) => {
    const hit = found[r.id];
    return { ...r, earned: !!hit, earnedOn: hit?.f.endedOn ?? null, detail: hit?.detail ?? null };
  });
}

function pick(f: BadgeFight | undefined, detail: (f: BadgeFight) => string): { f: BadgeFight; detail: string } | null {
  return f ? { f, detail: detail(f) } : null;
}
