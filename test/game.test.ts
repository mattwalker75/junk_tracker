/** Craving Crusher's engine (shared/game): fights, abilities, settling a run, power-ups and points. Pure — no server. */
import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  ABILITIES, abandonRun, addDays, buildView, deadlineFor, dropToNormal, eventText, fightInputFor, firstLevelOfWorld, GameRuleError, LEVELS, levelInfo, newRun, preview,
  runScore, setBet, settle, simulateFight, struckPoints, usePowerUp, wonPoints,
  type ActivityEv, type FightInput, type GameClock, type GameLog, type RunState, type SplurgeEv,
} from "../shared/game/index.js";

const D = "2026-11-10"; // a Tuesday
const day = (n: number) => addDays(D, n);
let n = 0;
const S = (size: SplurgeEv["size"], o: Partial<SplurgeEv> = {}): SplurgeEv =>
  ({ id: `s${++n}`, what: "Treat", day: D, time: "", size, planned: false, createdAt: `${o.day ?? D}T12:00:00.000Z`, ...o });
const A = (minutes: number | null, o: Partial<ActivityEv> = {}): ActivityEv =>
  ({ id: `a${++n}`, what: "Walk", day: D, time: "08:00", minutes, calories: null, createdAt: `${o.day ?? D}T09:00:00.000Z`, ...o });

type FightOpts = Partial<Omit<FightInput, "level">> & { warm?: boolean };
/** One fight. An empty activity the day before the fight is added (so there is no comeback ×2) unless warm: false. */
function fight(level: number, o: FightOpts = {}) {
  const startedOn = o.startedOn ?? D;
  const warm = o.warm === false ? [] : [A(null, { day: addDays(startedOn, -1), time: "07:00" })];
  return simulateFight({
    level, startedOn, startedAfter: o.startedAfter ?? null, deadlineOn: o.deadlineOn ?? deadlineFor(level, startedOn, false), today: o.today ?? startedOn,
    splurges: o.splurges ?? [], activities: [...warm, ...(o.activities ?? [])], potions: o.potions, shieldFrom: o.shieldFrom, blocked: o.blocked,
  });
}
/** Damage done (max − hp). */
const dmg = (level: number, activities: ActivityEv[], o: FightOpts = {}) => { const r = fight(level, { ...o, activities }); return r.max - r.hp; };
/** What splurges heal: a hit first (06:00, 40% of its HP unless said), then the HP gained compared with the hit alone. */
function heal(level: number, splurges: SplurgeEv[], o: FightOpts & { hit?: number } = {}) {
  const startedOn = o.startedOn ?? D;
  const hit = A(o.hit ?? Math.floor(levelInfo(level).hp * 0.4), { id: "hit", time: "06:00", day: startedOn });
  const acts = [hit, ...(o.activities ?? [])];
  return fight(level, { ...o, splurges, activities: acts }).hp - fight(level, { ...o, activities: acts }).hp;
}

let ids = 0;
const clock = (today: string, nowTime = "", nowIso = `${today}T20:00:00.000Z`): GameClock => ({ today, nowTime, nowIso, newId: () => `id${++ids}` });
const logOf = (splurges: SplurgeEv[] = [], activities: ActivityEv[] = [], o: Partial<GameLog> = {}): GameLog => ({ splurges, activities, entriesSinceStart: 0, weekStart: 0, ...o });
/** A run started on `on` (at 00:00:01), its open fight at `level`. */
function run(on = D, o: { mode?: "normal" | "hardcore"; level?: number; hearts?: number } = {}): RunState {
  const st = newRun(1, o.mode ?? "normal", clock(on, "", `${on}T00:00:01.000Z`)).state;
  const f = st.fights[0];
  if (o.level) { f.level = o.level; f.deadlineOn = deadlineFor(o.level, on, false); }
  if (o.hearts) st.run.hearts = o.hearts;
  return st;
}
const open = (st: RunState) => st.fights.find((f) => f.status === "open")!;
const kinds = (st: { added: { kind: string }[] }) => st.added.map((e) => e.kind);

/** every ability with a test of its own: checked at the end */
const tested = new Set<string>();
const covers = (level: number) => tested.add(levelInfo(level).ability);

describe("levels", () => {
  it("are the 60 of levels60.json, 6 worlds of 10 with the boss last, each with its own ability", () => {
    const json = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../Docs/game/levels60.json"), "utf8")) as { level: number; world: string; name: string; boss: boolean; hp: number; days: number; svg: string }[];
    expect(LEVELS).toHaveLength(60);
    json.forEach((j, i) => {
      const l = LEVELS[i];
      expect([l.level, `${l.world} · ${l.worldName}`, l.name, l.boss, l.hp, l.days, `${l.slug}.svg`]).toEqual([j.level, j.world, j.name, j.boss, j.hp, j.days, j.svg]);
      expect(ABILITIES[l.ability], l.name).toBeDefined();
    });
    expect(new Set(LEVELS.map((l) => l.ability)).size).toBe(60);
    expect(Object.keys(ABILITIES)).toHaveLength(60);
    expect(LEVELS.filter((l) => l.boss).map((l) => l.level)).toEqual([10, 20, 30, 40, 50, 60]);
    expect([firstLevelOfWorld(1), firstLevelOfWorld(10), firstLevelOfWorld(13), firstLevelOfWorld(60)]).toEqual([1, 1, 11, 51]);
    for (const l of LEVELS) expect(fs.existsSync(path.join(import.meta.dirname, "../Docs/game/monsters", `${l.slug}.svg`)), l.slug).toBe(true);
  });

  it("deadlines: the start day is day 1; after a KO the part-day is a bonus; a bet takes 1 or 2 days off", () => {
    expect(deadlineFor(1, D, false)).toBe(day(2)); // Crumbs: 3 days
    expect(deadlineFor(1, D, true)).toBe(day(3));
    expect(deadlineFor(1, D, false, 1.5)).toBe(day(1));
    expect(deadlineFor(1, D, false, 2)).toBe(D);
    expect(deadlineFor(60, D, false)).toBe(day(7)); // The Midnight Snacker: 8 days
  });
});

describe("damage and heals", () => {
  it("a workout does minutes + calories ÷ 10 (rounded), with no cap; missing ones count as 0", () => {
    expect(dmg(60, [A(45, { calories: 210 })])).toBe(66); // the worked example
    expect(dmg(60, [A(45, { calories: 215 })])).toBe(67);
    expect(dmg(60, [A(null, { calories: 800 })])).toBe(80);
    expect(dmg(60, [A(120, { calories: 800 })])).toBe(200);
    const none = fight(60, { activities: [A(null)] });
    expect(none.hp).toBe(none.max);
    expect(none.lines.at(-1)?.text).toMatch(/no damage — still \+5 points/);
    covers(1);
  });

  it("splurges heal Snack 10, Meal 25, Feast 60; a planned treat half, rounded up; never past max HP", () => {
    // Garlic Bread Gargoyle: its ability (no comeback) leaves heals alone
    expect(heal(54, [S("snack")])).toBe(10);
    expect(heal(54, [S("meal")])).toBe(25);
    expect(heal(54, [S("feast")])).toBe(60);
    expect(heal(54, [S("snack", { planned: true }), S("meal", { planned: true })])).toBe(5 + 13);
  });

  it("planned treats and the cap, on a monster with no tricks", () => {
    expect(heal(1, [S("snack", { planned: true })])).toBe(5);
    expect(heal(1, [S("meal", { planned: true })])).toBe(13);
    expect(heal(1, [S("feast", { planned: true })])).toBe(30);
    // Crumbs at 60/100 eats a feast: 40 fills it up, the extra goes on as bonus HP — capped at 20 (20% of 100)
    const r = fight(1, { splurges: [S("feast")], activities: [A(40, { time: "06:00" })] });
    expect([r.hp, r.bonus, r.bonusMax, r.heals]).toEqual([100, 20, 20, 60]);
    const line = r.lines.find((l) => l.kind === "heal")!;
    expect([line.amount, line.bonus]).toEqual([60, 20]);
    expect(line.text).toBe("Treat heals Crumbs +60. It fills up, and the extra 20 is bonus HP (the bonus bar is full).");
    // a heal at full HP still counts as landed (not flawless)
    expect(fight(1, { splurges: [S("snack")] }).flawless).toBe(false);
    expect(fight(1, { activities: [A(10)] }).flawless).toBe(true);
  });

  it("bonus HP: a heal past full goes on top, up to 20% of max HP; damage takes it off first (Matt, Nov 14 2026)", () => {
    // Crumbs (100 HP) eats a Feast at full: +20 bonus HP (the cap), the rest is lost
    const f = fight(1, { splurges: [S("feast", { time: "08:00" })] });
    expect([f.hp, f.bonus, f.bonusMax, f.heals, f.flawless]).toEqual([100, 20, 20, 20, false]);
    expect(f.lines[0].text).toBe("Treat heals Crumbs +20. It was at full HP, so that's +20 bonus HP (the bonus bar is full).");
    // a 30-minute walk after it: 20 off the bonus HP, then 10 off the HP
    expect(fight(1, { splurges: [S("feast", { time: "08:00" })], activities: [A(30, { time: "09:00" })] })).toMatchObject({ hp: 90, bonus: 0, damage: 30 });
    // after a Snack at full, 100 minutes no longer finishes Crumbs: the 10 bonus HP has to go too
    expect(fight(1, { splurges: [S("snack", { time: "08:00" })], activities: [A(100, { time: "09:00" })] })).toMatchObject({ hp: 10, bonus: 0, ko: null });
    expect(fight(1, { splurges: [S("snack", { time: "08:00" })], activities: [A(110, { time: "09:00" })] }).ko).not.toBeNull();
    // full HP and a full bonus bar: nothing more lands
    const maxed = fight(1, { splurges: [S("feast", { id: "a", time: "08:00" }), S("snack", { id: "b", time: "09:00" })] });
    expect(maxed.lines[1]).toMatchObject({ amount: 0, text: "Crumbs is at full HP with a full bonus bar, so that heals nothing." });
    // the final boss's cap is 20% of 1,280
    expect(fight(60, { splurges: [S("feast", { time: "12:00" })] })).toMatchObject({ hp: 1280, bonus: 60, bonusMax: 256 });
  });

  it("comeback: the first workout after a day with no activity does ×2 — the day before the fight counts too", () => {
    expect(dmg(60, [A(30)], { warm: false })).toBe(60);
    expect(dmg(60, [A(30), A(30, { time: "09:00" })], { warm: false })).toBe(90); // only the first
    expect(dmg(60, [A(30)])).toBe(30); // an activity yesterday (outside the fight) means no comeback
    expect(fight(60, { warm: false, activities: [A(30)] }).lines[0].text).toMatch(/comeback ×2/);
    // the next day: nothing the day before → ×2 again
    expect(dmg(1, [A(10), A(10, { day: day(2) })], { today: day(2), splurges: [S("snack", { day: day(1) })] })).toBe(10 + 25 - 10 + 20);
  });

  it("clean-day crits: 25 for each finished day in the window with no splurge; a planned treat is still a splurge; today does not count yet", () => {
    expect(fight(60, { today: D }).hp).toBe(1280);
    expect(fight(60, { today: day(2) }).hp).toBe(1280 - 50);
    expect(fight(60, { today: day(2), splurges: [S("snack", { day: day(1), planned: true, time: "12:00" })] }).hp).toBe(1280 - 25 + 5);
    // a splurge outside the fight's part-day still makes the calendar day not clean
    expect(fight(60, { today: day(1), startedAfter: `${D}T15:00:00.000Z`, splurges: [S("snack", { createdAt: `${D}T08:00:00.000Z`, time: "08:00" })] }).hp).toBe(1280);
    // the deadline's last day lands its crit once it is over
    // (the two snacks at full HP go on as 20 bonus HP, which the crit takes off first)
    const lastDay = fight(1, { today: day(3), splurges: [S("snack"), S("snack", { day: day(1) })] });
    expect([lastDay.hp, lastDay.bonus]).toEqual([95, 0]);
  });

  it("which entries count: the window only; on a part-day only what was made after the fight began; backdated ones in the window count", () => {
    const after = `${D}T15:00:00.000Z`;
    const acts = [
      A(10, { createdAt: `${D}T14:00:00.000Z` }), // same day, made before the fight began: no
      A(20, { createdAt: `${D}T16:00:00.000Z` }), // same day, after: yes
      A(30, { day: day(1), createdAt: `${day(5)}T10:00:00.000Z`, time: "08:00" }), // backdated into the window: yes
      A(40, { day: day(4), time: "08:00" }), // after the deadline (D+3 for a part-day start): no
      A(50, { day: day(-1), time: "09:00" }), // before the fight: no
    ];
    const r = fight(1, { startedAfter: after, deadlineOn: deadlineFor(1, D, true), today: day(1), activities: acts, splurges: [S("snack", { createdAt: `${D}T10:00:00.000Z`, time: "10:00" }), S("snack", { day: day(1), time: "12:00" })] });
    expect(r.damage).toBe(20 + 30);
    expect(r.counted.map((a) => a.minutes)).toEqual([20, 30]);
    expect(r.heals).toBe(10); // the 10:00 snack on the part-day was before the fight
  });

  it("order within a day: entries with a time first, by time; then those with none, in the order they were made", () => {
    const r = fight(60, { activities: [A(1, { time: "", what: "Late log", createdAt: `${D}T07:00:00.000Z` }), A(2, { time: "18:00", what: "Evening" }), A(3, { time: "06:00", what: "Morning" }), A(4, { time: "", what: "Later log", createdAt: `${D}T22:00:00.000Z` })] });
    expect(r.lines.map((l) => l.text.split(" ")[0])).toEqual(["Morning", "Evening", "Late", "Later"]);
  });

  it("preview: what one more entry would do", () => {
    const inp: FightInput = { level: 11, startedOn: D, startedAfter: null, deadlineOn: day(3), today: D, splurges: [], activities: [A(null, { day: day(-1) }), A(158, { time: "07:00" })] };
    const p = preview(inp, { activity: A(45, { calories: 210, time: "09:00" }) });
    expect(p.before.hp).toBe(92);
    expect(p.change).toBe(-66);
    expect(preview(inp, { activity: A(92, { time: "09:00" }) }).after.ko).not.toBeNull();
    expect(preview(inp, { splurge: S("meal") }).change).toBe(35); // Fry Hydra: Regrow
  });
});

describe("abilities: one test each (at least)", () => {
  it("Chiplet, Glazewing, Boba Blob, Mozz Mantis: Snacks heal 15, 20, 20, 25", () => {
    expect([heal(2, [S("snack")]), heal(2, [S("meal")])]).toEqual([15, 25]);
    expect(heal(24, [S("snack")])).toBe(20);
    expect(heal(33, [S("snack")])).toBe(20);
    expect(heal(44, [S("snack")])).toBe(25);
    [2, 24, 33, 44].forEach(covers);
  });

  it("Jerky Gator, Twisty, The Fountain King, Lasagna Lich: more the next day", () => {
    const next = (level: number, s: SplurgeEv) => {
      const hit = A(Math.floor(levelInfo(level).hp * 0.4), { time: "06:00" });
      return fight(level, { splurges: [s], activities: [hit], today: day(1) }).hp - fight(level, { splurges: [s], activities: [hit], today: D }).hp;
    };
    expect([heal(3, [S("snack")]), next(3, S("snack"))]).toEqual([10, 5]);
    expect([heal(4, [S("meal")]), next(4, S("meal"))]).toEqual([25, 10]);
    expect([heal(40, [S("snack")]), next(40, S("snack"))]).toEqual([10, 10]);
    expect([heal(57, [S("feast")]), next(57, S("feast"))]).toEqual([60, 30]);
    expect(next(3, S("snack", { planned: true }))).toBe(3); // a planned treat's extra is half too
    expect(next(3, S("meal"))).toBe(0);
    [3, 4, 40, 57].forEach(covers);
  });

  it("Gummo: regains 20 once, at half HP", () => {
    expect(dmg(5, [A(80)])).toBe(60);
    expect(dmg(5, [A(80), A(40, { time: "09:00" })])).toBe(100); // once only
    expect(fight(5, { activities: [A(160)] }).ko).not.toBeNull(); // straight to 0 is a KO
    covers(5);
  });

  it("Puffball: below half HP, Snacks heal 20", () => {
    expect(heal(6, [S("snack")])).toBe(10);
    expect(heal(6, [S("snack")], { hit: 100 })).toBe(20);
    covers(6);
  });

  it("Popcorn Puff: Snacks on the same day heal 10, 20, 30", () => {
    expect(heal(7, [S("snack"), S("snack"), S("snack")])).toBe(60);
    expect(heal(7, [S("snack"), S("meal"), S("snack"), S("snack"), S("snack")], { hit: 150 })).toBe(10 + 25 + 20 + 30 + 30);
    covers(7);
  });

  it("Sour Worm, Gravy Golem, Garlic Bread Gargoyle: no comeback ×2", () => {
    for (const level of [8, 53, 54]) { expect(dmg(level, [A(30)], { warm: false })).toBe(30); covers(level); }
  });

  it("Corny: the 3rd Snack in a day heals 30", () => {
    expect(heal(9, [S("snack"), S("snack"), S("snack")])).toBe(50);
    expect(heal(9, [S("snack"), S("snack"), S("snack"), S("snack")])).toBe(60);
    covers(9);
  });

  it("Sir Soda: the first 15 minutes each day do half damage", () => {
    expect(dmg(10, [A(30)])).toBe(23);
    expect(dmg(10, [A(30), A(20, { time: "09:00" })])).toBe(43);
    expect(dmg(10, [A(10), A(10, { time: "09:00" })])).toBe(5 + 8);
    covers(10);
  });

  it("Fry Hydra, Baron Fryer, Crust Colossus, Wrapped Up, Sergeant Supersize, Pickle Prickle: their own heal sizes", () => {
    expect(heal(11, [S("meal")])).toBe(35);
    expect(heal(20, [S("feast")])).toBe(90);
    expect(heal(49, [S("feast")])).toBe(80);
    expect(heal(45, [S("meal")])).toBe(40);
    expect(heal(50, [S("meal")])).toBe(60);
    expect([heal(13, [S("snack")]), heal(13, [S("meal")]), heal(13, [S("feast")])]).toEqual([5, 40, 60]);
    [11, 20, 49, 45, 50, 13].forEach(covers);
  });

  it("Slider Trio: the first knockout leaves it at 30 HP", () => {
    const once = fight(12, { activities: [A(300)] });
    expect([once.hp, once.ko]).toEqual([30, null]);
    expect(once.lines.some((l) => l.kind === "revive")).toBe(true);
    expect(fight(12, { activities: [A(300), A(30, { time: "09:00" })] }).ko).toMatchObject({ day: D, by: "workout" });
    covers(12);
  });

  it("Queso Kraken: clean-day crits do 15", () => {
    expect(fight(14, { today: day(1) }).hp).toBe(285);
    covers(14);
  });

  it("Bacon Bandit: no power-ups work in this fight", () => {
    expect(fight(15, { potions: [{ id: "p", day: D, time: "10:00", at: `${D}T10:00:00.000Z` }] }).hp).toBe(310);
    expect(fight(15, { splurges: [S("snack")], activities: [A(50, { time: "06:00" })], shieldFrom: "start" }).heals).toBe(10);
    const st = run(D, { level: 15 }); st.run.potions = 2;
    expect(() => usePowerUp(st, logOf(), clock(D), "potion")).toThrow(/Stick 'Em Up/);
    expect(buildView(st, logOf(), D, false).fight?.powerUpsAllowed).toBe(false);
    covers(15);
  });

  it("Ringleader: weekend splurges heal 15 extra", () => {
    const sat = "2026-11-14";
    expect(heal(16, [S("snack", { day: sat })], { startedOn: sat })).toBe(25);
    expect(heal(16, [S("snack")])).toBe(10);
    covers(16);
  });

  it("Tot Rock: the first 10 damage of every workout bounces off", () => {
    expect(dmg(17, [A(30), A(5, { time: "09:00" })])).toBe(20);
    covers(17);
  });

  it("Long Frank: one extra day", () => {
    expect(deadlineFor(18, D, false)).toBe(day(4));
    expect(deadlineFor(17, D, false)).toBe(day(3));
    covers(18);
  });

  it("Ketchup Coyote: +10 each day with no workout by 6 PM", () => {
    expect(dmg(19, [A(30, { time: "19:00" })], { today: day(1) })).toBe(30 + 25 - 10);
    expect(dmg(19, [A(30, { time: "17:00" })], { today: day(1) })).toBe(30 + 25);
    expect(dmg(19, [A(30, { time: "" })], { today: day(1) })).toBe(30 + 25 - 10); // no time: assume the worst
    covers(19);
  });

  it("Brain Freeze: the first workout each day does 10 less", () => {
    expect(dmg(21, [A(30), A(30, { time: "09:00" })])).toBe(50);
    covers(21);
  });

  it("Swirlpop: hits under 30 do half", () => {
    expect([dmg(22, [A(20)]), dmg(22, [A(29)]), dmg(22, [A(40)])]).toEqual([10, 15, 40]);
    covers(22);
  });

  it("Candy Cane Crab: calories count half until it drops below half HP", () => {
    expect(dmg(23, [A(30, { calories: 400 })])).toBe(50);
    expect(dmg(23, [A(300, { time: "07:00" }), A(30, { calories: 400, time: "09:00" })])).toBe(300 + 70);
    covers(23);
  });

  it("Taffy Stretch: damage past 60 in one workout counts half", () => {
    expect([dmg(25, [A(100)]), dmg(25, [A(60)])]).toEqual([80, 60]);
    covers(25);
  });

  it("Fluffnado: a Feast blows away your next clean-day crit", () => {
    expect(fight(26, { splurges: [S("feast")], today: day(2) }).hp).toBe(480);
    // (a splurge at full HP is bonus HP: the snack's 10 and the feast's 60 soak up crit damage first)
    expect(fight(26, { splurges: [S("snack")], today: day(2) }).hp).toBe(480 - 15);
    expect(fight(26, { splurges: [S("feast")], today: day(3) })).toMatchObject({ hp: 480, bonus: 60 - 25 }); // only the next one
    covers(26);
  });

  it("Choco Bunny: at half HP, its next 3 heals are doubled", () => {
    expect(heal(27, [S("snack"), S("snack"), S("snack"), S("snack")], { hit: 250 })).toBe(70);
    expect(heal(27, [S("snack")], { hit: 100 })).toBe(10);
    covers(27);
  });

  it("Shake Ooze: +5 every day without a workout", () => {
    expect(fight(28, { today: day(1) }).hp).toBe(500 - 25 + 5);
    expect(fight(28, { today: day(1), activities: [A(null)] }).hp).toBe(475);
    covers(28);
  });

  it("Marshmallow Mammoth: a clean day only crits if you also worked out", () => {
    expect(fight(29, { today: day(1) }).hp).toBe(520);
    expect(dmg(29, [A(10)], { today: day(1) })).toBe(35);
    covers(29);
  });

  it("Queen Frosting and Buffet Beast: every splurge heals 10 / 25 extra", () => {
    expect([heal(30, [S("snack")]), heal(30, [S("feast")])]).toEqual([20, 70]);
    expect(heal(55, [S("snack")])).toBe(35);
    [30, 55].forEach(covers);
  });

  it("Jolt: the first splurge each day heals double", () => {
    expect(heal(31, [S("snack"), S("snack")])).toBe(30);
    covers(31);
  });

  it("Fizz Frog: on the deadline's last day, every heal is doubled", () => {
    expect(heal(32, [S("snack")], { deadlineOn: D })).toBe(20);
    expect(heal(32, [S("snack")])).toBe(10);
    covers(32);
  });

  it("Sour Squeeze: planned treats heal in full", () => {
    expect(heal(34, [S("meal", { planned: true })])).toBe(25);
    expect(fight(34, { splurges: [S("meal", { planned: true })], activities: [A(100, { time: "06:00" })] }).lines.at(-1)?.text).toMatch(/in full/);
    covers(34);
  });

  it("Slush: after a day with no workout, the next workout counts minutes only", () => {
    expect(dmg(35, [A(30, { calories: 300 })], { warm: false })).toBe(60); // minutes only, still ×2
    expect(dmg(35, [A(30, { calories: 300 })])).toBe(60);
    covers(35);
  });

  it("Cocoa Croc: after a Meal, the next Snack heals 25", () => {
    expect(heal(36, [S("meal"), S("snack"), S("snack")])).toBe(25 + 25 + 10);
    expect(heal(36, [S("snack")])).toBe(10);
    covers(36);
  });

  it("Frappe Phantom: workouts after 8 PM do half (no time counts as after)", () => {
    expect([dmg(37, [A(30, { time: "21:00" })]), dmg(37, [A(30, { time: "10:00" })]), dmg(37, [A(30, { time: "" })])]).toEqual([15, 30, 15]);
    covers(37);
  });

  it("Float Bear: can't be finished on a day you splurge — it stays at 1 HP", () => {
    const r = fight(38, { splurges: [S("snack", { time: "06:00" })], activities: [A(700)] });
    expect([r.hp, r.ko]).toEqual([1, null]);
    expect(fight(38, { splurges: [S("snack", { time: "06:00" })], activities: [A(700), A(10, { day: day(1) })], today: day(1) }).ko).toMatchObject({ day: day(1) });
    expect(fight(38, { activities: [A(700)] }).ko).not.toBeNull();
    covers(38);
  });

  it("Boxer: a day's second splurge heals double", () => {
    expect(heal(39, [S("snack"), S("snack"), S("snack")])).toBe(10 + 20 + 10);
    covers(39);
  });

  it("Nugget Ninja: workouts under 15 min do 0; Taco Titan: under 20 min do half", () => {
    expect([dmg(41, [A(10)]), dmg(41, [A(15)])]).toEqual([0, 15]);
    expect([dmg(43, [A(10)]), dmg(43, [A(20)])]).toEqual([5, 20]);
    [41, 43].forEach(covers);
  });

  it("Hash Hound: splurges before 11 AM heal double (no time counts as before)", () => {
    expect([heal(42, [S("snack", { time: "09:00" })]), heal(42, [S("snack", { time: "14:00" })]), heal(42, [S("snack")])]).toEqual([20, 10, 20]);
    covers(42);
  });

  it("Pancake Bot: once, at a quarter of its HP, it regains 60", () => {
    expect(dmg(46, [A(600)])).toBe(540);
    covers(46);
  });

  it("Wingfire: the first time it hits 0, it rises again with 60 HP", () => {
    expect(fight(47, { activities: [A(800)] }).hp).toBe(60);
    covers(47);
  });

  it("Corn Dog Cyclops: only the day's biggest workout hits in full", () => {
    expect(dmg(48, [A(20), A(60, { time: "09:00" })])).toBe(10 + 60);
    expect(dmg(48, [A(60), A(20, { day: day(1) })], { today: day(1), splurges: [S("snack")] })).toBe(60 - 10 + 20); // a new day, a new biggest
    covers(48);
  });

  it("Noodle Noggin: on a day with no workout, every splurge heals 15 extra", () => {
    expect(fight(51, { today: day(1), splurges: [S("snack", { day: day(1) })] }).hp).toBe(850);
    expect(fight(51, { today: day(1), splurges: [S("snack", { day: day(1) })], activities: [A(null, { day: day(1) })] }).hp).toBe(835);
    covers(51);
  });

  it("Meatball Minotaur: if you splurged yesterday, every splurge today heals double", () => {
    expect(heal(52, [S("snack", { day: day(-1) }), S("snack")])).toBe(20);
    expect(heal(52, [S("snack")])).toBe(10);
    covers(52);
  });

  it("Fondue Fiend: a splurge within 3 hours of another heals double (no time counts as within)", () => {
    expect(heal(56, [S("snack", { time: "12:00" }), S("snack", { time: "14:00" })])).toBe(40);
    expect(heal(56, [S("snack", { time: "12:00" }), S("snack", { time: "18:00" })])).toBe(20);
    expect(heal(56, [S("snack", { time: "12:00" }), S("snack")])).toBe(40);
    expect(heal(56, [S("snack")])).toBe(10);
    covers(56);
  });

  it("Turkey Leg Troll: the first 20 damage each day does nothing", () => {
    expect(dmg(58, [A(15), A(30, { time: "09:00" })])).toBe(25);
    covers(58);
  });

  it("Cheesecake Knight: after each splurge, the next workout does 15 less", () => {
    expect(fight(59, { activities: [A(30, { time: "10:00" }), A(30, { time: "11:00" })], splurges: [S("snack", { time: "09:00" })] }).damage).toBe(15 + 30);
    covers(59);
  });

  it("The Midnight Snacker: splurges after 9 PM heal double (no time counts as after)", () => {
    expect([heal(60, [S("snack", { time: "22:00" })]), heal(60, [S("snack", { time: "20:00" })]), heal(60, [S("snack")])]).toEqual([20, 10, 20]);
    covers(60);
  });
});

describe("a run: settling, hearts, power-ups", () => {
  it("KO → the next fight at once, the same day, counting only what was logged after the knockout", () => {
    const st = run();
    const ko = A(120, { time: "07:00", createdAt: `${D}T07:05:00.000Z` });
    const later = A(30, { time: "18:00", createdAt: `${D}T18:05:00.000Z` });
    const out = settle(st, logOf([], [A(null, { day: day(-1) }), ko, later]), clock(D));
    const [f1, f2] = out.state.fights;
    expect(f1).toMatchObject({ status: "won", endedOn: D, damage: 120, flawless: true, points: 120 + 100 + 100 + 100 });
    expect(f2).toMatchObject({ level: 2, status: "open", startedOn: D, startedAfter: `${D}T07:05:00.000Z`, deadlineOn: day(3), bet: 1, attempt: 1 });
    expect(buildView(out.state, logOf([], [A(null, { day: day(-1) }), ko, later]), D, false).fight).toMatchObject({ name: "Chiplet", hp: 90 });
    expect(kinds(out)).toEqual(["powerup_earned", "ko"]); // a 2-hour walk earns a Water Potion
    expect(out.state.run.potions).toBe(1);
    expect(out.state.run.score).toBe(420);
    // settling again changes nothing
    expect(settle(out.state, logOf([], [A(null, { day: day(-1) }), ko, later]), clock(D)).added).toEqual([]);
  });

  it("a KO by a clean-day crit lands at midnight: the next fight starts the next morning", () => {
    const st = run();
    const out = settle(st, logOf([], [A(null, { day: day(-1) }), A(80, { createdAt: `${D}T09:00:00.000Z` })]), clock(day(1)));
    expect(out.state.fights[0]).toMatchObject({ status: "won", endedOn: D });
    expect(out.state.fights[1]).toMatchObject({ level: 2, startedOn: day(1), startedAfter: null, deadlineOn: day(3) });
  });

  it("strike → a heart lost and a rematch of the same level, the day after the deadline", () => {
    const st = run();
    const out = settle(st, logOf([S("snack", { day: D }), S("snack", { day: day(1) }), S("snack", { day: day(2) })]), clock(day(3)));
    const [f1, f2] = out.state.fights;
    expect(f1).toMatchObject({ status: "struck", endedOn: day(2), points: 0 });
    expect(f2).toMatchObject({ level: 1, attempt: 2, startedOn: day(3), deadlineOn: day(5), status: "open" });
    expect(out.state.run.hearts).toBe(2);
    expect(kinds(out)).toEqual(["strike"]);
    // a long time away settles every missed deadline in a loop
    const away = settle(st, logOf(), clock(day(9)));
    // three clean days of crits (75) are not enough for Crumbs: three strikes, then a knock-back to level 1
    expect(away.state.fights.map((f) => [f.level, f.status, f.startedOn])).toEqual([[1, "struck", D], [1, "struck", day(3)], [1, "struck", day(6)], [1, "open", day(9)]]);
    expect(away.state.run).toMatchObject({ hearts: 3, knockbacks: 1 });
  });

  it("at 0 hearts: Normal is knocked back to the world's first level (−250, 3 hearts); Hardcore is defeated", () => {
    const busy = logOf([0, 1, 2, 3].map((i) => S("snack", { day: day(i) })), [A(null, { day: day(-1) }), A(50)]);
    const normal = settle(run(D, { level: 13, hearts: 1 }), busy, clock(day(4)));
    expect(normal.state.fights[0]).toMatchObject({ status: "struck", points: 50 });
    expect(normal.state.fights[1]).toMatchObject({ level: 11, status: "open", startedOn: day(4) });
    expect(normal.state.run).toMatchObject({ hearts: 3, knockbacks: 1, score: 50 - 250, endReason: null });
    expect(kinds(normal)).toEqual(["strike", "knockback"]);
    const hard = settle(run(D, { level: 13, hearts: 1, mode: "hardcore" }), busy, clock(day(4)));
    expect(hard.state.run).toMatchObject({ hearts: 0, endReason: "defeated", endedOn: day(3), score: 63 });
    expect(kinds(hard)).toEqual(["strike", "defeat"]);
    expect(hard.added[1].data.score).toBe(63);
    expect(settle(hard.state, busy, clock(day(9))).added).toEqual([]); // an ended run stays as it was
  });

  it("a boss kill: +1 heart and a Second Wind; after level 60 the run is finished", () => {
    const boss = settle(run(D, { level: 10, hearts: 2 }), logOf([], [A(null, { day: day(-1) }), A(400)]), clock(D));
    expect(boss.state.run).toMatchObject({ hearts: 3, winds: 1 });
    expect(boss.state.fights[0].points).toBe(393 + 310 + 50 * 3 + 100 + 500); // Fizz Shield takes 7 off the first 15 minutes
    expect(boss.state.fights[1]).toMatchObject({ level: 11 });
    const last = settle(run(D, { level: 60, hearts: 5 }), logOf([], [A(1300)]), clock(D));
    expect(last.state.run).toMatchObject({ endReason: "finished", endedOn: D, hearts: 5 });
    expect(last.added.find((e) => e.kind === "heart")?.data.gained).toBe(false);
    expect(kinds(last)).toContain("finish");
    expect(buildView(last.state, logOf(), D, false).map.every((m) => m.status === "beaten")).toBe(true);
  });

  it("the weekly heart: 5+ active days in a week inside the run give +1 heart when the week ends (max 5)", () => {
    const sun = "2026-11-08";
    const acts = [0, 1, 2, 3, 4].map((i) => A(null, { day: addDays(sun, i) }));
    const spl = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => S("snack", { day: addDays(sun, i) })); // no crits, so Crumbs just waits
    // Crumbs strikes on the 10th and the 13th; the week is not over until the end of the 14th
    expect(settle(run(sun), logOf(spl, acts), clock("2026-11-14")).state.run.hearts).toBe(1);
    const out = settle(run(sun), logOf(spl, acts), clock("2026-11-15"));
    expect(out.added.filter((e) => e.kind === "heart").map((e) => e.data)).toEqual([{ reason: "week", week: sun, activeDays: 5, gained: true }]);
    expect(out.state.run.hearts).toBe(2);
    // with Monday weeks, the same five days fall in two weeks: no heart
    expect(settle(run(sun), logOf(spl, acts, { weekStart: 1 }), clock("2026-11-17")).added.some((e) => e.kind === "heart")).toBe(false);
    const full = run(sun, { hearts: 5, level: 60 });
    const atMax = settle(full, logOf(spl, acts), clock("2026-11-15"));
    expect(atMax.added.find((e) => e.kind === "heart")?.data.gained).toBe(false);
  });

  it("power-ups earned: a Veggie Shield for each 3 clean days in a row, a Water Potion for a 60-minute workout, never more than 3", () => {
    const st = run(D, { level: 60 });
    const out = settle(st, logOf([S("snack", { day: day(3) })]), clock(day(8)));
    // D, D+1, D+2 clean → a shield; D+3 splurged; D+4, D+5, D+6 → another; D+7 is the start of the next streak
    expect(out.added.filter((e) => e.kind === "powerup_earned").map((e) => e.day)).toEqual([day(2), day(6)]);
    expect(out.state.run.shields).toBe(2);
    expect(settle(out.state, logOf([S("snack", { day: day(3) })]), clock(day(8))).added).toEqual([]);
    const potions = settle(run(D, { level: 60 }), logOf([], [A(60), A(59, { time: "09:00" }), A(90, { time: "10:00" }), A(60, { time: "11:00" }), A(61, { time: "12:00" })]), clock(D));
    expect(potions.state.run.potions).toBe(3);
    expect(potions.added.filter((e) => e.kind === "powerup_earned").map((e) => e.data.gained)).toEqual([true, true, true, false]);
  });

  it("power-ups used: a Water Potion hits for 50, a Second Wind adds a day, and each needs one in hand", () => {
    const st = run(D, { level: 60 });
    st.run.potions = 1; st.run.winds = 1;
    expect(() => usePowerUp(st, logOf(), clock(D), "shield")).toThrow(GameRuleError);
    const p = usePowerUp(st, logOf(), clock(D, "10:00"), "potion");
    expect(p.state.run.potions).toBe(0);
    expect(buildView(p.state, logOf(), D, false).fight?.hp).toBe(1230);
    const w = usePowerUp(p.state, logOf(), clock(D), "wind");
    expect(open(w.state).deadlineOn).toBe(day(8));
    expect(w.state.run.winds).toBe(0);
    expect(() => usePowerUp(w.state, logOf(), clock(D), "potion")).toThrow(/no Water Potion/);
    // a potion can land the knockout: the next fight begins after it
    const crumbs = run(); crumbs.run.potions = 1;
    const k = usePowerUp(crumbs, logOf([], [A(null, { day: day(-1) }), A(50)]), clock(D, "12:00", `${D}T12:00:00.000Z`), "potion");
    expect(k.state.fights[0].status).toBe("won");
    expect(k.state.fights[1]).toMatchObject({ level: 2, startedAfter: `${D}T12:00:00.000Z` });
  });

  it("a Veggie Shield blocks the next heal after it goes up, once, and stays used up", () => {
    const st = run(D, { level: 60 });
    st.run.shields = 1;
    const up = usePowerUp(st, logOf(), clock(D, "10:00", `${D}T10:00:00.000Z`), "shield");
    expect(up.state.run).toMatchObject({ shields: 0, shieldArmed: true });
    expect(() => usePowerUp({ ...up.state, run: { ...up.state.run, shields: 1 } }, logOf(), clock(D), "shield")).toThrow(/already up/);
    const log = logOf([S("snack", { time: "09:00" }), S("feast", { time: "12:00", what: "Pizza" }), S("meal", { time: "13:00" })], [A(null, { day: day(-1) }), A(200, { time: "08:00" })]);
    const out = settle(up.state, log, clock(D));
    expect(out.state.run.shieldArmed).toBe(false);
    expect(out.added.filter((e) => e.kind === "powerup_used").map((e) => e.data)).toEqual([{ kind: "shield", action: "block", healId: log.splurges[1].id, amount: 60 }]);
    const v = buildView(out.state, log, D, false).fight!;
    expect(v.hp).toBe(1280 - 200 + 10 + 25); // the 09:00 snack (before the shield) and the 13:00 meal heal; the pizza is blocked
    expect(v.lines.find((l) => l.kind === "blocked")?.text).toMatch(/Pizza/);
    expect(settle(out.state, log, clock(D)).added).toEqual([]);
    // a shield still up when a new fight starts blocks that fight's first heal
    const carried = run(D, { level: 60 }); carried.run.shieldArmed = true;
    expect(simulateFight(fightOf(carried, log)).heals).toBe(60 + 25); // the snack at 09:00 is blocked instead
  });

  it("the bet: Bold or Daredevil shortens the deadline, multiplies the points, and locks at the first attack or the end of the start day", () => {
    const st = run();
    const dare = setBet(st, logOf(), clock(D), 2);
    expect(open(dare)).toMatchObject({ bet: 2, deadlineOn: D });
    expect(open(setBet(dare, logOf(), clock(D), 1.5))).toMatchObject({ bet: 1.5, deadlineOn: day(1) });
    expect(buildView(st, logOf(), D, false).fight?.betOptions.map((o) => [o.label, o.deadlineOn])).toEqual([["Steady", day(2)], ["Bold", day(1)], ["Daredevil", D]]);
    expect(() => setBet(st, logOf([], [A(10)]), clock(D), 2)).toThrow(/locked/);
    expect(() => setBet(st, logOf(), clock(day(1)), 2)).toThrow(/locked/);
    expect(buildView(st, logOf([], [A(10)]), D, false).fight).toMatchObject({ betLocked: true, betOptions: [] });
    const won = settle(dare, logOf([], [A(null, { day: day(-1) }), A(100)]), clock(D));
    expect(won.state.fights[0].points).toBe((100 + 100 + 0 + 100) * 2);
  });
});

describe("Stage 4 review fixes", () => {
  const warm = A(null, { day: day(-1), time: "07:00" });
  /** which fight each activity counted for (level → ids), after settling */
  const usedBy = (st: RunState, log: GameLog) => Object.fromEntries(st.fights.map((f) => {
    const r = simulateFight(fightInputFor(st, f, log, f.status === "open" ? D : f.endedOn!));
    return [f.level, r.counted.map((a) => a.id).filter((id) => id !== warm.id)];
  }));

  it("example A: an untimed Walk made at 09:00 KOs Crumbs; a Run timed 08:00 made at 10:00 counts for one fight, not both", () => {
    const walk = A(100, { id: "walk", time: "", createdAt: `${D}T09:00:00.000Z` });
    const run8 = A(30, { id: "run", time: "08:00", createdAt: `${D}T10:00:00.000Z` });
    // both there at one sync: the fight reads the Run (08:00) first, then the Walk KOs
    const log = logOf([], [warm, walk, run8]);
    const out = settle(run(), log, clock(D));
    expect(out.state.fights[0].status).toBe("won");
    expect(usedBy(out.state, log)).toEqual({ 1: ["run", "walk"], 2: [] });
    // synced after the Walk, then the Run is logged: Crumbs is frozen, so the Run hits Chiplet
    const early = settle(run(), logOf([], [warm, walk]), clock(D));
    expect(early.added.find((e) => e.kind === "ko")?.data.used).toEqual(["walk"]);
    expect(usedBy(early.state, log)[2]).toEqual(["run"]);
    expect(buildView(early.state, log, D, false).fight).toMatchObject({ name: "Chiplet", hp: 120 - 30 });
  });

  it("example B: a 12:00 Bike made at 12:30 still counts when a 07:30 Run made at 20:00 KOs alone", () => {
    const bike = A(20, { id: "bike", time: "12:00", createdAt: `${D}T12:30:00.000Z` });
    const run7 = A(120, { id: "run", time: "07:30", createdAt: `${D}T20:00:00.000Z` });
    const log = logOf([], [warm, bike, run7]);
    const out = settle(run(), log, clock(D));
    expect(out.state.fights[1]).toMatchObject({ level: 2, startedAfter: `${D}T20:00:00.000Z` });
    expect(out.added.find((e) => e.kind === "ko")?.data.used).toEqual(["run"]);
    expect(usedBy(out.state, log)).toEqual({ 1: ["run"], 2: ["bike"] });
    expect(buildView(out.state, log, D, false).fight?.hp).toBe(120 - 20);
  });

  it("two big workouts on one day KO two monsters, not a chain: what one fight used stays used for the rest of the day", () => {
    const big1 = A(240, { id: "big1", time: "", createdAt: `${D}T10:00:00.000Z` });
    const big2 = A(200, { id: "big2", time: "", createdAt: `${D}T11:00:00.000Z` });
    const log = logOf([], [warm, big1, big2]);
    const out = settle(run(), log, clock(D));
    expect(out.state.fights.map((f) => [f.level, f.status])).toEqual([[1, "won"], [2, "won"], [3, "open"]]);
    expect(out.added.filter((e) => e.kind === "ko").map((e) => e.data.used)).toEqual([["big1"], ["big1", "big2"]]);
    expect(buildView(out.state, log, D, false).fight).toMatchObject({ name: levelInfo(3).name, hp: levelInfo(3).hp });
    // and one at a time (a sync between them) ends the same way
    const one = settle(run(), logOf([], [warm, big1]), clock(D));
    expect(settle(one.state, log, clock(D)).state.fights.map((f) => f.status)).toEqual(["won", "won", "open"]);
  });

  it("splurges of the KO day go to one fight too; a potion KO splits the day at the potion; a crit KO gives the next fight the whole next day", () => {
    const hit = A(120, { id: "hit", time: "10:00", createdAt: `${D}T10:00:00.000Z` });
    const before = S("meal", { id: "early", time: "09:00", createdAt: `${D}T21:00:00.000Z` }); // logged late, healed Crumbs (20 bonus HP)
    const after = S("snack", { id: "late", time: "", createdAt: `${D}T08:00:00.000Z` }); // made early, but no time: after the KO
    const log = logOf([before, after], [warm, hit, A(25, { id: "more", time: "11:00" })]);
    const out = settle(run(), log, clock(D));
    expect(out.state.fights[0].status).toBe("won");
    const v = buildView(out.state, log, D, false).fight!;
    expect(v.name).toBe("Chiplet");
    expect(v.lines.map((l) => l.sourceId)).toEqual(["more", "late"]);
    // a potion KO: what sorts before the potion was Crumbs'; what comes after (or is logged later) is the next fight's
    const crumbs = run(); crumbs.run.potions = 1;
    const plog = logOf([], [warm, A(60, { id: "am", time: "08:00" })]);
    const p = usePowerUp(crumbs, plog, clock(D, "12:00", `${D}T12:00:00.000Z`), "potion");
    expect(p.state.fights[0].status).toBe("won");
    expect(p.added.find((e) => e.kind === "ko")?.data.used).toEqual(["am"]);
    const later = logOf([], [...plog.activities, A(15, { id: "pm", time: "18:00", createdAt: `${D}T18:00:00.000Z` })]);
    expect(buildView(p.state, later, D, false).fight?.hp).toBe(120 - 15);
    // a crit KO lands at midnight: no part-day, nothing to split
    const crit = settle(run(), logOf([], [warm, A(80, { createdAt: `${D}T09:00:00.000Z` })]), clock(day(1)));
    expect(crit.added.find((e) => e.kind === "ko")?.data.used).toBeUndefined();
    expect(crit.state.fights[1]).toMatchObject({ startedOn: day(1), startedAfter: null });
  });

  it("a long time away settles in one pass over the days (not one per fight)", () => {
    const t0 = Date.now();
    const out = settle(run(), logOf(), clock(addDays(D, 3650)));
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(out.state.fights.length).toBeGreaterThan(100);
    expect(out.state.fights.filter((f) => f.status === "open")).toHaveLength(1);
    // a Veggie Shield every 3 clean days, capped at 3; the rest are recorded as not given
    expect(out.state.run.shields).toBe(3);
  });

  it("an ended run's log points count only entries up to its last day", () => {
    const busy = logOf([0, 1, 2, 3].map((i) => S("snack", { day: day(i) })), [A(null, { day: day(-1) }), A(50)], { entriesSinceStart: 6, entryDays: [D, D, day(1), day(2), day(3), day(4)] });
    const hard = settle(run(D, { level: 13, hearts: 1, mode: "hardcore" }), busy, clock(day(4)));
    expect(hard.state.run).toMatchObject({ endReason: "defeated", endedOn: day(3), logPoints: 25 });
    expect(hard.state.run.score).toBe(63 + 25);
  });

  it("changing the week start mid-run can't give the same week's heart twice", () => {
    const sun = "2026-11-08";
    const acts = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => A(null, { day: addDays(sun, i) }));
    const spl = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => S("snack", { day: addDays(sun, i) }));
    const st = run(sun, { level: 60 });
    const first = settle(st, logOf(spl, acts), clock("2026-11-15"));
    expect(first.added.filter((e) => e.kind === "heart")).toHaveLength(1);
    // now Monday weeks: Mon 9th–Sun 15th overlaps the Sunday week already paid
    const again = settle(first.state, logOf(spl, acts, { weekStart: 1 }), clock("2026-11-16"));
    expect(again.added.filter((e) => e.kind === "heart")).toEqual([]);
  });

  it("deleting the splurge a Veggie Shield blocked puts the shield back up", () => {
    const st = run(D, { level: 60 });
    st.run.shields = 1;
    const up = usePowerUp(st, logOf(), clock(D, "10:00", `${D}T10:00:00.000Z`), "shield");
    const pizza = S("feast", { id: "pizza", time: "12:00", what: "Pizza" });
    const fries = S("meal", { id: "fries", time: "13:00", what: "Fries" });
    const base = [A(null, { day: day(-1) }), A(200, { time: "08:00" })];
    const blocked = settle(up.state, logOf([pizza], base), clock(D));
    expect(blocked.state.run.shieldArmed).toBe(false);
    // the pizza is deleted: the shield is up again, from where it went up, and blocks the fries
    const gone = settle(blocked.state, logOf([fries], base), clock(D));
    expect(gone.state.run.shieldArmed).toBe(false);
    expect(gone.added.map((e) => e.data.action)).toEqual(["back", "block"]);
    expect(eventText(gone.added[0])).toMatch(/up again/);
    expect(buildView(gone.state, logOf([fries], base), D, false).fight!.heals).toBe(0);
    // with nothing to block, it stays up (for the next fight too)
    const none = settle(blocked.state, logOf([], base), clock(D));
    expect(none.state.run.shieldArmed).toBe(true);
    expect(settle(none.state, logOf([], base), clock(D)).added).toEqual([]);
  });
});

describe("points", () => {
  it("a won fight: damage + max HP + 50 a day left + 100 flawless + 500 boss, × bet, × 1.25 on Hardcore", () => {
    const base = { damage: 260, max: 250, koDay: D, deadlineOn: day(2), flawless: false, boss: false, bet: 1 as const, hardcore: false };
    expect(wonPoints(base)).toBe(610); // Fry Hydra with 2 days left, the worked example
    expect(wonPoints({ ...base, bet: 1.5 })).toBe(915);
    expect(wonPoints({ ...base, bet: 2 })).toBe(1220);
    expect(wonPoints({ ...base, hardcore: true })).toBe(763);
    expect(wonPoints({ ...base, flawless: true, boss: true })).toBe(1210);
    expect(wonPoints({ ...base, koDay: day(2) })).toBe(510);
    expect(struckPoints({ damage: 92, hardcore: false })).toBe(92);
    expect(struckPoints({ damage: 92, hardcore: true })).toBe(115);
    expect(runScore([610, 92], 5 * 10, 1)).toBe(610 + 92 + 50 - 250);
  });

  it("the run's score: settled fights + 5 per log entry made during the run − 250 per knock-back", () => {
    const out = settle(run(), logOf([], [A(null, { day: day(-1) }), A(100)], { entriesSinceStart: 7 }), clock(D));
    expect(out.state.run.logPoints).toBe(35);
    expect(out.state.run.score).toBe(400 + 35);
    const v = buildView(out.state, logOf([], [], { entriesSinceStart: 9 }), D, false);
    expect(v.run?.liveScore).toBe(400 + 45);
  });

  it("Hardcore ×1.25 while still Hardcore; dropping to Normal is one way and stops it from then on", () => {
    const log = logOf([], [A(null, { day: day(-1) }), A(100)]);
    expect(settle(run(D, { mode: "hardcore" }), log, clock(D)).state.fights[0].points).toBe(500);
    const dropped = dropToNormal(run(D, { mode: "hardcore" }), clock(D));
    expect(dropped.state.run).toMatchObject({ mode: "normal", hardcoreDroppedOn: D });
    expect(kinds(dropped)).toEqual(["mode_drop"]);
    expect(settle(dropped.state, log, clock(D)).state.fights[0].points).toBe(400);
    expect(() => dropToNormal(dropped.state, clock(D))).toThrow(/already Normal/);
    expect(() => dropToNormal(abandonRun(run(D, { mode: "hardcore" }), clock(D)), clock(D))).toThrow(/over/);
    expect(buildView(dropped.state, log, D, false).run).toMatchObject({ hardcore: false, mode: "normal" });
  });
});

describe("the view", () => {
  it("shows the open fight, the map and what happened, with no run: everything locked", () => {
    const none = buildView(null, null, D, false);
    expect([none.run, none.fight, none.map.length, none.map[0].status]).toEqual([null, null, 60, "locked"]);
    const log = logOf([], [A(null, { day: day(-1) }), A(100)]);
    const st = settle(run(), log, clock(D)).state;
    const v = buildView(st, log, D, true);
    expect(v.map.slice(0, 3).map((m) => m.status)).toEqual(["beaten", "current", "locked"]);
    expect(v.map[0]).toMatchObject({ attempts: 1, wins: 1, bestPoints: 400 });
    expect(v.fight).toMatchObject({ level: 2, name: "Chiplet", slug: "02-chiplet", world: 1, worldName: "Snack Swamp", daysLeft: 4, ability: { name: "Crunch Flurry" }, finish: { hp: 120, minutes: 120, calories: 1200 } });
    expect(v.events.map((e) => e.kind)).toEqual(["ko", "powerup_earned", "run_start"]);
    expect(v.events[0].text).toBe("Crumbs went down! +400 points.");
    expect(v.needsSync).toBe(true);
  });
});

/** the engine input for a run's open fight */
function fightOf(st: RunState, log: GameLog): FightInput {
  const f = open(st);
  return { level: f.level, startedOn: f.startedOn, startedAfter: f.startedAfter, deadlineOn: f.deadlineOn, today: D, splurges: log.splurges, activities: log.activities, shieldFrom: st.run.shieldArmed ? "start" : null };
}

afterAll(() => {
  const missing = LEVELS.filter((l) => !tested.has(l.ability)).map((l) => l.name);
  if (missing.length) throw new Error(`Abilities with no test: ${missing.join(", ")}`);
});
