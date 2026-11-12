/**
 * Craving Crusher's 60 levels: 6 worlds of 10, each level its own monster, the boss at level 10 of
 * each world. The numbers are `Docs/game/levels60.json` (test/game.test.ts checks they match):
 * HP = 100 + 15 x (level - 1) rounded to 10, a boss x 1.3; deadline days 3, 4, 5, 5, 6, 7 by world,
 * a boss +1. Pure data, no I/O.
 */

export interface Level {
  level: number;
  /** 1 to 6 */
  world: number;
  worldName: string;
  name: string;
  /** the drawing: web/public/monsters/<slug>.svg (from Docs/game/monsters) */
  slug: string;
  hp: number;
  /** the default deadline, in days */
  days: number;
  boss: boolean;
  /** its ability's id in abilities.ts */
  ability: string;
}

export const WORLDS: readonly string[] = ["Snack Swamp", "Burger Badlands", "Sugar Peaks", "Fizzy Falls", "Midnight Drive-Thru", "Feast Fortress"];
export const LEVEL_COUNT = 60;
export const LEVELS_PER_WORLD = 10;

// level, name, hp, days, boss, slug, ability
const TABLE: [number, string, number, number, boolean, string, string][] = [
  [1, "Crumbs", 100, 3, false, "01-crumbs", "none"],
  [2, "Chiplet", 120, 3, false, "02-chiplet", "crunch-flurry"],
  [3, "Jerky Gator", 130, 3, false, "37-jerky-gator", "long-chew"],
  [4, "Twisty", 140, 3, false, "17-twisty", "loop-de-loop"],
  [5, "Gummo", 160, 3, false, "03-gummo", "wobble-back"],
  [6, "Puffball", 180, 3, false, "38-puffball", "puff-up"],
  [7, "Popcorn Puff", 190, 3, false, "18-popcorn-puff", "pop-pop-pop"],
  [8, "Sour Worm", 200, 3, false, "39-sour-worm", "wriggle-free"],
  [9, "Corny", 220, 3, false, "40-corny", "candy-flock"],
  [10, "Sir Soda", 310, 4, true, "04-sir-soda", "fizz-shield"],
  [11, "Fry Hydra", 250, 4, false, "05-fry-hydra", "regrow"],
  [12, "Slider Trio", 260, 4, false, "19-slider-trio", "brother-act"],
  [13, "Pickle Prickle", 280, 4, false, "41-pickle-prickle", "dill-deal"],
  [14, "Queso Kraken", 300, 4, false, "06-queso-kraken", "sticky-cheese"],
  [15, "Bacon Bandit", 310, 4, false, "42-bacon-bandit", "stick-em-up"],
  [16, "Ringleader", 320, 4, false, "20-ringleader", "encore"],
  [17, "Tot Rock", 340, 4, false, "43-tot-rock", "hard-shell"],
  [18, "Long Frank", 360, 4, false, "07-long-frank", "long-haul"],
  [19, "Ketchup Coyote", 370, 4, false, "44-ketchup-coyote", "sundown-howl"],
  [20, "Baron Fryer", 500, 5, true, "08-baron-fryer", "grease-rain"],
  [21, "Brain Freeze", 400, 5, false, "09-brain-freeze", "chill"],
  [22, "Swirlpop", 420, 5, false, "21-swirlpop", "boing-back"],
  [23, "Candy Cane Crab", 430, 5, false, "45-candy-cane-crab", "hard-candy"],
  [24, "Glazewing", 440, 5, false, "10-glazewing", "sugar-rush"],
  [25, "Taffy Stretch", 460, 5, false, "46-taffy-stretch", "stretchy"],
  [26, "Fluffnado", 480, 5, false, "22-fluffnado", "whirlwind"],
  [27, "Choco Bunny", 490, 5, false, "47-choco-bunny", "bitten-ear"],
  [28, "Shake Ooze", 500, 5, false, "11-shake-ooze", "slurp"],
  [29, "Marshmallow Mammoth", 520, 5, false, "48-marshmallow-mammoth", "soft-landing"],
  [30, "Queen Frosting", 700, 6, true, "12-queen-frosting", "sprinkle-storm"],
  [31, "Jolt", 550, 5, false, "23-jolt", "caffeine-rush"],
  [32, "Fizz Frog", 560, 5, false, "49-fizz-frog", "last-leap"],
  [33, "Boba Blob", 580, 5, false, "24-boba-blob", "chewy-pearls"],
  [34, "Sour Squeeze", 600, 5, false, "50-sour-squeeze", "pucker-up"],
  [35, "Slush", 610, 5, false, "25-slush", "ice-grip"],
  [36, "Cocoa Croc", 620, 5, false, "51-cocoa-croc", "second-cup"],
  [37, "Frappe Phantom", 640, 5, false, "26-frappe-phantom", "vanishing-act"],
  [38, "Float Bear", 660, 5, false, "52-float-bear", "last-licks"],
  [39, "Boxer", 670, 5, false, "27-boxer", "one-two"],
  [40, "The Fountain King", 890, 6, true, "28-fountain-king", "free-refills"],
  [41, "Nugget Ninja", 700, 6, false, "29-nugget-ninja", "shadow-dodge"],
  [42, "Hash Hound", 720, 6, false, "53-hash-hound", "breakfast-bark"],
  [43, "Taco Titan", 730, 6, false, "13-taco-titan", "crunch-armor"],
  [44, "Mozz Mantis", 740, 6, false, "54-mozz-mantis", "cheese-pull"],
  [45, "Wrapped Up", 760, 6, false, "30-wrapped-up", "extra-wrap"],
  [46, "Pancake Bot", 780, 6, false, "55-pancake-bot", "reboot"],
  [47, "Wingfire", 790, 6, false, "31-wingfire", "rise-again"],
  [48, "Corn Dog Cyclops", 800, 6, false, "56-corn-dog-cyclops", "tunnel-vision"],
  [49, "Crust Colossus", 820, 6, false, "14-crust-colossus", "extra-cheese"],
  [50, "Sergeant Supersize", 1090, 7, true, "32-sergeant-supersize", "supersize-it"],
  [51, "Noodle Noggin", 850, 7, false, "33-noodle-noggin", "comfort-food"],
  [52, "Meatball Minotaur", 860, 7, false, "57-meatball-minotaur", "stampede"],
  [53, "Gravy Golem", 880, 7, false, "34-gravy-golem", "rock-solid"],
  [54, "Garlic Bread Gargoyle", 900, 7, false, "58-garlic-bread-gargoyle", "stone-skin"],
  [55, "Buffet Beast", 910, 7, false, "15-buffet-beast", "all-you-can-eat"],
  [56, "Fondue Fiend", 920, 7, false, "59-fondue-fiend", "double-dip"],
  [57, "Lasagna Lich", 940, 7, false, "35-lasagna-lich", "leftovers"],
  [58, "Turkey Leg Troll", 960, 7, false, "60-turkey-leg-troll", "bridge-toll"],
  [59, "Cheesecake Knight", 970, 7, false, "36-cheesecake-knight", "shield-up"],
  [60, "The Midnight Snacker", 1280, 8, true, "16-midnight-snacker", "late-night"],
];

export const LEVELS: readonly Level[] = TABLE.map(([level, name, hp, days, boss, slug, ability]) => {
  const world = Math.ceil(level / LEVELS_PER_WORLD);
  return { level, world, worldName: WORLDS[world - 1], name, slug, hp, days, boss, ability };
});

/** One level (1 to 60). */
export function levelInfo(level: number): Level {
  const l = LEVELS[level - 1];
  if (!l) throw new Error(`There is no level ${level}.`);
  return l;
}

/** The first level of the world a level is in (where a Normal run is knocked back to). */
export function firstLevelOfWorld(level: number): number {
  return (Math.ceil(level / LEVELS_PER_WORLD) - 1) * LEVELS_PER_WORLD + 1;
}
