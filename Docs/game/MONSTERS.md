# Calorie Crusher — the 44 newer monsters' abilities

The first 16 monsters' abilities are in `../GAME_MODE.md`. Levels, HP and deadlines for the first 60 are
in `LEVELS_60.md` and `levels60.json`. The art is in `monsters/*.svg`: viewBox 0 0 200 200,
cartoon style, outlines #2b1d3a. The numbers in the file names are species ids, not levels.

Heals are Snack +10, Meal +25 and Feast +60. Damage is minutes + calories ÷ 10. All of these are
first drafts and will be tuned.

| Monster | Ability |
|---|---|
| **Snack Swamp** | |
| Jerky Gator | *Long Chew*: Snacks heal 10, then 5 more the next day |
| Twisty | *Loop-de-Loop*: Meals heal 25, then 10 more the next day |
| Puffball | *Puff Up*: below half HP, Snacks heal 20, not 10 |
| Popcorn Puff | *Pop Pop Pop*: Snacks on the same day heal 10, then 20, then 30 |
| Sour Worm | *Wriggle Free*: the comeback ×2 does nothing here |
| Corny | *Candy Flock*: the 3rd Snack in a day heals 30, not 10 |
| **Burger Badlands** | |
| Slider Trio | *Brother Act*: the first knockout leaves it at 30 HP, so it has to be knocked down twice |
| Pickle Prickle | *Dill Deal*: Snacks heal only 5, but Meals heal 40 |
| Bacon Bandit | *Stick 'Em Up*: no power-ups work in this fight (you keep them) |
| Ringleader | *Encore*: weekend splurges heal 15 extra |
| Tot Rock | *Hard Shell*: the first 10 damage of every workout bounces off |
| Ketchup Coyote | *Sundown Howl*: +10 each day with no workout by 6 PM |
| **Sugar Peaks** | |
| Swirlpop | *Boing Back*: hits under 30 damage do half |
| Candy Cane Crab | *Hard Candy*: calories count half (÷ 20) until it drops below half HP |
| Taffy Stretch | *Stretchy*: damage past 60 in one workout counts half |
| Fluffnado | *Whirlwind*: a Feast blows away your next clean-day crit |
| Choco Bunny | *Bitten Ear*: at half HP, its next 3 heals are doubled |
| Marshmallow Mammoth | *Soft Landing*: a clean day only lands its crit if you also worked out that day |
| **Fizzy Falls** | |
| Jolt | *Caffeine Rush*: the first splurge each day heals double |
| Fizz Frog | *Last Leap*: on the deadline's last day, every heal is doubled |
| Boba Blob | *Chewy Pearls*: Snacks heal 20, not 10 |
| Sour Squeeze | *Pucker Up*: planned treats heal in full, not half |
| Slush | *Ice Grip*: after a day with no workout, the next workout counts minutes only |
| Cocoa Croc | *Second Cup*: after a Meal, your next Snack heals 25 |
| Frappe Phantom | *Vanishing Act*: workouts logged after 8 PM do half damage |
| Float Bear | *Last Licks*: can't be finished on a day you splurge; it stays at 1 HP |
| Boxer | *One-Two*: a day's second splurge heals double |
| ★ The Fountain King | *Free Refills*: every Snack heals 10, then 10 more the next morning |
| **Midnight Drive-Thru** | |
| Nugget Ninja | *Shadow Dodge*: workouts under 15 min do 0 damage |
| Hash Hound | *Breakfast Bark*: splurges before 11 AM heal double (a splurge with no time counts as before 11 AM) |
| Mozz Mantis | *Cheese Pull*: Snacks heal 25, not 10 |
| Wrapped Up | *Extra Wrap*: Meals heal 40, not 25 |
| Pancake Bot | *Reboot*: once, at a quarter of its HP, it regains 60 |
| Wingfire | *Rise Again*: the first time it hits 0 HP, it rises again with 60 HP |
| Corn Dog Cyclops | *Tunnel Vision*: only your biggest workout each day hits in full; the others do half |
| ★ Sergeant Supersize | *Supersize It*: every Meal heals 60, like a Feast |
| **Feast Fortress** | |
| Noodle Noggin | *Comfort Food*: on a day with no workout, every splurge heals 15 extra |
| Meatball Minotaur | *Stampede*: if you splurged yesterday, every splurge today heals double |
| Gravy Golem | *Rock Solid*: comeback hits don't double |
| Garlic Bread Gargoyle | *Stone Skin*: no comeback ×2 |
| Fondue Fiend | *Double Dip*: a splurge within 3 hours of another heals double (no time counts as within 3 hours) |
| Lasagna Lich | *Leftovers*: Feasts heal 60, then 30 more the next day |
| Turkey Leg Troll | *Bridge Toll*: the first 20 damage each day does nothing |
| Cheesecake Knight | *Shield Up*: after each splurge, your next workout does 15 less |
| ★ The Midnight Snacker | *Late Night*: splurges after 9 PM heal double (no time counts as after 9 PM) |

Some abilities overlap (three monsters cancel the comeback ×2). Tidy these up when tuning.

## Decisions made while building (Stage 1, Nov 11 2026)
Where an ability's wording left a choice open, the engine (`shared/game/abilities.ts`) took the
simplest reading below. Each has a test in `test/game.test.ts`.

- **Halves round up** everywhere ("do half", "counts half", a planned treat), in the person's favour.
- **Ability heal sizes come first, then the planned-treat half.** Chiplet's planned Snack heals 8
  (15 halved, rounded up). Sour Squeeze skips the half.
- **"Then N more the next day"** (Jerky Gator, Twisty, The Fountain King, Lasagna Lich) lands at the
  start of the next day, only if that day is still inside the fight. A planned treat's extra part is
  halved too. It is its own heal, so a Veggie Shield can block it separately.
- **Time-based abilities read the entry's own time; no time means "assume the worst"** for workouts
  too, not only splurges. Frappe Phantom: a workout with no time does half. Ketchup Coyote: a
  workout with no time is not "by 6 PM". Boundaries: after 9 PM = 21:00 or later, before 11 AM =
  before 11:00, after 8 PM = 20:00 or later, by 6 PM = 18:00 or earlier.
- **Fondue Fiend** looks both ways: a splurge within 3 hours of any other splurge that day (before or
  after it) heals double. So both of a pair do.
- **"Today"** for an ability means the splurges and workouts that count for this fight on that day.
  It covers the whole day as logged so far, not only the ones before the entry being worked out.
  This applies to Noodle Noggin's "day with no workout", Float Bear's "day you splurge" and Corn Dog
  Cyclops' biggest workout. **"Yesterday"** (Meatball Minotaur) is the whole log.
- **Popcorn Puff:** the 4th Snack and later stay at 30. **Corny:** only the 3rd Snack heals 30; the
  4th is back to 10.
- **Sir Soda (Fizz Shield):** the first 15 minutes of workout each day lose half their minutes'
  worth (rounded down, ×2 on a comeback). Calories are untouched.
- **Tot Rock, Turkey Leg Troll, Brain Freeze, Cheesecake Knight** take their damage off workouts
  only. Crits and Water Potions are untouched. Damage never goes below 0.
- **Cheesecake Knight:** a splurge raises the shield and the next workout takes it down. Two
  splurges before one workout still take off only 15.
- **Fluffnado:** each Feast blows away one later crit (two Feasts, two crits).
- **Candy Cane Crab:** "until it drops below half" is checked before each workout (at half HP or
  more, calories count ÷ 20).
- **Slush:** "after a day with no workout" is the comeback's own test (the day's first workout,
  after a calendar day with no activity). The comeback ×2 still applies, to the minutes only.
- **Gummo, Pancake Bot (once, at half / a quarter):** they fire after a hit that leaves the monster
  at or below the mark but still standing. A single hit that takes it straight to 0 is a knockout.
  **Choco Bunny** uses the same once-only trigger to start its 3 doubled heals.
- **Slider Trio, Wingfire** come back once, whatever the knockout was (a workout, a crit or a potion).
- **Float Bear** stays at 1 HP every time it would go down on a day with a splurge. On a later day
  without one, it goes down as usual. A splurge logged after a fight is settled does not undo the KO.
- **Monster comebacks and day-end heals:** Gummo's, Pancake Bot's, Slider Trio's and Wingfire's
  comebacks don't break *flawless*, and a Veggie Shield doesn't block them. Slurp and Sundown Howl
  do both, like a splurge's heal does. A heal that lands at full HP still counts as landed.
- **Long Frank:** "one extra day" is +1 on his table deadline (4 → 5 days).
- **Bacon Bandit:** a shield that was already up does nothing in his fight. It stays up for the next fight.
- The three monsters that cancel the comeback (Sour Worm, Gravy Golem, Garlic Bread Gargoyle) are left as written.

## Worlds 7 and 8 (built Nov 22 2026)
The roster, drawings and Monster Book lines are in `drafts/world7/README.md` and `drafts/world8/README.md`
(the drawings were copied to `monsters/` and `web/public/monsters/`). Decisions made while building:
- **The fight's day** (Slow Thaw, Frozen Solid, Intermission): day 1 is the start day; a fight that began
  partway through a day after a KO gets that part-day as day 0, and its days count from the next one. So Slow
  Thaw halves the part-day too, and Intermission's 3rd and 6th days are counted from day 1.
- **Cold Snap:** the Feast has to count for this fight; a Feast and a workout on the same day are not halved.
- **Twelve-Pack:** the 150 is workout damage only (a Water Potion and the clean-day crit still land in full).
- **Meltdown:** "45 min or more" is the workout's minutes; its 20 extra is added after the comeback ×2.
- **Thick Blubber:** the comeback still doubles the minutes.
- **Sharp Eyes:** "no time" is a splurge saved without a time.
- **Hibernate:** Saturday and Sunday are the phone's days, whatever the person's week start.
- **Frozen Solid:** a hit that would finish it earlier leaves it at 1 HP; heals still land on top.
- **Three Crowns:** it comes back with 300, then 150, whatever the Monster toughness (like Brother Act and Rise Again).
- **Constrictor:** the day's minutes add up every workout that counts for the fight; calories don't count.
- **Sting:** an hour is 60 minutes; the next workout may be on a later day.
- **Lasso:** a tenth of the day's damage, the clean-day crit included, rounded.
- **Seat Check:** the first 2 workouts that count for the fight that day, in the day's order.
- **Lingering Sour:** each of the three later heals can be blocked by a Veggie Shield on its own.
- **Last Kernels:** "below a quarter" is under max HP ÷ 4 when the splurge lands.

## Worlds 9 to 12 (built Nov 22 2026)
Matt: "please build it all out" — built straight from the Round 9 ideas (canvas rounds 12–15 show them). The roster is
in `levels.ts`, `abilities.ts` and `bios.ts`; drafts in `drafts/world9/` … `drafts/world12/`. Decisions made while building:
- **Grid Lock:** rounded down after the comeback ×2 (a 9-minute walk does nothing).
- **Brunch for Two:** "before it" = earlier that day among the splurges that count for the fight.
- **Slow Drip, Lasso:** the day's damage includes the clean-day crit.
- **Just Popped:** both need a time, and the workout has to come 0–60 minutes after the splurge.
- **Stubborn:** a quarter of the fight's max HP (toughness included), workout damage only.
- **Spin Cycle, Constellation, Stack Up, Ring Shield:** they count through the whole fight, a Veggie Shield's block included.
- **Soaked:** the ability's double replaces the planned treat's half.
- **Roll Up:** once a fight, the first workout of 30 minutes or more.
- **Pouch:** the day's first splurge heals its full size again at midnight (before a planned treat's half).
- **Lunch Rush:** Monday to Friday, 11:00 to 13:59.
- **Lucky Numbers, Liftoff:** the fight's days as for Slow Thaw (Liftoff's "first day" includes the bonus part-day).
- **Order Up:** the run of splurge days counts within the fight; a day with no splurge starts it again.
- **Fetch:** a workout with no minutes counts as under 10.
- **Ring of Fire:** a Feast anywhere in the day halves that day's workouts, even ones logged before it.
- **Blend In:** no calories, or 0, is "without calories".
- **Refried:** a third of the fight's max HP (toughness included), once.
- **Crispy Plates:** "below half" is checked when the crit would land, at the end of the day.
- **Feeding Frenzy:** the Feast itself gets no extra; every splurge after it does.
- **Freeze-Dried:** the battle log says "heals nothing now"; the next morning's heal can be blocked by a Veggie Shield.
- **Night Light:** a splurge needs a time to count (10 PM to 4:59 AM).
- **Tractor Beam:** every workout that counts for the fight, even one with no minutes.
- **Jiggle:** half (rounded up) plus 20, and a workout that does nothing still does nothing.
- **Big Appetite, Event Horizon:** the bonus HP cap is 40% / 100% of max HP (`bonusShare`), in the live panels too.
- **Every Craving:** on a day you splurged it holds at 1 HP (before any comeback); on another day its first knockout leaves it at 500 HP.
