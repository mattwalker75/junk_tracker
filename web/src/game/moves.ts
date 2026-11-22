/**
 * Every monster's own moves (Matt, Nov 22 2026: "Own themed mix" — each monster its own combination, from one
 * shared set of moves tuned to its body). What each move looks like: monster-moves.css. Which parts a drawing has
 * (arms, legs, tail, hat, head, orbit): its SVG in web/public/monsters/. LiveMonster.tsx plays them.
 * Written from the drawings' tagging pass; test/moves.test.ts checks every level has its mix, every move exists,
 * and a move that needs a part (a right arm to bonk with) only goes to a monster that has it.
 */
export type IdleStyle = "walk" | "float" | "flap" | "wobble" | "hop" | "slither";
export type StrikeMove = "bonk" | "lasso" | "jab" | "punch" | "swipe" | "storm" | "spring" | "stomp" | "charge" | "chomp" | "spin" | "slam" | "swoop" | "puff";
export type KoMove = "melt" | "topple" | "dizzy" | "knockout" | "collapse" | "implode" | "pop" | "flatten" | "crumble" | "poof" | "bellyup" | "sink" | "fizzle";
export type WinMove = "eat" | "champ" | "flex" | "drum" | "dance" | "yeehaw" | "curtsy" | "overload" | "laugh" | "twirl" | "bounce" | "hover";
export interface MonsterMoves { idle: IdleStyle; strike: StrikeMove; ko: KoMove; win: WinMove }
/** what a monster on screen is doing: idling, taking a heart, defeated, beating you — or standing still */
export type MonsterAct = "idle" | "strike" | "ko" | "win" | "still";

export const IDLE_STYLES: readonly IdleStyle[] = ["walk", "float", "flap", "wobble", "hop", "slither"];
export const STRIKE_MOVES: readonly StrikeMove[] = ["bonk", "lasso", "jab", "punch", "swipe", "storm", "spring", "stomp", "charge", "chomp", "spin", "slam", "swoop", "puff"];
export const KO_MOVES: readonly KoMove[] = ["melt", "topple", "dizzy", "knockout", "collapse", "implode", "pop", "flatten", "crumble", "poof", "bellyup", "sink", "fizzle"];
export const WIN_MOVES: readonly WinMove[] = ["eat", "champ", "flex", "drum", "dance", "yeehaw", "curtsy", "overload", "laugh", "twirl", "bounce", "hover"];

/** the parts a move needs (it moves nothing else worth seeing without them) */
export const MOVE_NEEDS: Readonly<Partial<Record<IdleStyle | StrikeMove | KoMove | WinMove, readonly string[]>>> = {
  flap: ["cc-arm-l", "cc-arm-r"], bonk: ["cc-arm-r"], lasso: ["cc-arm-r"], jab: ["cc-arm-r"], punch: ["cc-arm-l", "cc-arm-r"],
  swipe: ["cc-arm-l"], storm: ["cc-orbit"], eat: ["cc-arm-r"], champ: ["cc-arm-l", "cc-arm-r"], flex: ["cc-arm-l", "cc-arm-r"],
  drum: ["cc-arm-l", "cc-arm-r"],
};

/** how long a strike plays before the monster idles again (the longest strike move is 1.5 s) */
export const STRIKE_MS = 1600;

export const MOVES: Readonly<Record<string, MonsterMoves>> = {
  /* 1 */ "01-crumbs": { idle: "walk", strike: "charge", ko: "crumble", win: "dance" }, // a cookie gremlin: rushes you, crumbles to crumbs, does a little cookie-jar jig
  /* 2 */ "02-chiplet": { idle: "flap", strike: "swoop", ko: "crumble", win: "hover" }, // a potato-chip bat: flaps, dive-bombs, breaks up like a chip, loops round in triumph
  /* 3 */ "37-jerky-gator": { idle: "walk", strike: "chomp", ko: "flatten", win: "bounce" }, // a jerky alligator: tail wags, big bites, squashed flat as a strip of jerky, happy boings
  /* 4 */ "17-twisty": { idle: "slither", strike: "spin", ko: "dizzy", win: "twirl" }, // a pretzel snake that ties itself in knots: spins at you, spins itself dizzy, twirls round and round
  /* 5 */ "03-gummo": { idle: "hop", strike: "spring", ko: "flatten", win: "bounce" }, // a gummy that bounces back from anything: hops, springs at you, goes splat, boings
  /* 6 */ "38-puffball": { idle: "float", strike: "puff", ko: "pop", win: "bounce" }, // a cheese-puff pufferfish: drifts in its dust cloud, puffs up and blasts, pops like a balloon
  /* 7 */ "18-popcorn-puff": { idle: "hop", strike: "storm", ko: "pop", win: "bounce" }, // a popcorn cloud that never stops popping: hops, fires its popping kernels, pops, boings
  /* 8 */ "39-sour-worm": { idle: "slither", strike: "spring", ko: "sink", win: "twirl" }, // a gummy worm: slithers, springs at you, sinks into the floor, twirls with attitude
  /* 9 */ "40-corny": { idle: "hop", strike: "swoop", ko: "bellyup", win: "laugh" }, // a candy-corn crow: hops like a crow, swoops, falls belly-up legs kicking, caws at its own joke
  /* 10 */ "04-sir-soda": { idle: "walk", strike: "jab", ko: "fizzle", win: "yeehaw" }, // boss: a soda-can knight thrusts his straw lance, goes flat and fizzles out, then hops waving the lance as his lid pops up
  /* 11 */ "05-fry-hydra": { idle: "walk", strike: "chomp", ko: "topple", win: "laugh" }, // three hungry heads bite twice, the carton tips over with heads flung up, all three heads cackle
  /* 12 */ "19-slider-trio": { idle: "walk", strike: "spring", ko: "topple", win: "champ" }, // three burger acrobats: spring at you as one, the stack topples, a ta-da with arms up
  /* 13 */ "41-pickle-prickle": { idle: "walk", strike: "spin", ko: "topple", win: "laugh" }, // a cactus: a spinning prickly hug, tips over like a felled cactus, shakes laughing with its arms up
  /* 14 */ "06-queso-kraken": { idle: "wobble", strike: "swipe", ko: "melt", win: "drum" }, // a gooey cheese octopus: jelly sway, a tentacle swipe, melts into a queso puddle, drums its tentacles
  /* 15 */ "42-bacon-bandit": { idle: "walk", strike: "lasso", ko: "dizzy", win: "laugh" }, // an outlaw with a rope: lassos you, spins out and loses its hat, a cowboy whoop (win changed to laugh so no two monsters share a mix)
  /* 16 */ "20-ringleader": { idle: "walk", strike: "lasso", ko: "knockout", win: "yeehaw" }, // an onion-ring ringmaster: cracks the whip of rings, a showman's fall, hops with whip twirling and hat high
  /* 17 */ "43-tot-rock": { idle: "walk", strike: "slam", ko: "crumble", win: "drum" }, // a boulder golem: body-slams, falls to pieces like rock, beats its chest
  /* 18 */ "07-long-frank": { idle: "slither", strike: "spring", ko: "knockout", win: "laugh" }, // a hot-dog serpent: slithers, springs at you, flops out flat, throws its head back laughing
  /* 19 */ "44-ketchup-coyote": { idle: "walk", strike: "puff", ko: "knockout", win: "yeehaw" }, // a ketchup bottle: squirts you, goes down flat, hops howling with its cap up
  /* 20 */ "08-baron-fryer": { idle: "walk", strike: "swipe", ko: "dizzy", win: "curtsy" }, // boss: the baron swings his cane, spins dizzy as his top hat flies off, a grand twirl and a gentleman's bow
  /* 21 */ "09-brain-freeze": { idle: "walk", strike: "slam", ko: "melt", win: "dance" }, // an ice-cream yeti: a freezing body-slam hug, melts down its cone, a furry victory dance
  /* 22 */ "21-swirlpop": { idle: "hop", strike: "spring", ko: "dizzy", win: "bounce" }, // a lollipop on a spring: bounces all day, springs at you, spins dizzy like its own swirl
  /* 23 */ "45-candy-cane-crab": { idle: "walk", strike: "swipe", ko: "bellyup", win: "dance" }, // a crab: swipes with a claw, flips onto its back legs kicking, a sideways crab dance
  /* 24 */ "10-glazewing": { idle: "flap", strike: "puff", ko: "bellyup", win: "laugh" }, // a donut dragon: flaps, breathes a sugar puff, falls belly-up, its head rocks back laughing
  /* 25 */ "46-taffy-stretch": { idle: "wobble", strike: "punch", ko: "collapse", win: "bounce" }, // stretchy taffy: wobbles, shoots out both arms, slumps apart with its tip flying, boings
  /* 26 */ "22-fluffnado": { idle: "float", strike: "spin", ko: "poof", win: "twirl" }, // a cotton-candy tornado: hovers with candy bits circling, spins into you, blows away in a puff
  /* 27 */ "47-choco-bunny": { idle: "hop", strike: "punch", ko: "melt", win: "flex" }, // a bunny brute: hops, a one-two with its fists, melts like chocolate, muscle pose
  /* 28 */ "11-shake-ooze": { idle: "wobble", strike: "slam", ko: "sink", win: "overload" }, // a milkshake slime: wobbles, flops onto you, sinks back into its cup, swells up (it grows on rest days)
  /* 29 */ "48-marshmallow-mammoth": { idle: "walk", strike: "stomp", ko: "flatten", win: "laugh" }, // a mammoth: ground-shaking stomp, squashed flat as a soft marshmallow, shakes with laughter
  /* 30 */ "12-queen-frosting": { idle: "walk", strike: "bonk", ko: "collapse", win: "curtsy" }, // boss: the cupcake queen brings her star scepter down, the frosting tiers slide apart and the crown flies off, a royal curtsy
  /* 31 */ "23-jolt": { idle: "walk", strike: "storm", ko: "fizzle", win: "dance" }, // an energy-drink gremlin: its lightning bolts whirl out at you, it runs out of fizz, then can't stop dancing
  /* 32 */ "49-fizz-frog": { idle: "hop", strike: "spring", ko: "bellyup", win: "bounce" }, // a frog: hops, leaps at you, a frog belly-up, big happy boings
  /* 33 */ "24-boba-blob": { idle: "wobble", strike: "chomp", ko: "melt", win: "eat" }, // a bubble-tea slime: jelly sway, chewy bites, melts into a puddle, slurps its prize with the raised arm
  /* 34 */ "50-sour-squeeze": { idle: "walk", strike: "puff", ko: "implode", win: "twirl" }, // a sour pitcher: squirts sour juice, puckers up into nothing, twirls
  /* 35 */ "25-slush": { idle: "walk", strike: "swipe", ko: "melt", win: "dance" }, // a slushie squid: tentacles sway, one icy tentacle swipes, melts to slush, a happy tentacle dance
  /* 36 */ "51-cocoa-croc": { idle: "walk", strike: "chomp", ko: "sink", win: "laugh" }, // a croc mug: two big bites, sinks like into its cocoa, jaws thrown back laughing
  /* 37 */ "26-frappe-phantom": { idle: "float", strike: "swoop", ko: "poof", win: "hover" }, // a whipped-coffee ghost: haunts the air, swoops at you, vanishes in a puff, loops round the cafe
  /* 38 */ "52-float-bear": { idle: "float", strike: "puff", ko: "melt", win: "twirl" }, // a root-beer float: floats, blasts its fizz, the ice cream melts, twirls
  /* 39 */ "27-boxer": { idle: "walk", strike: "punch", ko: "knockout", win: "dance" }, // a juice-box boxer: a one-two from the gloves, a boxer's fall, then fancy footwork (floats like a bubble)
  /* 40 */ "28-fountain-king": { idle: "walk", strike: "slam", ko: "collapse", win: "overload" }, // BOSS, the soda-fountain king: body-slams the floor, falls apart with the cup crown flying off, swells huge with bubbles whirling
  /* 41 */ "29-nugget-ninja": { idle: "hop", strike: "swipe", ko: "poof", win: "twirl" }, // a nugget ninja: light on its feet, the left hand flings the throwing star, vanishes in smoke like a ninja, a ninja spin to gloat
  /* 42 */ "53-hash-hound": { idle: "hop", strike: "charge", ko: "sink", win: "dance" }, // an excited dog: bounces about, rushes you, sinks back down into its sleeve, tail-wag dance
  /* 43 */ "13-taco-titan": { idle: "walk", strike: "stomp", ko: "collapse", win: "flex" }, // a flexing taco giant: stomps (dropping salsa), falls apart sideways, lettuce flying, arm day forever
  /* 44 */ "54-mozz-mantis": { idle: "walk", strike: "swipe", ko: "topple", win: "curtsy" }, // a mantis: a raptor-arm swipe, tips over, a praying bow
  /* 45 */ "30-wrapped-up": { idle: "walk", strike: "charge", ko: "collapse", win: "laugh" }, // a burrito mummy: shambles at you arms out, comes unwrapped with the filling flying off, cackles
  /* 46 */ "55-pancake-bot": { idle: "walk", strike: "swipe", ko: "fizzle", win: "dance" }, // a robot: slaps with its spatula, powers down grey, a robot dance
  /* 47 */ "31-wingfire": { idle: "flap", strike: "puff", ko: "bellyup", win: "hover" }, // a hot-wing phoenix: flame wings beat, blasts fire at you, falls belly-up, loops through the air
  /* 48 */ "56-corn-dog-cyclops": { idle: "hop", strike: "spring", ko: "dizzy", win: "laugh" }, // hops on its stick: springs at you, one eye spinning dizzy, boings on its stick (win changed to laugh so no two monsters share a mix)
  /* 49 */ "14-crust-colossus": { idle: "walk", strike: "swipe", ko: "crumble", win: "drum" }, // a stone pizza golem: bashes with the pepperoni shield, crumbles like old rock, beats its rock chest
  /* 50 */ "32-sergeant-supersize": { idle: "walk", strike: "stomp", ko: "topple", win: "champ" }, // BOSS, the soda-cup general: a ground-shaking stomp, the giant cup tips over backwards, victory hop with the megaphone high
  /* 51 */ "33-noodle-noggin": { idle: "walk", strike: "slam", ko: "flatten", win: "drum" }, // a mac-and-cheese brute: knuckle arms swing, body-slams, squashed flat, beats its chest
  /* 52 */ "57-meatball-minotaur": { idle: "walk", strike: "charge", ko: "knockout", win: "flex" }, // a bull: a stampede charge, knocked out cold, flexes
  /* 53 */ "34-gravy-golem": { idle: "walk", strike: "stomp", ko: "crumble", win: "drum" }, // a mashed-potato golem: heavy stomp, crumbles into lumps, drums with its boulder fists (the butter pat tips as its hat)
  /* 54 */ "58-garlic-bread-gargoyle": { idle: "flap", strike: "swoop", ko: "crumble", win: "laugh" }, // a winged gargoyle: flaps its butter wings, dives at you, crumbles like stone and toast, loops in the air (win changed to laugh so no two monsters share a mix)
  /* 55 */ "15-buffet-beast": { idle: "walk", strike: "chomp", ko: "topple", win: "eat" }, // a four-armed buffet chimera: the all-you-can-eat mouth bites, it tips over trays flung up, goes back for seconds of pancakes
  /* 56 */ "59-fondue-fiend": { idle: "wobble", strike: "jab", ko: "melt", win: "eat" }, // bubbling cheese: wobbles, jabs a fondue fork, melts into the pot, eats its dipped bread
  /* 57 */ "35-lasagna-lich": { idle: "float", strike: "storm", ko: "implode", win: "laugh" }, // a floating lasagna wizard: its basil wisps whirl at you, it swirls into nothing, an evil cackle
  /* 58 */ "60-turkey-leg-troll": { idle: "walk", strike: "bonk", ko: "knockout", win: "drum" }, // a troll with a turkey-leg club: winds the club back and bonks you, knocked out, pounds the air with club and fist
  /* 59 */ "36-cheesecake-knight": { idle: "walk", strike: "jab", ko: "topple", win: "curtsy" }, // a cheesecake knight: thrusts the fork lance, topples over with its helmet, a knightly twirl and bow
  /* 60 */ "16-midnight-snacker": { idle: "walk", strike: "chomp", ko: "collapse", win: "dance" }, // boss: the fridge's glowing mouth chomps, it slumps over and the nightcap flies off, a midnight slipper dance
  /* 61 */ "61-pint-yeti": { idle: "walk", strike: "bonk", ko: "topple", win: "eat" },
  /* 62 */ "62-pizza-roll-pack": { idle: "hop", strike: "stomp", ko: "crumble", win: "dance" }, // a huddle of penguin pizza rolls: hops as a pack, stomps the ice, breaks apart into rolls, waddle-dances
  /* 63 */ "63-popsicle-pete": { idle: "walk", strike: "spring", ko: "melt", win: "dance" },
  /* 64 */ "64-freezer-burn": { idle: "walk", strike: "bonk", ko: "topple", win: "flex" }, // a grumpy old tub shaking its fist: brings the fist down, tips over with its lid flying, flexes over the grudge it won
  /* 65 */ "65-waffle-cone-walrus": { idle: "wobble", strike: "slam", ko: "melt", win: "bounce" }, // three scoops of blubber: wobbles, body-slams, melts into a strawberry puddle, bounces on its belly
  /* 66 */ "66-snow-cone-owl": { idle: "flap", strike: "swoop", ko: "bellyup", win: "hover" }, // an owl with syrup wings: flaps, swoops down on you, falls belly-up, loops overhead watching
  /* 67 */ "67-sandwich-seal": { idle: "walk", strike: "spring", ko: "sink", win: "champ" }, // a seal: flops at you, slips under the ice, claps both flippers in the air
  /* 68 */ "68-polar-pizza-bear": { idle: "walk", strike: "bonk", ko: "knockout", win: "eat" }, // a sleepy bear with a frozen slice: whacks you with it, drops off to sleep, eats the slice
  /* 69 */ "69-cake-igloo": { idle: "wobble", strike: "chomp", ko: "collapse", win: "laugh" }, // an ice cream cake house whose door is a mouth: bites, caves in with the cherry flying off, shakes with laughter
  /* 70 */ "70-emperor-neapolitan": { idle: "walk", strike: "jab", ko: "melt", win: "curtsy" }, // the boss: thrusts the cone sceptre, the brick slides apart and all three crowns fly, a royal twirl and bow (ko changed to melt so no two monsters share a mix)
  /* 71 */ "71-nacho-gremlin": { idle: "hop", strike: "spring", ko: "crumble", win: "dance" }, // a jumpy chip gremlin, ears flapping: pounces, crumbles into chip shards, dances
  /* 72 */ "72-pretzel-python": { idle: "slither", strike: "chomp", ko: "dizzy", win: "twirl" }, // a pretzel snake: slithers, bites, spins itself dizzy, twirls itself into knots
  /* 73 */ "73-candy-box-goblin": { idle: "walk", strike: "spin", ko: "flatten", win: "eat" }, // a goblin in a candy box: a rattling spin, the box gets squashed flat, eats the last candy
  /* 74 */ "74-jumbo-cup-jellyfish": { idle: "float", strike: "swipe", ko: "fizzle", win: "hover" }, // a soda-cup jellyfish: drifts, lashes a straw tentacle, goes flat and fizzles out, drifts in loops
  /* 75 */ "75-licorice-wrangler": { idle: "walk", strike: "lasso", ko: "dizzy", win: "yeehaw" },
  /* 76 */ "76-butter-banshee": { idle: "float", strike: "puff", ko: "melt", win: "overload" }, // a melted-butter ghost: floats, wails a blast at you, melts into a puddle, swells up with popcorn whirling
  /* 77 */ "77-hot-dog-usher": { idle: "walk", strike: "jab", ko: "knockout", win: "curtsy" }, // a hot dog usher: thrusts the flashlight in your face, tips over backwards, bows you to your seat (ko changed to knockout so no two monsters share a mix)
  /* 78 */ "78-sour-straw-scorpion": { idle: "walk", strike: "swipe", ko: "bellyup", win: "flex" }, // a candy-straw scorpion: swipes with a pincer, flips belly-up legs kicking, raises both pincers
  /* 79 */ "79-bucket-bison": { idle: "walk", strike: "charge", ko: "topple", win: "bounce" }, // a popcorn-bucket bison: charges head first, tips over, big happy boings
  /* 80 */ "80-count-concession": { idle: "walk", strike: "swoop", ko: "poof", win: "laugh" }, // the vampire boss: swoops down like a bat, vanishes in a puff, laughs a big mwahaha
  /* 81 */ "81-waffle-wolf": { idle: "walk", strike: "chomp", ko: "crumble", win: "laugh" }, // a snarling waffle wolf: snaps its jaws, breaks into waffle bits, howls with laughter, head thrown back
  /* 82 */ "82-eggs-benny": { idle: "wobble", strike: "spring", ko: "flatten", win: "bounce" }, // two jiggly poached eggs: they wobble, spring at you, splat flat, boing about happily
  /* 83 */ "83-syrup-serpent": { idle: "slither", strike: "chomp", ko: "melt", win: "laugh" }, // a syrup snake: slithers, bites twice, runs into a sticky puddle, cackles with its head back
  /* 84 */ "84-pop-up-imp": { idle: "hop", strike: "spring", ko: "sink", win: "champ" }, // a toaster pastry: pops up and down, springs out at you, sinks back down the slot, arms up in victory
  /* 85 */ "85-biscuit-badger": { idle: "walk", strike: "charge", ko: "crumble", win: "laugh" }, // a stout biscuit badger: charges with its digging paws, crumbles like a biscuit, kicks its paws in a dance (win changed to laugh so no two monsters share a mix)
  /* 86 */ "86-cinnamon-cyclone": { idle: "float", strike: "spin", ko: "dizzy", win: "twirl" }, // a tornado: hovers with its debris circling, spins into you, spins itself dizzy, twirls on and on
  /* 87 */ "87-french-toast-toucan": { idle: "hop", strike: "swoop", ko: "bellyup", win: "dance" }, // a bird: hops about, swoops at you, falls belly-up feet kicking, struts a little dance
  /* 88 */ "88-croissadillo": { idle: "walk", strike: "spin", ko: "topple", win: "bounce" }, // an armadillo: rolls up and spins into you, tips over on its shell, bounces like a ball
  /* 89 */ "89-breakfast-burrito-bear": { idle: "walk", strike: "slam", ko: "knockout", win: "drum" }, // a sleepy, grumpy bear: body-slams in its blanket, falls back fast asleep, drums its paws
  /* 90 */ "90-lady-short-stack": { idle: "walk", strike: "jab", ko: "collapse", win: "curtsy" },
  /* 91 */ "91-egg-roll-rocket": { idle: "float", strike: "charge", ko: "fizzle", win: "hover" }, // a rocket with its wingman circling: blasts right at you, sputters out, loops the loop
  /* 92 */ "92-dumpling-duo": { idle: "wobble", strike: "puff", ko: "poof", win: "bounce" }, // two soft steamed dumplings: jiggle, blast steam at you, drift off in a puff of steam, boing together
  /* 93 */ "93-rangoon-raccoon": { idle: "walk", strike: "spring", ko: "dizzy", win: "laugh" }, // a sneaky thief: pounces, spins round dazed, snickers over its stolen rangoon
  /* 94 */ "94-takeout-box-turtle": { idle: "walk", strike: "slam", ko: "bellyup", win: "twirl" }, // a turtle: slams down its heavy box shell, flips onto its back legs kicking, spins on its shell
  /* 95 */ "95-lo-mein-leviathan": { idle: "slither", strike: "chomp", ko: "sink", win: "twirl" }, // a noodle sea serpent: sways, slurps at you, sinks back into its takeout box, swirls round like a noodle
  /* 96 */ "96-bao-blowfish": { idle: "float", strike: "puff", ko: "pop", win: "hover" }, // a pufferfish bun: swims in the air, puffs up spiky, pops flat, loops about with its fins going
  /* 97 */ "97-kung-pao-kangaroo": { idle: "walk", strike: "punch", ko: "knockout", win: "champ" },
  /* 98 */ "98-chopstick-stick-bug": { idle: "walk", strike: "jab", ko: "collapse", win: "champ" }, // a stick insect: jabs with its noodle arm, the sticks slide apart, holds up its rice and noodle in triumph
  /* 99 */ "99-fortune-cookie-oracle": { idle: "float", strike: "storm", ko: "crumble", win: "overload" }, // a mystic cookie: hovers, hurls its swirls and sparkles at you, crumbles to bits, glows huge with its magic whirling
  /* 100 */ "100-the-takeout-dragon": { idle: "walk", strike: "punch", ko: "collapse", win: "flex" }, // the boss: a one-two with lantern and chopsticks, its chain of boxes slides apart, flexes both arms over you
  /* 101 */ "101-hush-puppy-pup": { idle: "walk", strike: "charge", ko: "dizzy", win: "bounce" }, // a begging puppy: bounds at you, chases its tail till it flops, happy boings with the tail going
  /* 102 */ "102-onion-ring-raptor": { idle: "walk", strike: "chomp", ko: "topple", win: "dance" }, // a toothy raptor: two big bites, tips over backwards, a stompy victory dance
  /* 103 */ "103-tempura-toad": { idle: "hop", strike: "chomp", ko: "flatten", win: "bounce" }, // a toad: hops, springs at you, splats flat as a pancake, boings on its dish (strike changed to chomp so no two monsters share a mix)
  /* 104 */ "104-churro-chameleon": { idle: "walk", strike: "swipe", ko: "poof", win: "dance" }, // its long tongue lashes out; defeated, it blends away into thin air; wiggles on its branch
  /* 105 */ "105-battered-brick": { idle: "walk", strike: "slam", ko: "crumble", win: "flex" }, // a heavy block: body-slams the floor, crumbles into batter, flexes its stubby arms
  /* 106 */ "106-fried-okra-octopus": { idle: "walk", strike: "swipe", ko: "sink", win: "drum" }, // eight arms going: a tentacle swipe, sinks into the dipping sauce, drums with all its arms
  /* 107 */ "107-fried-pickle-phoenix": { idle: "flap", strike: "swoop", ko: "fizzle", win: "hover" }, // a fire bird: dives on flaming wings, its flames sputter out, loops in the air
  /* 108 */ "108-chicken-fried-stegosaurus": { idle: "walk", strike: "stomp", ko: "topple", win: "dance" }, // a heavy dino: ground-shaking stomp, tips over on its back, a four-legged stomp dance
  /* 109 */ "109-fish-fry-shark": { idle: "float", strike: "chomp", ko: "bellyup", win: "twirl" }, // swims above its lemon and dip: big bites, floats belly-up like a fish, twirls in the oil
  /* 110 */ "110-the-fry-lord": { idle: "walk", strike: "bonk", ko: "collapse", win: "overload" }, // the world boss: brings the spatula sceptre down on you, slumps and the fry crown flies off, a royal twirl and bow with the crown glinting (win changed to overload so no two monsters share a mix)
  /* 111 */ "111-astronaut-ice-cream": { idle: "float", strike: "charge", ko: "melt", win: "yeehaw" }, // floating in zero-g: jets right at you, still somehow melts, hops about waving
  /* 112 */ "112-mooncake-moth": { idle: "flap", strike: "swoop", ko: "bellyup", win: "twirl" }, // a moth: dives at you, falls belly-up, flutters figure-eights round the fridge light (win changed to twirl so no two monsters share a mix)
  /* 113 */ "113-galaxy-gummies": { idle: "wobble", strike: "storm", ko: "pop", win: "overload" }, // jelly stars: the little gummies whirl out at you, the big one bursts, the constellation spins up bright
  /* 114 */ "114-rocket-pop": { idle: "float", strike: "puff", ko: "fizzle", win: "twirl" }, // a rocket ice pop: blasts its flame at you, melts on re-entry, barrel-rolls (ko changed to fizzle so no two monsters share a mix)
  /* 115 */ "115-pizza-saucer": { idle: "float", strike: "spin", ko: "dizzy", win: "hover" }, // a flying saucer: spinning attack, spins out and crash-lands, loops the loop
  /* 116 */ "116-saturn-sundae": { idle: "float", strike: "storm", ko: "collapse", win: "twirl" }, // a planet: its sprinkles whirl out at you, slumps and the cherry flies off, spins like a planet
  /* 117 */ "117-gelatin-glorp": { idle: "wobble", strike: "slam", ko: "flatten", win: "laugh" }, // a jelly alien: wobbles, body-slams, splats flat, jiggles with laughter, eye stalks waving
  /* 118 */ "118-comet-cupcake": { idle: "float", strike: "charge", ko: "fizzle", win: "bounce" }, // a comet: streaks right at you, burns out, big birthday boings
  /* 119 */ "119-black-hole-bagel": { idle: "walk", strike: "storm", ko: "implode", win: "overload" }, // a black hole: its swirl and snacks storm out, it collapses into a point, swirls bigger and brighter
  /* 120 */ "120-the-snackularity": { idle: "float", strike: "storm", ko: "implode", win: "overload" },
};

const PLAIN: MonsterMoves = { idle: "walk", strike: "charge", ko: "topple", win: "bounce" };
export const movesFor = (slug: string): MonsterMoves => MOVES[slug] ?? PLAIN;
