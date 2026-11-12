/** Craving Crusher stage 3's pure parts: bios, badges, the map's layout, the result queue and the Victory breakdown, the routes. */
import { describe, expect, it } from "vitest";
import { badgesFor, BIOS, bioFor, LEVELS, wonPoints, type BadgeFight, type EventView, type MapLevel } from "../shared/game/index.js";
import { bandTop, cardBox, mapNode, MAP_START, pathThrough, paths, trailEnd, worldLevels, worldNode, ALL_LEVELS } from "../web/src/game/layout";
import { countUp, planResults, victoryBreakdown } from "../web/src/game/outcomes";
import { parse } from "../web/src/lib/route";

describe("the Monster Book bios", () => {
  it("has one line for every level, named as in levels.ts", () => {
    expect(BIOS).toHaveLength(60);
    for (const l of LEVELS) {
      expect(BIOS[l.level - 1][1]).toBe(l.name);
      expect(bioFor(l.level).length).toBeGreaterThan(10);
    }
    expect(bioFor(11)).toBe("Three heads, one carton, and zero agreement on what to order.");
    expect(() => bioFor(61)).toThrow();
  });
});

describe("the Hall of Heroes badges", () => {
  const F = (o: Partial<BadgeFight>): BadgeFight => ({ run: 1, seq: 1, level: 1, status: "won", bet: 1, flawless: false, endedOn: "2026-11-01", ...o });
  const get = (fs: BadgeFight[], id: string) => badgesFor(fs).find((b) => b.id === id)!;

  it("lists all five, none earned before a fight is won", () => {
    const b = badgesFor([F({ status: "open", endedOn: null })]);
    expect(b.map((x) => x.name)).toEqual(["First Blood", "Flawless", "Daredevil", "World 1 Clear", "Comeback Kid"]);
    expect(b.every((x) => !x.earned && x.earnedOn === null && x.detail === null)).toBe(true);
  });
  it("First Blood is the first win across runs, in run then fight order", () => {
    const b = get([F({ run: 2, seq: 1, level: 1, endedOn: "2026-11-09" }), F({ run: 1, seq: 2, level: 2, endedOn: "2026-11-03" }), F({ run: 1, seq: 1, status: "struck", endedOn: "2026-11-02" })], "first-blood");
    expect(b).toMatchObject({ earned: true, earnedOn: "2026-11-03" });
    expect(b.detail).toContain("Chiplet");
  });
  it("Flawless, Daredevil and World 1 Clear read the won fights only", () => {
    const fs = [F({ seq: 1, flawless: true, status: "struck" }), F({ seq: 2, bet: 2, status: "struck" }), F({ seq: 3, level: 10, status: "open", endedOn: null })];
    expect(get(fs, "flawless").earned).toBe(false);
    expect(get(fs, "daredevil").earned).toBe(false);
    expect(get(fs, "world-1").earned).toBe(false);
    const won = [F({ seq: 1, flawless: true, endedOn: "2026-11-02" }), F({ seq: 2, level: 2, bet: 2, endedOn: "2026-11-04" }), F({ seq: 3, level: 10, endedOn: "2026-11-08" })];
    expect(get(won, "flawless").earnedOn).toBe("2026-11-02");
    expect(get(won, "daredevil").earnedOn).toBe("2026-11-04");
    expect(get(won, "world-1")).toMatchObject({ earned: true, earnedOn: "2026-11-08" });
  });
  it("Comeback Kid needs a win after a strike at the same level in the same run", () => {
    expect(get([F({ seq: 1, level: 5, status: "struck" }), F({ seq: 2, level: 6 })], "comeback").earned).toBe(false);
    expect(get([F({ run: 1, seq: 1, level: 5, status: "struck" }), F({ run: 2, seq: 1, level: 5 })], "comeback").earned).toBe(false);
    const b = get([F({ seq: 1, level: 5, status: "struck" }), F({ seq: 2, level: 5, endedOn: "2026-11-05" })], "comeback");
    expect(b).toMatchObject({ earned: true, earnedOn: "2026-11-05" });
    expect(b.detail).toBe("Gummo took a heart, then got squished (Run #1).");
  });
});

describe("the map's layout", () => {
  it("puts every node where the approved mockup MonMap60 has it", () => {
    // from the mockup: level 1 at (58, 2562), 3 at (332, 2562), 4 at (332, 2468), Sir Soda (10) at (314, 2286),
    // Fry Hydra (11) at (332, 2136), Baron Fryer (20) at (76, 1860), the final boss (60) at (76, 156)
    expect(mapNode(1)).toEqual({ x: 58, y: 2562 });
    expect(mapNode(3)).toEqual({ x: 332, y: 2562 });
    expect(mapNode(4)).toEqual({ x: 332, y: 2468 });
    expect(mapNode(7)).toEqual({ x: 58, y: 2374 });
    expect(mapNode(10)).toEqual({ x: 314, y: 2286 });
    expect(mapNode(11)).toEqual({ x: 332, y: 2136 });
    expect(mapNode(13)).toEqual({ x: 58, y: 2136 });
    expect(mapNode(20)).toEqual({ x: 76, y: 1860 });
    expect(mapNode(51)).toEqual({ x: 332, y: 432 });
    expect(mapNode(60)).toEqual({ x: 76, y: 156 });
    expect(bandTop(1)).toBe(2234);
    expect(bandTop(6)).toBe(104);
  });
  it("draws the path the way the mockup does (Catmull-Rom, 1/6 tangents)", () => {
    const d = pathThrough([MAP_START, mapNode(1), mapNode(2), mapNode(3)]);
    expect(d.startsWith("M34 2654 C38 2638.7 31.2 2577.3 58 2562 C84.8 2546.7 149.3 2562 195 2562")).toBe(true);
    expect(pathThrough([])).toBe("");
    expect(pathThrough([{ x: 1, y: 2 }])).toBe("M1 2");
  });
  it("walks the gold trail to the current fight, or the last level beaten", () => {
    const map = (cur: number | null, beaten: number): MapLevel[] => ALL_LEVELS.map((l) => ({ level: l, status: l <= beaten ? "beaten" : l === cur ? "current" : "locked", attempts: 0, wins: 0, bestPoints: 0 }));
    expect(trailEnd(map(11, 10))).toBe(11);
    expect(trailEnd(map(null, 10))).toBe(10);
    expect(trailEnd(map(null, 0))).toBe(0);
    expect(paths(ALL_LEVELS, mapNode, MAP_START, 0).walked).toBe("");
    const p = paths(ALL_LEVELS, mapNode, MAP_START, 11);
    expect(p.walked.endsWith("332 2136")).toBe(true);
    expect(p.full.endsWith("76 156")).toBe(true);
  });
  it("uses the same ten spots on every world page", () => {
    expect(worldLevels(2)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(worldNode(11)).toEqual({ x: 300, y: 1000 });
    expect(worldNode(51)).toEqual(worldNode(11));
    expect(worldNode(20)).toEqual({ x: 196, y: 312 });
  });
  it("opens a node's card inside the screen, below the node near the top and above it lower down", () => {
    expect(cardBox({ x: 332, y: 2136 }, { boss: false, tall: true })).toEqual({ left: 88, top: 2136 - 26 - 14 - 200, width: 290 });
    expect(cardBox({ x: 58, y: 2562 }, { boss: false, tall: false }).left).toBe(12);
    expect(cardBox({ x: 76, y: 156 }, { boss: true, tall: false }).top).toBe(156 + 40 + 22);
  });
});

describe("the result screens", () => {
  let n = 0;
  const E = (kind: EventView["kind"], data: Record<string, unknown> = {}, fightId: string | null = "f1"): EventView =>
    ({ id: `e${++n}`, fightId, day: "2026-11-11", at: "2026-11-11T10:00:00.000Z", kind, data, text: kind });

  it("shows a KO as Victory, with a boss's heart and Second Wind on it rather than in toasts", () => {
    const ko = E("ko", { level: 10 }), heart = E("heart", { reason: "boss" }), wind = E("powerup_earned", { kind: "wind", reason: "boss" });
    const shield = E("powerup_earned", { kind: "shield" }, null);
    const r = planResults([ko, heart, wind, shield]);
    expect(r.results).toEqual([{ kind: "victory", id: ko.id, ko, rewards: [heart, wind] }]);
    expect(r.toasts).toEqual([shield]);
  });
  it("queues several in the order they happened", () => {
    const k1 = E("ko", { level: 1 }, "a"), k2 = E("ko", { level: 2 }, "b"), s = E("strike", { level: 3 }, "c");
    expect(planResults([k1, k2, s]).results.map((x) => x.kind + ":" + x.id)).toEqual([`victory:${k1.id}`, `victory:${k2.id}`, `strike:${s.id}`]);
  });
  it("turns a strike that took the last heart into Knocked back or Defeated", () => {
    const s = E("strike", { level: 13, hearts: 0 }, "x"), kb = E("knockback", { from: 13, to: 11 }, "x");
    expect(planResults([s, kb]).results).toEqual([{ kind: "knockback", id: s.id, strike: s, knockback: kb }]);
    const s2 = E("strike", { level: 4, hearts: 0 }, "y"), d = E("defeat", { level: 4 }, "y");
    expect(planResults([s2, d]).results).toEqual([{ kind: "defeat", id: s2.id, strike: s2, defeat: d }]);
  });
  it("makes level 60's KO the finish, and drops the kinds nobody needs told", () => {
    const ko = E("ko", { level: 60 }, "z"), fin = E("finish", {}, "z");
    expect(planResults([ko, fin, E("run_start"), E("powerup_used", { kind: "shield" })])).toEqual({ results: [{ kind: "finish", id: ko.id, ko, rewards: [] }], toasts: [] });
    expect(planResults([E("mode_drop")]).toasts).toHaveLength(1);
  });
  it("breaks a Victory's points down to the server's total", () => {
    const base = { level: 11, damage: 295, daysLeft: 2, flawless: false, boss: false };
    const pts = (bet: 1 | 1.5 | 2, hardcore: boolean) => wonPoints({ damage: 295, max: 250, koDay: "2026-11-12", deadlineOn: "2026-11-14", flawless: false, boss: false, bet, hardcore });
    const plain = victoryBreakdown(E("ko", { ...base, bet: 1, points: pts(1, false) }));
    expect(plain.total).toBe(645);
    expect(plain.rows.map((r) => [r.label, r.value])).toEqual([["Damage dealt", "295"], ["Kill", "+250"], ["Speed bonus", "+100"]]);
    const bold = victoryBreakdown(E("ko", { ...base, bet: 1.5, points: pts(1.5, true) }));
    expect(bold.rows.slice(-2).map((r) => r.value)).toEqual(["×1.5", "×1.25"]);
    const boss = victoryBreakdown(E("ko", { level: 10, damage: 310, daysLeft: 0, flawless: true, boss: true, bet: 1, points: 310 + 310 + 100 + 500 }));
    expect(boss.rows.map((r) => r.label)).toEqual(["Damage dealt", "Kill", "Flawless", "Boss kill"]);
  });
  it("counts the score up, eased, and lands on it", () => {
    expect(countUp(600, 0)).toBe(0);
    expect(countUp(600, 600)).toBeGreaterThan(300);
    expect(countUp(600, 1200)).toBe(600);
    expect(countUp(600, 5000)).toBe(600);
  });
});

describe("the game's routes", () => {
  it("knows the map, a world, the book, the hall and how to crush", () => {
    expect(parse("#/game/map")).toEqual({ page: "game", screen: "map" });
    expect(parse("#/game/world/2")).toEqual({ page: "game", screen: "world", world: 2 });
    expect(parse("#/game/world/9")).toEqual({ page: "game", screen: "world", world: undefined });
    expect(parse("#/game/book")).toEqual({ page: "game", screen: "book" });
    expect(parse("#/game/hall")).toEqual({ page: "game", screen: "hall" });
    // only the game's own screens: names every object has are not screens
    expect(parse("#/game/toString")).toEqual({ page: "game", screen: "title" });
    expect(parse("#/game/constructor")).toEqual({ page: "game", screen: "title" });
    expect(parse("#/game/how")).toEqual({ page: "game", screen: "how" });
    expect(parse("#/game/nope")).toEqual({ page: "game", screen: "title" });
  });
});
