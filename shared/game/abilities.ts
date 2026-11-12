/**
 * The 60 monsters' abilities, one entry each, built from the hooks in Docs/game/ARCHITECTURE.md.
 * The wording is from Docs/GAME_MODE.md (the first 16) and Docs/game/MONSTERS.md (the 44 newer
 * ones); where it was unclear, the reading chosen is listed in MONSTERS.md under "Decisions made
 * while building". Pure: no I/O.
 *
 * The engine (engine.ts) calls the hooks in this order:
 *  - each splurge: base heal by size → `heal` → halved (rounded up) for a planned treat unless
 *    `plannedFull` → a Veggie Shield may block it → capped at max HP;
 *  - each workout: minutes + round(calories ÷ 10) → ×2 for a comeback (unless `noComeback`) → `damage`;
 *  - each finished clean day: a crit of 25 → `crit`; then `dayEnd`;
 *  - when a hit would take it to 0: `canFinish` (no → it stays at 1 HP), then `revive` (once);
 *  - after a hit that leaves it standing: `threshold` (once).
 */
import type { Day } from "../types.js";
import { weekday } from "./days.js";
import type { Level } from "./levels.js";
import type { ActivityEv, SplurgeEv } from "./types.js";

/** What an ability can see of the fight at the moment its hook runs. */
export interface Cx {
  level: Level;
  hp: number;
  max: number;
  day: Day;
  /** the deadline's day (with any Second Wind) */
  deadlineOn: Day;
  /** `day` is the deadline's last day */
  lastDay: boolean;
  damageToday: number;
  healsToday: number;
  /** the splurges that count for this fight on `day`, in order (the whole day, as logged so far) */
  splurgesToday: SplurgeEv[];
  /** any splurge on the day before `day` (the whole log) */
  splurgedYesterday: boolean;
  /** the workouts that count for this fight on `day`, in order (the whole day) */
  workoutsToday: ActivityEv[];
  workedOutToday: boolean;
  /** the position of the splurge or workout being worked out among today's (0 = the first) */
  index: number;
  /** the workout being worked out is the day's first in the whole log, after a day with no activity */
  restedYesterday: boolean;
  /** the workout being worked out got the comeback ×2 */
  comeback: boolean;
  /** minutes + round(calories ÷ 10) */
  raw(a: ActivityEv): number;
  /** a workout's damage before abilities (with its comeback ×2) */
  base(a: ActivityEv): number;
  /** this fight's own notes for the ability (counters, flags), starting empty */
  state: Record<string, number>;
  /** a heal that lands at the start of the next day ("then 5 more the next day") */
  later(heal: number, note: string): void;
}

export interface Ability {
  id: string;
  name: string;
  /** shown in the Monster Book and on the battle screen */
  text: string;
  heal?(base: number, s: SplurgeEv, cx: Cx): number;
  damage?(base: number, a: ActivityEv, cx: Cx): number;
  crit?(base: number, day: Day, cx: Cx): number;
  dayEnd?(day: Day, cx: Cx): { heal?: number; damage?: number; note: string }[];
  /** HP to come back with the first time it would hit 0 */
  revive?(cx: Cx): number | null;
  /** once a fight, after a hit that leaves it standing */
  threshold?(cx: Cx): { heal: number; note: string } | null;
  /** false: it cannot be finished today (it stays at 1 HP) */
  canFinish?(day: Day, cx: Cx): boolean;
  noPowerUps?: boolean;
  noComeback?: boolean;
  /** planned treats heal in full, not half */
  plannedFull?: boolean;
  /** extra days on the deadline */
  extraDays?: number;
}

const half = (n: number) => Math.ceil(n / 2);
/** no time = assume the worst (Matt, Nov 11 2026) */
const lateNight = (s: SplurgeEv) => !s.time || s.time >= "21:00";
const beforeEleven = (s: SplurgeEv) => !s.time || s.time < "11:00";
const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/** another splurge that day within 3 hours (either side); no time on either counts as within */
const nearAnother = (s: SplurgeEv, cx: Cx) => cx.splurgesToday.some((o) => o.id !== s.id && (!o.time || !s.time || Math.abs(minutesOf(o.time) - minutesOf(s.time)) <= 180));
const snacksBefore = (cx: Cx) => cx.splurgesToday.slice(0, cx.index).filter((x) => x.size === "snack").length;

const LIST: Ability[] = [
  // ---------------------------------------------------------------- World 1 · Snack Swamp
  { id: "none", name: "No tricks", text: "No ability. A good one to learn on." },
  { id: "crunch-flurry", name: "Crunch Flurry", text: "Snacks heal 15.", heal: (b, s) => (s.size === "snack" ? 15 : b) },
  { id: "long-chew", name: "Long Chew", text: "Snacks heal 10, then 5 more the next day.",
    heal: (b, s, cx) => { if (s.size === "snack") cx.later(5, "Long Chew: 5 more from yesterday's snack"); return b; } },
  { id: "loop-de-loop", name: "Loop-de-Loop", text: "Meals heal 25, then 10 more the next day.",
    heal: (b, s, cx) => { if (s.size === "meal") cx.later(10, "Loop-de-Loop: 10 more from yesterday's meal"); return b; } },
  { id: "wobble-back", name: "Wobble Back", text: "Regains 20 once, at half HP.",
    threshold: (cx) => (cx.hp <= cx.max / 2 ? { heal: 20, note: "Wobble Back: it wobbles back 20" } : null) },
  { id: "puff-up", name: "Puff Up", text: "Below half HP, Snacks heal 20, not 10.", heal: (b, s, cx) => (s.size === "snack" && cx.hp < cx.max / 2 ? 20 : b) },
  { id: "pop-pop-pop", name: "Pop Pop Pop", text: "Snacks on the same day heal 10, then 20, then 30.",
    heal: (b, s, cx) => (s.size === "snack" ? [10, 20, 30][Math.min(snacksBefore(cx), 2)] : b) },
  { id: "wriggle-free", name: "Wriggle Free", text: "The comeback ×2 does nothing here.", noComeback: true },
  { id: "candy-flock", name: "Candy Flock", text: "The 3rd Snack in a day heals 30, not 10.", heal: (b, s, cx) => (s.size === "snack" && snacksBefore(cx) === 2 ? 30 : b) },
  { id: "fizz-shield", name: "Fizz Shield", text: "The first 15 min each day do half damage.",
    damage: (b, a, cx) => {
      const key = `fizz:${cx.day}`;
      const k = Math.min(a.minutes ?? 0, 15 - (cx.state[key] ?? 0));
      if (k <= 0) return b;
      cx.state[key] = (cx.state[key] ?? 0) + k;
      return Math.max(0, b - Math.floor((k * (cx.comeback ? 2 : 1)) / 2));
    } },
  // ---------------------------------------------------------------- World 2 · Burger Badlands
  { id: "regrow", name: "Regrow", text: "Meals heal 35.", heal: (b, s) => (s.size === "meal" ? 35 : b) },
  { id: "brother-act", name: "Brother Act", text: "The first knockout leaves it at 30 HP, so it has to be knocked down twice.", revive: () => 30 },
  { id: "dill-deal", name: "Dill Deal", text: "Snacks heal only 5, but Meals heal 40.", heal: (b, s) => (s.size === "snack" ? 5 : s.size === "meal" ? 40 : b) },
  { id: "sticky-cheese", name: "Sticky Cheese", text: "Clean-day crits do 15.", crit: () => 15 },
  { id: "stick-em-up", name: "Stick 'Em Up", text: "No power-ups work in this fight (you keep them).", noPowerUps: true },
  { id: "encore", name: "Encore", text: "Weekend splurges heal 15 extra.", heal: (b, s) => (weekday(s.day) === 0 || weekday(s.day) === 6 ? b + 15 : b) },
  { id: "hard-shell", name: "Hard Shell", text: "The first 10 damage of every workout bounces off.", damage: (b) => Math.max(0, b - 10) },
  { id: "long-haul", name: "Long Haul", text: "One extra day on the deadline.", extraDays: 1 },
  { id: "sundown-howl", name: "Sundown Howl", text: "+10 each day with no workout by 6 PM.",
    dayEnd: (_d, cx) => (cx.workoutsToday.some((a) => a.time && a.time <= "18:00") ? [] : [{ heal: 10, note: "Sundown Howl: no workout by 6 PM, +10" }]) },
  { id: "grease-rain", name: "Grease Rain", text: "Feasts heal 90.", heal: (b, s) => (s.size === "feast" ? 90 : b) },
  // ---------------------------------------------------------------- World 3 · Sugar Peaks
  { id: "chill", name: "Chill", text: "The first workout each day does 10 less.", damage: (b, _a, cx) => (cx.index === 0 ? Math.max(0, b - 10) : b) },
  { id: "boing-back", name: "Boing Back", text: "Hits under 30 damage do half.", damage: (b) => (b < 30 ? half(b) : b) },
  { id: "hard-candy", name: "Hard Candy", text: "Calories count half (÷ 20) until it drops below half HP.",
    damage: (b, a, cx) => (cx.hp >= cx.max / 2 ? ((a.minutes ?? 0) + Math.round((a.calories ?? 0) / 20)) * (cx.comeback ? 2 : 1) : b) },
  { id: "sugar-rush", name: "Sugar Rush", text: "Snacks heal 20.", heal: (b, s) => (s.size === "snack" ? 20 : b) },
  { id: "stretchy", name: "Stretchy", text: "Damage past 60 in one workout counts half.", damage: (b) => (b > 60 ? 60 + half(b - 60) : b) },
  { id: "whirlwind", name: "Whirlwind", text: "A Feast blows away your next clean-day crit.",
    heal: (b, s, cx) => { if (s.size === "feast") cx.state.blow = (cx.state.blow ?? 0) + 1; return b; },
    crit: (b, _d, cx) => { if ((cx.state.blow ?? 0) > 0) { cx.state.blow -= 1; return 0; } return b; } },
  { id: "bitten-ear", name: "Bitten Ear", text: "At half HP, its next 3 heals are doubled.",
    threshold: (cx) => { if (cx.hp > cx.max / 2) return null; cx.state.doubled = 3; return { heal: 0, note: "Bitten Ear: its next 3 heals are doubled" }; },
    heal: (b, _s, cx) => { if ((cx.state.doubled ?? 0) > 0) { cx.state.doubled -= 1; return b * 2; } return b; } },
  { id: "slurp", name: "Slurp", text: "+5 every day without a workout.", dayEnd: (_d, cx) => (cx.workedOutToday ? [] : [{ heal: 5, note: "Slurp: a day without a workout, +5" }]) },
  { id: "soft-landing", name: "Soft Landing", text: "A clean day only lands its crit if you also worked out that day.", crit: (b, _d, cx) => (cx.workedOutToday ? b : 0) },
  { id: "sprinkle-storm", name: "Sprinkle Storm", text: "Every splurge heals 10 extra.", heal: (b) => b + 10 },
  // ---------------------------------------------------------------- World 4 · Fizzy Falls
  { id: "caffeine-rush", name: "Caffeine Rush", text: "The first splurge each day heals double.", heal: (b, _s, cx) => (cx.index === 0 ? b * 2 : b) },
  { id: "last-leap", name: "Last Leap", text: "On the deadline's last day, every heal is doubled.", heal: (b, _s, cx) => (cx.lastDay ? b * 2 : b) },
  { id: "chewy-pearls", name: "Chewy Pearls", text: "Snacks heal 20, not 10.", heal: (b, s) => (s.size === "snack" ? 20 : b) },
  { id: "pucker-up", name: "Pucker Up", text: "Planned treats heal in full, not half.", plannedFull: true },
  { id: "ice-grip", name: "Ice Grip", text: "After a day with no workout, the next workout counts minutes only.",
    damage: (b, a, cx) => (cx.restedYesterday ? (a.minutes ?? 0) * (cx.comeback ? 2 : 1) : b) },
  { id: "second-cup", name: "Second Cup", text: "After a Meal, your next Snack heals 25.",
    heal: (b, s, cx) => {
      if (s.size === "meal") { cx.state.cup = 1; return b; }
      if (s.size === "snack" && cx.state.cup) { cx.state.cup = 0; return 25; }
      return b;
    } },
  { id: "vanishing-act", name: "Vanishing Act", text: "Workouts logged after 8 PM do half damage.", damage: (b, a) => (!a.time || a.time >= "20:00" ? half(b) : b) },
  { id: "last-licks", name: "Last Licks", text: "Can't be finished on a day you splurge; it stays at 1 HP.", canFinish: (_d, cx) => cx.splurgesToday.length === 0 },
  { id: "one-two", name: "One-Two", text: "A day's second splurge heals double.", heal: (b, _s, cx) => (cx.index === 1 ? b * 2 : b) },
  { id: "free-refills", name: "Free Refills", text: "Every Snack heals 10, then 10 more the next morning.",
    heal: (b, s, cx) => { if (s.size === "snack") cx.later(10, "Free Refills: 10 more from yesterday's snack"); return b; } },
  // ---------------------------------------------------------------- World 5 · Midnight Drive-Thru
  { id: "shadow-dodge", name: "Shadow Dodge", text: "Workouts under 15 min do 0 damage.", damage: (b, a) => ((a.minutes ?? 0) < 15 ? 0 : b) },
  { id: "breakfast-bark", name: "Breakfast Bark", text: "Splurges before 11 AM heal double (a splurge with no time counts as before 11 AM).", heal: (b, s) => (beforeEleven(s) ? b * 2 : b) },
  { id: "crunch-armor", name: "Crunch Armor", text: "Workouts under 20 min do half.", damage: (b, a) => ((a.minutes ?? 0) < 20 ? half(b) : b) },
  { id: "cheese-pull", name: "Cheese Pull", text: "Snacks heal 25, not 10.", heal: (b, s) => (s.size === "snack" ? 25 : b) },
  { id: "extra-wrap", name: "Extra Wrap", text: "Meals heal 40, not 25.", heal: (b, s) => (s.size === "meal" ? 40 : b) },
  { id: "reboot", name: "Reboot", text: "Once, at a quarter of its HP, it regains 60.", threshold: (cx) => (cx.hp <= cx.max / 4 ? { heal: 60, note: "Reboot: it regains 60" } : null) },
  { id: "rise-again", name: "Rise Again", text: "The first time it hits 0 HP, it rises again with 60 HP.", revive: () => 60 },
  { id: "tunnel-vision", name: "Tunnel Vision", text: "Only your biggest workout each day hits in full; the others do half.",
    damage: (b, a, cx) => {
      // the day's biggest workout as logged so far (by its damage before abilities); a tie goes to the first
      let best = cx.workoutsToday[0];
      for (const w of cx.workoutsToday) if (cx.base(w) > cx.base(best)) best = w;
      return best && best.id !== a.id ? half(b) : b;
    } },
  { id: "extra-cheese", name: "Extra Cheese", text: "Feasts heal 80.", heal: (b, s) => (s.size === "feast" ? 80 : b) },
  { id: "supersize-it", name: "Supersize It", text: "Every Meal heals 60, like a Feast.", heal: (b, s) => (s.size === "meal" ? 60 : b) },
  // ---------------------------------------------------------------- World 6 · Feast Fortress
  { id: "comfort-food", name: "Comfort Food", text: "On a day with no workout, every splurge heals 15 extra.", heal: (b, _s, cx) => (cx.workedOutToday ? b : b + 15) },
  { id: "stampede", name: "Stampede", text: "If you splurged yesterday, every splurge today heals double.", heal: (b, _s, cx) => (cx.splurgedYesterday ? b * 2 : b) },
  { id: "rock-solid", name: "Rock Solid", text: "Comeback hits don't double.", noComeback: true },
  { id: "stone-skin", name: "Stone Skin", text: "No comeback ×2.", noComeback: true },
  { id: "all-you-can-eat", name: "All You Can Eat", text: "Every splurge heals 25 extra.", heal: (b) => b + 25 },
  { id: "double-dip", name: "Double Dip", text: "A splurge within 3 hours of another heals double (no time counts as within 3 hours).", heal: (b, s, cx) => (nearAnother(s, cx) ? b * 2 : b) },
  { id: "leftovers", name: "Leftovers", text: "Feasts heal 60, then 30 more the next day.",
    heal: (b, s, cx) => { if (s.size === "feast") cx.later(30, "Leftovers: 30 more from yesterday's feast"); return b; } },
  { id: "bridge-toll", name: "Bridge Toll", text: "The first 20 damage each day does nothing.",
    damage: (b, _a, cx) => {
      const key = `toll:${cx.day}`;
      const take = Math.min(b, 20 - (cx.state[key] ?? 0));
      cx.state[key] = (cx.state[key] ?? 0) + take;
      return b - take;
    } },
  { id: "shield-up", name: "Shield Up", text: "After each splurge, your next workout does 15 less.",
    heal: (b, _s, cx) => { cx.state.shieldUp = 1; return b; },
    damage: (b, _a, cx) => { if (cx.state.shieldUp) { cx.state.shieldUp = 0; return Math.max(0, b - 15); } return b; } },
  { id: "late-night", name: "Late Night", text: "Splurges after 9 PM heal double (no time counts as after 9 PM).", heal: (b, s) => (lateNight(s) ? b * 2 : b) },
];

export const ABILITIES: Readonly<Record<string, Ability>> = Object.fromEntries(LIST.map((a) => [a.id, a]));
