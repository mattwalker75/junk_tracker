/**
 * Where things sit on the adventure map (mockup MonMap60) and on a world up close (MonWorld2): the
 * node positions, the winding path through them (a Catmull-Rom curve, as the mockups draw it), the
 * coloured world bands and where a node's card opens. Pure (tested in test/game3.test.ts).
 */
import { LEVEL_COUNT, LEVELS_PER_WORLD, type MapLevel } from "../../../shared/game";

export interface Pt { x: number; y: number }

// ---------------------------------------------------------------- the 60-level map
export const MAP_W = 390;
export const MAP_H = 2660;
/** each world's band; World 6 at the top also runs up under the HUD */
export const BAND_H = 426;
/** where the path starts, below level 1 */
export const MAP_START: Pt = { x: 34, y: 2654 };
const COLS = [58, 195, 332];

/** The top of a world's band (World 1 is at the bottom). */
export const bandTop = (world: number): number => MAP_H - world * BAND_H;

/** A level's node centre on the map: three rows of three that snake up the band, then the boss. */
export function mapNode(level: number): Pt {
  const w = Math.ceil(level / LEVELS_PER_WORLD);
  const i = (level - 1) % LEVELS_PER_WORLD;
  const top = bandTop(w);
  const odd = w % 2 === 1;
  if (i === 9) return { x: odd ? 314 : 76, y: top + 52 };
  const row = Math.floor(i / 3), col = i % 3;
  // odd worlds start on the left, even ones on the right; each row turns back
  const leftToRight = odd === (row % 2 === 0);
  return { x: COLS[leftToRight ? col : 2 - col], y: top + 328 - 94 * row };
}

// ---------------------------------------------------------------- a world up close
export const WORLD_H = 1100;
export const WORLD_START: Pt = { x: 30, y: 1096 };
const WORLD_NODES: Pt[] = [
  { x: 300, y: 1000 }, { x: 176, y: 958 }, { x: 70, y: 866 }, { x: 178, y: 784 }, { x: 318, y: 728 },
  { x: 236, y: 636 }, { x: 84, y: 584 }, { x: 150, y: 482 }, { x: 300, y: 430 }, { x: 196, y: 312 },
];
/** A level's node centre on its world's page (the same ten spots in every world). */
export const worldNode = (level: number): Pt => WORLD_NODES[(level - 1) % LEVELS_PER_WORLD];

// ---------------------------------------------------------------- the path
const r1 = (n: number) => Math.round(n * 10) / 10;

/** A smooth path through the points (Catmull-Rom with the mockups' 1/6 tangents), as SVG path data. */
export function pathThrough(pts: readonly Pt[]): string {
  if (!pts.length) return "";
  let d = `M${r1(pts[0].x)} ${r1(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(p2.x)} ${r1(p2.y)}`;
  }
  return d;
}

/**
 * How far along the levels the gold trail reaches: to the current fight, or to the last level
 * beaten when no fight is going (0 = nowhere yet).
 */
export function trailEnd(map: readonly MapLevel[]): number {
  const cur = map.find((m) => m.status === "current");
  if (cur) return cur.level;
  let last = 0;
  for (const m of map) if (m.status === "beaten") last = m.level;
  return last;
}

/** The full path and the gold trail walked so far, for the levels given (all 60, or one world's 10). */
export function paths(levels: readonly number[], at: (l: number) => Pt, start: Pt, reached: number): { full: string; walked: string } {
  const pts = [start, ...levels.map(at)];
  const upTo = levels.filter((l) => l <= reached).length;
  return { full: pathThrough(pts), walked: upTo ? pathThrough(pts.slice(0, upTo + 1)) : "" };
}

export const ALL_LEVELS: readonly number[] = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1);
export const worldLevels = (w: number): number[] => Array.from({ length: LEVELS_PER_WORLD }, (_, i) => (w - 1) * LEVELS_PER_WORLD + i + 1);

// ---------------------------------------------------------------- a node's card
/**
 * Where a tapped node's card opens: centred over the node and kept inside the screen; below the
 * node near the top of the page (so the HUD never covers it), above it everywhere else.
 */
export function cardBox(node: Pt, o: { boss: boolean; tall: boolean; width?: number; pageW?: number; below?: number; scale?: number }): { left: number; top: number; width: number } {
  const width = o.width ?? 290, pageW = o.pageW ?? MAP_W, s = o.scale ?? 1;
  const h = o.tall ? 200 : 150;
  const half = (o.boss ? 40 : 26) * s;
  const left = Math.max(12, Math.min(pageW - 12 - width, node.x - width / 2));
  const top = node.y < (o.below ?? 360) ? node.y + half + 22 : node.y - half - 14 - h;
  return { left, top, width };
}

/** The world a level is in (1 to 6). */
export const worldOf = (level: number): number => Math.ceil(level / LEVELS_PER_WORLD);
