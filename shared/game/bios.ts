/**
 * One funny line for each of the 60 monsters, shown in the Monster Book. The lines are the ones in
 * the approved mockups (MonBestiary1-2, MonNewA-E). Pure data; test/game3.test.ts checks every
 * level has one and the names match levels.ts.
 */
import { levelInfo } from "./levels.js";

// level, name (as in levels.ts), bio
export const BIOS: readonly (readonly [number, string, string])[] = [
  [1, "Crumbs", "Leaves a trail of crumbs so it can always find its way back to the cookie jar."],
  [2, "Chiplet", "Can never stop at one bite, and neither can its wings."],
  [3, "Jerky Gator", "Has been chewing the same strip since Tuesday. Refuses to swallow."],
  [4, "Twisty", "Ties itself in knots on purpose. Nobody has ever found the end of the tail."],
  [5, "Gummo", "Bounces back from anything. Literally. It is a gummy."],
  [6, "Puffball", "Leaves orange fingerprints on everything it touches. Touches everything."],
  [7, "Popcorn Puff", "Was a quiet little kernel until movie night. Now it never stops popping."],
  [8, "Sour Worm", "Half sour, half sweet, all attitude. Winks so it does not have to pucker."],
  [9, "Corny", "Only comes out in autumn. Tells the same three jokes. Caws at its own punchlines."],
  [10, "Sir Soda", "Sworn protector of the vending machine. Speaks fluent burp."],
  [11, "Fry Hydra", "Three heads, one carton, and zero agreement on what to order."],
  [12, "Slider Trio", "Three tiny brothers, one big act. The one on the bottom never gets the applause."],
  [13, "Pickle Prickle", "Grew up in a jar by the highway. Gives very prickly hugs."],
  [14, "Queso Kraken", "Eight cheesy tentacles, and every one of them wants a hug."],
  [15, "Bacon Bandit", "Wanted in three diners for sizzling without a permit."],
  [16, "Ringleader", "Ladies and gentlemen! Step right up for the greatest snack on earth!"],
  [17, "Tot Rock", "Crispy outside, fluffy inside. Will deny the fluffy part."],
  [18, "Long Frank", "Has not seen the end of his own tail since last summer."],
  [19, "Ketchup Coyote", "Howls at the moon every night. The moon has asked it to stop."],
  [20, "Baron Fryer", "Old money, older oil. Twirls his moustache before every Feast."],
  [21, "Brain Freeze", "Born in the back of a freezer. Its hugs give everyone a headache."],
  [22, "Swirlpop", "Bounces all day on one spring. Licking it only makes it bounce higher."],
  [23, "Candy Cane Crab", "Walks sideways so it can keep one eye on the candy jar and one eye on you."],
  [24, "Glazewing", "Hoards sprinkles like gold. Its belly is a hole, so it is never, ever full."],
  [25, "Taffy Stretch", "Has been pulled at every county fair for forty years. Still refuses to snap."],
  [26, "Fluffnado", "Spins up out of nowhere at the county fair and leaves everyone sticky."],
  [27, "Choco Bunny", "Hollow inside, but do not tell it that. Still hunting for whoever bit its ear."],
  [28, "Shake Ooze", "Too thick for the straw and too lazy to leave the cup. Grows on rest days."],
  [29, "Marshmallow Mammoth", "Survived the Ice Age by toasting itself over a campfire. Only a little."],
  [30, "Queen Frosting", "Rules Sugar Peaks from a throne of sprinkles. Has never once said \"just one.\""],
  [31, "Jolt", "Has not blinked since Tuesday. Talks very, very, very fast."],
  [32, "Fizz Frog", "Burps in three flavors. Cannot sit still while it is fizzing."],
  [33, "Boba Blob", "Sees the world through two chewy pearls. Asks for extra pearls anyway."],
  [34, "Sour Squeeze", "Makes that face at everyone. Honestly thinks it is smiling."],
  [35, "Slush", "Eight icy arms and a permanent brain freeze. Loves a hug, which is the problem."],
  [36, "Cocoa Croc", "Says it only wants a sip. Then asks for marshmallows. Then asks for more marshmallows."],
  [37, "Frappe Phantom", "Haunts the café after closing time. Whispers \"extra whip\" in your ear."],
  [38, "Float Bear", "Half fizz, half scoop, all hug. The brain freeze comes free."],
  [39, "Boxer", "Trained on a juice-box diet. Floats like a bubble, stings like a brain freeze."],
  [40, "The Fountain King", "Rules Fizzy Falls from a throne of ice. Has never once said no to a refill."],
  [41, "Nugget Ninja", "Strikes from the shadows of the kids' menu. Nobody has ever seen it dip."],
  [42, "Hash Hound", "Sniffs out the drive-thru at dawn. Fetches nothing but extra sides."],
  [43, "Taco Titan", "Arm day? Every day. Leg day? Never. Drops salsa wherever it stomps."],
  [44, "Mozz Mantis", "Prays before every appetizer, then stretches it out for an hour."],
  [45, "Wrapped Up", "Has been unwrapping since the late shift. Still finding beans in there."],
  [46, "Pancake Bot", "Runs on syrup. Error 404: portion control not found."],
  [47, "Wingfire", "Ten-alarm hot. Every time you think it's done, it asks for extra sauce."],
  [48, "Corn Dog Cyclops", "Only has eyes for one thing, and it is on a stick."],
  [49, "Crust Colossus", "Carved from a pizza older than the castle. Nobody has ever eaten the shield."],
  [50, "Sergeant Supersize", "Shouts every order twice, always at the biggest size. Nobody outranks him."],
  [51, "Noodle Noggin", "Wears its noodles up when it's angry. It is always angry. And very cheesy."],
  [52, "Meatball Minotaur", "Guards the spaghetti maze. Has never found the way out, and does not want to."],
  [53, "Gravy Golem", "Built one scoop at a time. Keeps a pat of butter in its gravy lake for luck."],
  [54, "Garlic Bread Gargoyle", "Perched on the fortress wall since the first breadbasket. Smells amazing."],
  [55, "Buffet Beast", "Four arms, four trays, one napkin. Always goes back for seconds."],
  [56, "Fondue Fiend", "Bubbles at a perfect 160 degrees. Never lets a bread cube go to waste."],
  [57, "Lasagna Lich", "Seven layers, nine lives. Somehow even stronger the next day."],
  [58, "Turkey Leg Troll", "Lives under the drawbridge. Charges one drumstick per crossing, no exceptions."],
  [59, "Cheesecake Knight", "Sworn guardian of the dessert cart. Its fork has never lost a duel."],
  [60, "The Midnight Snacker", "Shuffles out in slippers when the house goes dark. Just checking the fridge. Again."],
];

/** The Monster Book line for a level (1 to 60). */
export function bioFor(level: number): string {
  const b = BIOS[level - 1];
  if (!b || b[0] !== level || b[1] !== levelInfo(level).name) throw new Error(`There is no bio for level ${level}.`);
  return b[2];
}
