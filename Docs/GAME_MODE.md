# Game mode — "Craving Crusher" (built Nov 11 2026)

Notes from the Nov 11 2026 brainstorm with Matt. **It is built** (stages 1–4, Nov 11 2026): how is in
[game/ARCHITECTURE.md](game/ARCHITECTURE.md), how to play is in [USER_GUIDE.md](USER_GUIDE.md). This
was the design it was built from; where the later decisions below change a number, they win. The research behind it is in [GAME_RESEARCH.md](GAME_RESEARCH.md).
The mockups are in the canvas artifact JaQKDBbcdYyzDybDBx2eXS
(https://claude.ai/artifact/JaQKDBbcdYyzDybDBx2eXS), rows **Round 5** (eight game ideas) and
**Round 6** (the chosen game, 13 boards).

## How we got here
1. **Round 5:** eight game ideas were mocked up:
   - Junk Drop arcade
   - Boss Week
   - Crumb Goblin
   - Weather Almanac
   - Sprout Garden
   - Pocket Pal
   - Clean Streets
   - The Long Trail
2. **Matt picked Boss Week** but not its name: "a battle against monsters where clean eating and activities work as attacks against the monsters and different levels of junk food gives the monster health". He asked for:
   - many monsters
   - a point system
   - a way for the monsters to "kill you", so you restart from the beginning
   - high scores
   - deadlines to kill each monster ("I love setting deadlines")
   - fun cartoon characters
3. **Calories count toward damage**, with no cap. Matt: "if the person does 2 hours and burns 800 calories, then that should count… it is on them to be honest. It is like them having junk food and not recording it."
4. **Nudges matter.** Matt: the game should "encourage someone that if they do 10 more minutes of workout or burn 100 more calories then the monster is dead."

The research advised against calories as the currency and against harsh "you die" penalties. Matt
heard both points and chose them anyway, so keep them. The design softens the edges like this:
- Junk never takes hearts directly. Only a missed deadline does.
- Every log earns points.
- A death restarts only the game. The tracker log is never touched.

**Name:** Matt named the game **Craving Crusher** (Nov 11 2026). The other options were Snack Smackdown, Junk Monsters and Belly Brawl.

## Later decisions (Nov 11 2026) — these override the older numbers below
- **60 levels, 6 worlds × 10** (Matt: "push it to 60 levels", "more levels per world and increase the
  number of worlds", "we need to also create more monsters"). **Every level is its own monster**: in
  each world, 9 monsters and then the boss at level 10. The worlds are Snack Swamp, Burger Badlands,
  Sugar Peaks, **Fizzy Falls**, **Midnight Drive-Thru** and Feast Fortress. HP = 100 + 15 × (level − 1);
  a boss gets × 1.3. Deadlines are 3–7 days by world, and a boss gets +1 day. The full table is in
  `game/LEVELS_60.md` (also `game/levels60.json`). The 44 newer abilities are in `game/MONSTERS.md`, and
  all 60 drawings are in `game/monsters/`. The 16-monster table further down keeps the original
  abilities, but its HP and deadlines are replaced by LEVELS_60.
- **Run mode: Normal or Hardcore**, picked when a run starts (option C).
  - **Normal:** at 0 hearts you are knocked back to the first level of your world with 3 hearts,
    and lose 250 points. The run carries on.
  - **Hardcore:** at 0 hearts the run is over and the next one starts at level 1. You get ×1.25 on
    all points and a skull badge in the Hall of Heroes, which has its own Hardcore tab.
  - A Hardcore run can drop to Normal at any time. A Normal run can't be switched to Hardcore.
- **Splurges have an optional time** in the regular app as well. This shipped Nov 11 2026 (a74b95f).
  When no time is given, time-based abilities assume the worst: the Midnight Snacker counts it as after
  9 PM, Hash Hound as before 11 AM, and Fondue Fiend as within 3 hours of another splurge.
- **The same fields in both modes.** Log a splurge and Log activity have exactly the dashboard's
  fields, order and labels. Game mode only re-skins them (the game palette and chunky buttons) and
  adds the live damage or heal panel. Build them as one form with two skins.
- **No Weigh in in game mode.** The game's bottom buttons are **+ Activity (attack)** and
  **+ Splurge**. The dashboard keeps all three.
- **Open:** should *Planned treat* also be a field on the dashboard's Log a splurge sheet? For now it
  sits only in the game's heal panel.
- Mockups: canvas rounds 6 and 7. Round 7 has the 60-level map, World 2 up close, Start a run,
  Knocked back, the game-styled sheets, the bottom buttons and five New monsters pages.

## Where it lives
- **Switch:** the initials menu (MW) gets a **Game mode** item, with a gamepad icon, above Goals, Settings and Sign out. In the game the same item reads **Back to tracker**. Mockup: `GameMenuSwitch`.
- **Logging:** the game has no logging of its own. It reads the person's real log: activities, splurges, clean days.
- **Off by default**, per person. Each person has their own run.

## Rules

### Attacks
- **Workout damage = minutes + calories burned ÷ 10** (rounded). There is no cap.
  - Calories are optional; a workout without them counts minutes only.
  - Example: a 45-min walk burning 210 cal does 45 + 21 = 66 damage.
  - 10 minutes = 100 calories = 10 damage, which is what makes the "so close" nudges easy to say.
- **Clean day:** a day with no splurge is a **critical hit** of 25, dealt at midnight (the phone's day).
- **Comeback:** the first workout after a day with no activity does ×2 damage.

### Heals (junk gives the monster health)
- Snack +10, Meal +25, Feast +60, by the splurge's size, not its calories.
- A splurge marked **planned treat** (a birthday dinner) heals half.
- A monster's ability can change these numbers (see the roster).
- **Bonus HP** (Matt, Nov 14 2026): a splurge at full HP is no longer free. What doesn't fit goes on
  as bonus HP, up to 20% of the monster's max HP, shown as a violet bar over the HP bar. Workouts
  take the bonus off first.

### Deadlines
- Each monster has a default deadline in days from when the fight starts.
- On **Choose your fight** you can bet on a shorter one:
  - default = ×1 "Steady"
  - one day less = ×1.5 "Bold"
  - two days less = ×2 "Daredevil"
- The multiplier applies to that monster's whole point total.

### Hearts and dying
- A run starts with **3 hearts**; the most you can hold is 5.
- If the deadline passes with HP left, the monster **strikes**: you lose 1 heart. It heals back to full and you rematch it with a fresh deadline.
- You earn a heart back for:
  - beating a world boss: +1
  - a week with 5+ active days: +1
- **At 0 hearts you are Defeated.** The run's score goes to the **Hall of Heroes**, and the next run starts again at World 1, Monster 1.
- The copy stays kind and funny: the monsters throw a party, and Fry Hydra wears your helmet.

### Points
| What | Points |
|---|---|
| Damage dealt | 1 per damage |
| Kill | the monster's max HP |
| Speed | +50 per full day left on the deadline |
| Deadline bet | ×1.5 or ×2 on that monster's total |
| Flawless (no heals during the fight) | +100 |
| Boss kill | +500 |
| Every log (activity, splurge, weigh-in) | +5, even a Feast, so logging is always worth it |

Worked example: beating Fry Hydra (250 HP) with 2 days left at ×1 earns damage + 250 kill + 100 speed.

### Power-ups (earned, one use each)
- **Veggie Shield:** blocks one heal. Earned with 3 clean days in a row.
- **Water Potion:** +50 damage. Earned with a 60+ min workout.
- **Second Wind:** +1 day on a deadline. Earned with a boss kill.

### "So close" nudges (Matt's key ask)
The game always says what would finish the monster, in minutes and in calories:
- **Battle screen:** "92 HP left. Finish it: 92 more minutes, or 920 calories, or mix, e.g. a 45-min run burning 470 cal."
- **Log activity sheet** (game mode on): a live line as you type: "This hits Fry Hydra for 66 · 26 short. 26 more min or 260 more cal would finish it!" Once it's enough, it reads "FINISHING BLOW! Fry Hydra goes down." Saving shows "Logged · Fry Hydra −66".

## The monsters (16, in 4 worlds)
Bosses are marked ★. "d" = default deadline in days.

| # | Monster | Look | HP | d | Ability |
|---|---|---|---|---|---|
| **World 1 — Snack Swamp** | | | | | |
| 1 | Crumbs | cookie gremlin, chip freckles, a bite out of him | 80 | 3 | none (the tutorial) |
| 2 | Chiplet | potato-chip bat with ridged wings | 120 | 3 | Crunch Flurry: Snacks heal 15 |
| 3 | Gummo | wobbly gummy-bear blob | 140 | 4 | Wobble Back: regains 20 once, at half HP |
| 4 ★ | Sir Soda | soda-can knight, bottle-cap helmet, straw lance | 200 | 4 | Fizz Shield: the first 15 min each day do half damage |
| **World 2 — Burger Badlands** | | | | | |
| 5 | Fry Hydra | fry carton with three fry heads | 250 | 5 | Regrow: Meals heal 35 |
| 6 | Queso Kraken | nacho-tray octopus, cheese tentacles | 260 | 5 | Sticky Cheese: clean-day crits do 15 |
| 7 | Long Frank | hot-dog serpent in a bun | 300 | 6 (+1) | Long Haul: one extra day |
| 8 ★ | Baron Fryer | fryer-basket baron, moustache, top hat | 350 | 6 | Grease Rain: Feasts heal 90 |
| **World 3 — Sugar Peaks** | | | | | |
| 9 | Brain Freeze | ice-cream-cone yeti | 320 | 5 | Chill: the first workout each day −10 |
| 10 | Glazewing | donut dragon, sprinkle scales | 340 | 6 | Sugar Rush: Snacks heal 20 |
| 11 | Shake Ooze | milkshake slime with a bendy straw | 360 | 6 | Slurp: +5 every day without a workout |
| 12 ★ | Queen Frosting | cupcake empress, sprinkle crown | 420 | 7 | Sprinkle Storm: every splurge heals 10 extra |
| **World 4 — Feast Fortress** | | | | | |
| 13 | Taco Titan | taco giant, lettuce mohawk | 450 | 6 | Crunch Armor: workouts under 20 min do half |
| 14 | Crust Colossus | pizza-slice stone golem, pepperoni shield | 480 | 7 | Extra Cheese: Feasts heal 80 |
| 15 | Buffet Beast | four-armed chimera with trays | 520 | 7 | All You Can Eat: every splurge heals 25 extra |
| 16 ★ | The Midnight Snacker | fridge monster, bathrobe, fuzzy slippers | 600 | 7 | Late Night: splurges after 9 PM heal double |

The art is SVG, in a cartoon style:
- thick #2b1d3a outlines
- flat fills
- big eyes
- cute-menacing

The finished drawings are inlined in the Round 6 boards (Monster Book 1 and 2). Take them from there when building.

## Screens (Round 6 boards)
| Board | What it shows |
|---|---|
| `MonTitle` | Title screen: Continue run, Monster Book, Hall of Heroes, How to crush; a name picker |
| `MonMap` | World map: 16 nodes on a path, the current fight flagged |
| `MonChoose` | Choose your fight: three deadline cards with the per-day math, power-ups to bring, Fight! |
| `MonBattle` | The battle: HP bar, ticking deadline, hearts, score, ability, "So close!", battle log, power-ups, + Log activity |
| `MonLogPreview` | The real Log activity sheet with the live damage strip |
| `MonVictory` | KO, the score counting up, a trophy card, the next monster |
| `MonStrike` | Deadline missed: −1 heart, the monster back to full, rematch tips |
| `MonDefeat` | 0 hearts: run summary, Hall of Heroes placing, Start Run #N |
| `MonHall` | Hall of Heroes: all time / this month / my runs, badges |
| `MonScoring` | How to crush: every rule and number on one page |
| `MonBestiary1`, `MonBestiary2` | Monster Book: all 16, with locked teasers |
| `MonFinalBoss` | The Midnight Snacker's entrance |

## Still open (ask Matt)
- **The numbers:** monster HP, deadlines, heal sizes, starting hearts. The current values were picked for the mockups, not tuned.
- **Content after the final boss.** Options include World 5, a "New Game+" with harder monsters, or seasonal monsters. Every game effect fades in about 4–6 weeks, so plan a second wave.
- **High scores across people.** Today several users means separation, not privacy (CLAUDE.md rule 5), so a shared Hall of Heroes fits. Confirm that.
- **Backdated logs** (logging yesterday's walk today): they should count for the fight they fall in, if that fight is still open.

## Notes for building it
- **Derive, don't double-store.** The fight's HP can be worked out from the log: every activity and splurge between the fight's start and now, plus the clean days. Then editing or deleting an entry fixes the game too.
- **What to store** (new tables, per person):
  - runs: number, started, ended, score, how it ended
  - fights: monster, started, deadline, bet, result, points
  - hearts and power-ups
- **Days are the phone's dates**, sent by the page, the same as the rest of the app (CLAUDE.md rule 3). A clean-day crit and a deadline are both checked against them.
- **Deadline checks happen when the page opens or after a change**, never on a server timer. The server never works out "today" itself.
- Game mode is a per-person setting. Turning it off pauses the run and loses nothing.
