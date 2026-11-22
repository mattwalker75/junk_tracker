/**
 * Monster moves (Matt, Nov 22 2026): every one of the 120 monsters has its own mix (idle style, takes a heart,
 * defeated, beats you), every move exists in monster-moves.css, a move that needs a part (a right arm to bonk
 * with) only goes to a monster whose drawing has that part, and the drawings are tagged the way the CSS expects.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEVELS } from "../shared/game/index.js";
import { inlineSvg } from "../web/src/game/inlineSvg";
import { IDLE_STYLES, KO_MOVES, MOVE_NEEDS, MOVES, STRIKE_MOVES, WIN_MOVES } from "../web/src/game/moves";

const root = path.resolve(import.meta.dirname, "..");
const css = fs.readFileSync(path.join(root, "web/src/game/monster-moves.css"), "utf8");
const drawing = (slug: string) => fs.readFileSync(path.join(root, "web/public/monsters", `${slug}.svg`), "utf8");
const PARTS = ["cc-fig", "cc-shadow", "cc-arm-l", "cc-arm-r", "cc-leg-l", "cc-leg-r", "cc-tail", "cc-hat", "cc-head", "cc-orbit"];

describe("every monster's own moves", () => {
  it("covers exactly the game's monsters", () => {
    expect(Object.keys(MOVES).sort()).toEqual(LEVELS.map((l) => l.slug).sort());
  });

  it("gives no two monsters the same mix", () => {
    const mixes = Object.values(MOVES).map((m) => `${m.idle}/${m.strike}/${m.ko}/${m.win}`);
    expect(new Set(mixes).size).toBe(mixes.length);
  });

  it("only uses moves the stylesheet draws", () => {
    for (const s of IDLE_STYLES) if (s !== "walk") expect(css, s).toContain(`.cc-idle[data-idle="${s}"]`);
    for (const m of STRIKE_MOVES) expect(css, m).toContain(`.cc-strike[data-move="${m}"]`);
    for (const m of KO_MOVES) expect(css, m).toContain(`.cc-ko[data-move="${m}"]`);
    for (const m of WIN_MOVES) expect(css, m).toContain(`.cc-win[data-move="${m}"]`);
  });

  it("uses every move somewhere", () => {
    const used = new Set(Object.values(MOVES).flatMap((m) => [m.strike, m.ko, m.win]));
    for (const m of [...STRIKE_MOVES, ...KO_MOVES, ...WIN_MOVES]) expect(used.has(m), m).toBe(true);
  });
});

describe("the drawings are tagged for moving", () => {
  for (const lv of LEVELS) {
    it(`${lv.level} ${lv.name}`, () => {
      const svg = drawing(lv.slug);
      const classes = [...svg.matchAll(/\sclass="([^"]*)"/g)].map((m) => m[1]);
      // a part has exactly one class, from the list the CSS knows
      for (const c of classes) if (c.includes("cc-")) expect(PARTS, `class="${c}"`).toContain(c);
      expect(classes.filter((c) => c === "cc-fig")).toHaveLength(1);
      // every moving part says where it pivots
      for (const m of svg.matchAll(/<[a-z]+\s[^>]*class="(cc-(?:arm|leg)-[lr]|cc-tail|cc-hat|cc-head|cc-orbit)"[^>]*>/g))
        expect(m[0], `${m[1]} needs a pivot`).toMatch(/transform-origin:\s*-?[\d.]+px\s+-?[\d.]+px/);
      // the shadow stays on the floor: it is never inside the moving figure
      const fig = svg.indexOf('class="cc-fig"'), shadow = svg.indexOf('class="cc-shadow"');
      if (shadow >= 0) expect(shadow).toBeLessThan(fig);
      // a move that needs a part only goes to a monster that has it
      const m = MOVES[lv.slug];
      for (const move of [m.idle, m.strike, m.ko, m.win])
        for (const part of MOVE_NEEDS[move] ?? []) expect(classes, `${move} needs ${part}`).toContain(part);
    });
  }
});

describe("putting a drawing inline", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="A monster"><defs><radialGradient id="m-glow"/><clipPath id="m-body"><path d="M0 0"/></clipPath><g id="m-glow-part"/></defs>'
    + '<g class="cc-fig"><path fill="url(#m-glow)" clip-path="url(#m-body)"/><use href="#m-glow-part"/></g></svg>';

  it("gives each copy its own ids, so two on one page don't share gradients or clips", () => {
    const s = inlineSvg(svg, "a1");
    expect(s).toContain('id="m-glow-a1"');
    expect(s).toContain('id="m-glow-part-a1"');
    expect(s).toContain("url(#m-glow-a1)");
    expect(s).toContain("url(#m-body-a1)");
    expect(s).toContain('href="#m-glow-part-a1"');
    expect(s).not.toMatch(/#m-glow"|#m-body\)/);
  });

  it("hides the drawing from screen readers (the wrapper carries the name)", () => {
    const s = inlineSvg(svg, "a1");
    expect(s).toContain('aria-hidden="true"');
    expect(s).not.toContain("aria-label");
    expect(s).not.toContain('role="img"');
  });

  it("adds something worn as a second figure that moves with the body", () => {
    const s = inlineSvg(svg, "a1", '<path d="M4 18"/>');
    expect(s.match(/class="cc-fig"/g)).toHaveLength(2);
    expect(s.endsWith('<g class="cc-fig"><path d="M4 18"/></g></svg>')).toBe(true);
  });
});
