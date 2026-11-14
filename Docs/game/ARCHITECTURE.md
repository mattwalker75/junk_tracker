# Craving Crusher: how it is built

This file is the build plan. The rules and numbers come from `../GAME_MODE.md`, `LEVELS_60.md`,
`MONSTERS.md` and `levels60.json`. The mockups are canvas rounds 6 and 7. Where this plan and those
files disagree, this plan wins on *how* the game is built and they win on *what* it does.

## Big decisions
1. **The engine is pure and shared.** `shared/game/` holds plain TypeScript with no I/O:
   - `levels.ts`: the 60 levels from `levels60.json` (level, world, name, slug, hp, days, boss, ability id).
   - `abilities.ts`: one entry per monster, built from the hooks below.
   - `engine.ts`: simulates a fight from the log.
   - `score.ts`: points.

   It is unit-tested in `test/game.test.ts`. The server and the page both import it. The page uses it for live previews such as "this hits for 66" and "Fry Hydra heals +35".
2. **Settled fights are frozen; only the open fight is worked out from the log.**
   - When a fight ends (KO, or a strike when the deadline passes) the server writes its result.
   - Editing an old log entry later does not rewrite a finished fight. This is said in the guide.
   - Editing an entry that falls inside the open fight changes it right away.
3. **Reads never write** (CLAUDE.md rule 7). `GET /api/game?today=&now=` returns the view. If it finds a KO or a missed deadline that hasn't been settled yet, it says `needsSync: true`. The page then calls `POST /api/game/sync {today, now}`, which settles everything up to today: the open fight's KO or missed deadline (then the run waits between fights, below), weekly hearts and power-ups. The page also calls sync after every log save, edit or delete while game mode is open.
4. **Days and times always come from the phone** (CLAUDE.md rule 3). The server never works out "today".
5. **Each person has their own run.** Several users means separation, not privacy (rule 5), so the Hall of Heroes lists everyone's runs.

## Data (database version 4: one migration, saved first as `junk.db.before-v4`; version 5 adds `users.game_checked_on`, below)
- `splurges.planned INTEGER NOT NULL DEFAULT 0`: the **Planned treat** switch, in both the dashboard and game mode. `Splurge.planned: boolean`.
- `game_runs`:
  - `id, user_id, number` (1, 2, 3… per person)
  - `mode` ('normal' | 'hardcore')
  - `started_at` (ISO), `started_on` (day)
  - `ended_on`, `end_reason` ('defeated' | 'finished' | 'abandoned' | NULL)
  - `hearts` (start 3, max 5)
  - `shields, potions, winds` (power-up counts, max 3 each), `shield_armed`
  - `knockbacks`
  - `hardcore_dropped_on` (NULL unless a Hardcore run was switched to Normal)
  - `log_points`
  - `score`: kept up to date at every settle
- `game_fights`:
  - `id, run_id, user_id, level, attempt`
  - `started_on` (day), `started_after` (ISO or NULL; see "Which entries count")
  - `deadline_on` (day; the fight ends at midnight at the end of that day), `bet` (1 | 1.5 | 2)
  - `status` ('open' | 'won' | 'struck'), `ended_on`
  - `damage`, `heals`, `points`, `flawless`
  - `bet_locked` (set by the first attack, or at the end of the start day)
- `game_events`: `id, run_id, fight_id, day, at (ISO), kind, data_json`. Kinds:
  - `ko`, `strike`, `knockback`, `defeat`, `finish`
  - `heart` (gained), `powerup_earned`, `powerup_used`
  - `run_start`, `mode_drop`

  These feed the battle log's history lines and the Hall of Heroes.

## Which log entries count for a fight
- An activity or splurge counts for the open fight when its **day** is between `started_on` and `deadline_on`.
- If the fight began partway through a day (`started_after` is set, after a KO), an entry on that
  same day counts unless a fight before it that day **used** it (see "The KO day" under Stage 4).
  Every entry of a KO day counts for exactly one fight.
- Backdated entries count if they land inside the open fight's window. Entries in a finished fight's window are ignored.

## Order of events within a day
- Entries with a time come first, sorted by time. Entries with no time come after them, in the order they were created.
- **No time on a splurge means "assume the worst"** for time-based abilities:
  - Midnight Snacker treats it as after 9 PM.
  - Hash Hound treats it as before 11 AM.
  - Fondue Fiend treats it as within 3 h of another splurge that day.

## Attacks, heals and day effects (defaults; abilities change them)
- **Workout damage:** minutes + round(calories ÷ 10), with no cap. Minutes or calories missing count as 0. A workout with neither does 0 damage but still earns its log points.
- **Comeback:** the first workout after a calendar day with no activity does ×2 damage. This looks at the whole log, not just the fight.
- **Splurge heal:** Snack 10, Meal 25, Feast 60. A planned treat heals half, rounded up.
- **Bonus HP** (Matt, Nov 14 2026): a heal fills the HP bar first; what is left goes on as bonus HP, up to `BONUS_SHARE` (20%) of max HP (`bonusMaxOf`, rounded). Anything past that is lost. Damage takes bonus HP off before HP, so there is bonus HP only while HP is full. See "Bonus HP" under the Nov 14 decisions.
- **Clean-day crit:** a crit of 25 for every **finished** day (before today) inside the window with no splurge. A planned treat is still a splurge. It is applied at the end of that day.
- **Veggie Shield armed:** the next heal is blocked, the shield is used up, and the battle log shows it.
- **Water Potion:** using it deals 50 damage at that moment, as an event with a time.
- **Second Wind:** using it adds 1 day to the open fight's deadline.

## Ability hooks (`abilities.ts`)
```ts
interface Ability {
  id: string; name: string; text: string;            // shown in the Monster Book and the battle screen
  heal?(base: number, s: SplurgeEv, cx: Cx): number;  // each splurge
  damage?(base: number, a: ActivityEv, cx: Cx): number; // each workout (after the comeback ×2)
  crit?(base: number, day: Day, cx: Cx): number;      // each clean day
  dayEnd?(day: Day, cx: Cx): { heal?: number; damage?: number; note: string }[]; // Slurp, Sundown Howl, delayed heals
  revive?(cx: Cx): number | null;                     // HP to come back with when it would hit 0 (Slider Trio, Wingfire), once
  threshold?(cx: Cx): { heal: number; note: string } | null; // Wobble Back, Reboot, Puff Up and similar, once
  canFinish?(day: Day, cx: Cx): boolean;              // Float Bear
  noPowerUps?: boolean; noComeback?: boolean;
}
```
- `Cx` gives an ability what it needs: the fight so far (hp, max, heals and damage today, splurges today and yesterday, whether there was a workout today, the deadline's last day), plus the levels table.
- Each ability has at least one unit test.
- Where an ability's wording is unclear, choose the simplest reading and record it in `MONSTERS.md`.

## Points (`score.ts`)
- **Won fight:**
  - damage dealt, plus the monster's max HP
  - + 50 × (deadline_on − KO day), in whole days
  - + 100 if no heal landed (flawless)
  - + 500 for a boss
  - all of that × bet
- **Struck fight:** its damage only, with no bet.
- **Hardcore** (while still Hardcore): fight points × 1.25.
- **Every log entry made during the run** (activity, splurge or weigh-in, counted by when it was created): +5, no multipliers.
- **Each knock-back:** −250.
- Run score = sum of fight points + log points − knock-backs.

## Run flow (all of it in `POST /api/game/sync` and the action routes)
- `POST /api/game/run {mode, today, now}` starts run N+1 and opens fight 1: Crumbs, Steady bet, started today. If a run is still going, starting a new one ends it as 'abandoned'.
- `POST /api/game/auto {today, now}` (Keep the monsters coming, Nov 14 2026) can start the next fight or run N+1 by itself; see the Nov 14 decisions.
- `POST /api/game/next {bet?, today, now}` starts the fight that is up next (between fights); see the Nov 14 decisions.
- **KO:**
  1. Settle the fight (won, with points).
  2. A boss kill gives +1 heart (max 5) and +1 Second Wind (max 3).
  3. Until Nov 14 2026 the next level opened at once. Now the run waits **between fights**: nothing is open until `startNextFight` (by hand, or Keep the monsters coming on a later day). Started the same day, the next fight gets `started_after` = the knockout's moment, and the KO event's `used` (the day's entries the fights so far used, Stage 4) keeps each entry in one fight.
  4. After level 60: the run is 'finished'.
- **Strike** (today > deadline_on and HP > 0):
  1. Hearts −1 and the fight is 'struck'.
  2. At 0 hearts: **Normal** is a knock-back (−250, hearts back to 3, the current level goes back to the first level of its world). **Hardcore** is defeat: the run ends and its score is final.
  3. Otherwise the rematch of the same level (attempt + 1) is up next — between fights, like a KO (until Nov 14 2026 it opened the day after the deadline). A knock-back makes the world's first level the one up next.
- **Weekly heart:** a week (the person's own week start) with 5+ active days inside the run gives +1 heart (max 5) when the week ends.
- **Power-ups earned:**
  - Veggie Shield: each time clean days in a row reach 3. The count then resets.
  - Water Potion: a workout of 60+ minutes.
  - Second Wind: a boss kill.
  - Max 3 of each. Bacon Bandit's "Stick 'Em Up" blocks *using* power-ups, not earning them.
- **Mode drop:** `POST /api/game/mode {to: 'normal'}` works only from Hardcore and is one-way.

## API (behind the same login, Host guard and same-origin checks as everything else)
| Route | What |
|---|---|
| `GET /api/game?today=&now=` | everything the game screens need: run, open fight (computed: hp, max, battle log lines, deadline, ability, so-close numbers), map statuses for all 60 levels, power-ups, hearts, score, `needsSync` |
| `POST /api/game/sync` | settle KOs, strikes, weekly hearts and power-ups up to today; returns what happened (for the Victory / Strike / Knocked back / Defeated screens) |
| `POST /api/game/run` | start a run `{mode}` |
| `POST /api/game/auto` | Keep the monsters coming: the day's first look settles, then starts the next fight or run N+1 (`started`: false, "fight" or "run"; `checked`; plus the SyncResult once checked) |
| `POST /api/game/next` | between fights: start the one up next now `{bet?}` |
| `POST /api/game/bet` | `{bet}` for the open fight, while it isn't locked |
| `POST /api/game/powerup` | `{kind: 'shield'|'potion'|'wind'}`: arm or use one |
| `POST /api/game/mode` | Hardcore → Normal |
| `GET /api/game/hall` | all runs of all people: all time, this month, Hardcore, mine |

## The page
- **Routes:** `#/game` (title), `#/game/map`, `#/game/world/<n>`, `#/game/battle`, `#/game/choose`, `#/game/book`, `#/game/hall`, `#/game/how`, `#/game/start`. Results show as overlays: Victory, Strike, Knocked back, Defeated.
- **Menu:** the initials menu gets **Game mode** (gamepad icon) on tracker pages, which opens `#/game`, and **Back to tracker** on game pages, which opens `#/`. There is no separate setting. The menu item is always there, and the game's run waits until you start one.
- **Game theme:** a scoped CSS layer (`.game` root) with the mockups' palette, chunky panels and Lilita One + Nunito. The fonts are **bundled with the app**, like Caveat already is; there are no Google Fonts requests at runtime. The game has its own look in both light and dark.
- **Monster art:** `web/public/monsters/<slug>.svg`, copied from `Docs/game/monsters`, shown with `<img>`. Motion (hurt, strike, KO, gulp) is CSS. Fry Hydra has its own hurt and strike drawings; every other monster uses the generic CSS motion.
- **Logging:** one `LogSheet` and one `ActivitySheet`, each with `skin: 'tracker' | 'game'`. The fields, order and labels are identical in both skins, including Planned treat and the optional Time. The game skin adds the live damage or heal panel. Its numbers come from the shared engine, so they match what the server will do.
- **Game bottom bar:** **+ Activity (attack)** and **+ Splurge**, with no Weigh in. The tracker keeps all three.
- **Every screen** follows the matching mockup board: MonTitle, MonMap60, MonWorld2, MonChoose, MonBattle, MonLogActivity, MonLogSplurge, MonGameBar, MonVictory, MonStrike, MonKnockback, MonDefeat, MonStartRun, MonHall, MonScoring, MonBestiary1–2 and MonNewA–E. Phone first, 390 px.
- **Copy** stays kind and funny, never shaming. Every message is a plain sentence (CLAUDE.md).

## Build stages (one commit each, tests and typecheck green before each)
1. Engine, levels, abilities, DB v4, API, and Planned treat on the dashboard splurge sheet, with tests.
2. The game shell: menu switch, theme, fonts, Title, Start a run, Battle, Choose your fight, the two game-skinned sheets and the game bottom bar.
3. Map (60), World view, the Victory / Strike / Knocked back / Defeated overlays, Hall of Heroes, How to crush, Monster Book.
4. A full review and a play-through on a scratch config, then fixes, plus USER_GUIDE, CLAUDE.md rule 11 → built, and CHANGELOG.

## Decisions made while building (Stage 1, Nov 11 2026)
Where this plan left the flow open, Stage 1 took these readings. All of them are in
`shared/game/engine.ts` and tested in `test/game.test.ts`.

- **Deadline days count the start day as day 1.** For example, Crumbs started on the 10th fights
  until the 12th. A fight that begins partway through a day (after a KO) gets that part-day free, and
  its days count from the next day. Bold and Daredevil take 1 or 2 days off. Second Wind adds 1.
- **Fight 1 counts the whole start day.** Its `started_after` is NULL, so a workout logged earlier
  that day counts, and starting a run can KO Crumbs at once. Log points still count only entries
  made after the run started.
- **A KO by a clean-day crit** lands at midnight. The next fight starts the next day, with no
  `started_after`. A KO by a Water Potion uses the potion's time as `started_after`.
- **Order at the end of a finished day:** the clean-day crit first, then the monster's day-end heals.
- **"Clean day" and the comeback read the calendar, the whole log.** A splurge logged before the
  fight's part-day began still makes that day not clean.
- **Damage dealt includes overkill** (the whole hit counts toward points).
- **Flawless** means no heal landed from a splurge (or from Slurp or Sundown Howl). A heal blocked
  by a Veggie Shield did not land. A heal at full HP did. The monster's own once-only comebacks
  don't count.
- **The Veggie Shield blocks the first heal after the moment it went up.** On the same day, two
  timed entries compare by time; otherwise by when they were made. A shield that is still up when a
  new fight starts blocks that fight's first heal. Its use is stored as `powerup_used` events
  (`action: 'arm'`, then `'block'` with the heal's id), so a re-worked fight keeps the same heal blocked.
- **Power-ups at their max (3):** a fourth earned one is recorded as an event with `gained: false`
  and is not given later. Weekly hearts at 5 work the same way.
- **The Water Potion** is earned by a 60-minute workout that counts for a fight of the run, once per
  activity. It is kept even if that activity is later deleted.
- **Veggie Shield streaks** start counting again the day after the last shield earned. Editing old
  days can't earn the same shield twice.
- **Weekly hearts** are given when the week's last day is over and only for weeks with 5+ active
  days. A week that later reaches 5 through backdated entries gets its heart at the next sync. Only
  days on or after the run's start count. The week follows the person's own week start.
- **Order while settling:** hearts and shields due before a strike (up to the end of its deadline
  day) or before a KO (up to the day before) are given first, so a heart earned in time can save a run.
- **Attempt** = how many fights at that level the run has had, plus 1. That includes after a knock-back.
- **Run score** may go below 0 after a knock-back. The stored score is updated at each settle.
  `liveScore` in the view adds the log points made since.
- **A struck fight** keeps its damage points (× 1.25 on Hardcore, no bet).
- **Starting a new run** first settles the one going (so its score is current), then ends it as
  'abandoned' on the phone's today.
- **The bet locks** at the first workout or potion that does damage, or once the start day is over.
  Fights opened on a past day (rematches found late) start locked at Steady.
- **Hall of Heroes, "this month":** runs still going, or started or ended in today's month.
- **Stored order:** `game_fights` and `game_events` have a `seq` column (their order in the run),
  which the plan's column list did not name.
- **Several years away** is settled with a loop guard of 5,000 fights. (Stage 4: replaced by a bound
  in days, and the phone's day must be within 2 days of the server's.)
- **`now`** is the phone's clock ("HH:MM"). It only places a Water Potion or a Veggie Shield among
  the day's timed entries. `at` times are the server's clock, like a log entry's `created_at`.

## Decisions made while building (Stage 2, Nov 11 2026)
- **The page previews with the server's own input.** `FightView.input` is the open fight's engine
  input (its window, the log it reads, potions, shield), so the sheets run the same `preview()` the
  server would. The screen words and numbers are in `web/src/game/logic.ts` (tested in
  `test/gameui.test.ts`); the panels replace an entry being edited instead of adding it.
- **One form, two skins.** `skin` on `Sheet`, `LogSheet` and `ActivitySheet`; the form's parts
  (`Label`, `Input`, `Button`, `Toggle`, `DayPicker`…) read it from `SkinContext`, so the tracker
  skin's markup is unchanged. The game skin adds only the live panel, the heal badge under each size,
  a note under Time about time-tricky monsters and "+5 points" under Save.
- **Sync:** the page calls `POST /api/game/sync` when the view says `needsSync`, and after every
  save or delete in a game-skinned sheet. What a sync settled shows in a "What just happened" panel
  on the battle screen (stage 3 makes the big ones the Victory / Strike / … overlays). After a KO it
  links to Choose your fight.
- **Choose your fight's Veggie Shield** is put up (`POST /api/game/powerup`) when Fight! is pressed,
  after the bet. Potions and Second Winds are used on the battle screen; each power-up asks for a
  second tap there.
- **The battle screen has no Log activity button in the middle** (the mockup had one): the two
  bottom buttons do it. The mockups' "Try a…" demo buttons and the menu's "New" tag are left out.
- **Arena backgrounds** are the mockup's desert, recoloured per world (`WORLD_LOOK` in
  `web/src/game/art.tsx`). The game's CSS (`.game`, `.g-*` in `index.css`) lives in the components
  layer so Tailwind utilities still win; at night the page colour is dimmed and panels go purple.
  With reduced motion on, nothing in the game moves.

## Decisions made while building (Stage 3, Nov 11 2026)
- **Map layout is worked out, not stored.** `web/src/game/layout.ts` places the 60 nodes exactly
  where MonMap60 has them (three rows of three snaking up each 426 px band, the boss on top) and draws
  the path the way the mockup does (Catmull-Rom, 1/6 tangents). Tests check it against the mockup's
  coordinates. The world page uses MonWorld2's ten spots for every world. The scenery is the
  mockup's drawing, without its path and text, as one file (`web/public/game-map-scenery.svg`). The
  world page shows its band of that same file, enlarged. Each portrait is one `<img>`.
- **The gold trail** runs to the current fight, or to the last level beaten when no fight is going.
  After a knock-back the levels above the checkpoint are locked again (as `view.map` says).
- **Results queue** (`web/src/game/outcomes.ts`, tested): a KO is a Victory screen, and a boss's
  heart and Second Wind go on it as "Boss loot", not as toasts. Level 60's KO is the finish screen.
  A strike that took the last heart becomes Knocked back or Defeated (one screen, not two). Heart,
  power-up earned and Hardcore → Normal are toasts. Run start and power-ups *used* are not shown
  (the battle screen shows those already). The queue lives in `state.ts` and keeps the order things
  happened.
- **The battle scene plays once.** On the battle screen, the first result of a batch plays for
  1.7 s first (the KO'd monster spins with K.O.! and confetti, or the striker lunges with WHAM! while
  a heart cracks). Then its screen comes up. The ones queued behind it come up at once after
  **Next**. On any other screen, when the run has ended, or with reduced motion, a result comes up
  at once.
- **Starting a new run clears the queue** and doesn't show what settled in the old run.
- **The Victory breakdown** is worked back from the KO event's own numbers (damage, days left,
  flawless, boss, bet). Its total is the server's `points`. A Hardcore ×1.25 row shows when only
  that multiplier reaches the total. Victory shows "run score now" (the live score), not "before +
  this fight". The mockup's "honest logs" row is left out because log points aren't counted per fight.
- **Defeated screen:** "Best combo" and "Biggest hit" from the mockup are left out (the game doesn't
  keep them). It shows days of fighting and monsters beaten. The monster wears your helmet, with two
  party guests (Chiplet and Gummo).
- **Badges** (`shared/game/badges.ts`, tested) are worked out on the server from the person's stored
  fights in all their runs, and returned as `HallView.badges`. All five can be computed honestly:
  First Blood (first win), Flawless (a win with `flawless`), Daredevil (a win on bet ×2), World 1
  Clear (level 10 won), Comeback Kid (a win at a level that struck you earlier in the same run). Each
  is earned by the first fight that qualifies.
- **Hall tabs** follow the mockup's order: All time · This month · My runs · Hardcore. A run switched
  from Hardcore to Normal is listed as Normal (the server's `hardcore` flag). (Stage 4: it now reads
  "Hardcore → Normal", from `HallRun.droppedFromHardcore`.)
- **How to crush** takes every number from the engine (`HEAL`, `CRIT`, `POTION_*`, `SHIELD_STREAK`,
  `WEEK_ACTIVE_DAYS`, `POINTS`, the heart limits, `betDays`, `wonPoints`). Its examples use the
  monster you're fighting, or Crumbs before a run.
- **Bios** for all 60 are the approved boards' lines (MonBestiary1–2, MonNewA–E), in
  `shared/game/bios.ts`.
- **Monster Book:** monsters up ahead show their full drawing with "Up ahead · Level N" (Matt wants
  to see the art). Their HP, deadline and ability are shown too, rather than the old "???".
- **Map links:** the title screen has an **Adventure map** button, and the battle screen's header has
  a map button. The battle header's kicker drops "CRAVING CRUSHER ·" to make room.
- **Finish and Defeated** have a plain **Close** as well as "Start Run #N", so you can look at the
  map or the Hall first.


## Decisions made while building (Stage 4, Nov 11 2026: the review fixes)
- **The KO day.** Within a day a fight reads entries in its own order (timed ones by time, then the
  untimed ones by when they were made). The next fight's cut used to be the KO entry's *created*
  time, which is a different order: an entry could count for two fights or for none. Now the KO
  event stores `used`: the ids of that day's entries the fights so far used, in the fight's own
  order, up to and including the knockout (a potion KO: the entries before the potion). The list
  grows through the day (fight 3's KO keeps fight 2's list too), so a workout can't come back for
  the monster after next. The next fight counts a KO-day entry **if it isn't in that list**, so:
  - an entry that sorted after the knockout counts for the next monster;
  - one logged later with an earlier time (the KO'd fight is frozen) also counts for the next one;
  - one the KO'd fight read never counts again.
  A KO by a clean-day crit or a monster's day-end trick lands at midnight: the next fight starts the
  next day with no split. Fights stored before `used` existed fall back to the created-time cut.
  `FightInput.usedBefore` carries the list to the engine (and to the page's previews).
- **The phone's day must be within 2 days of the server's own UTC date.** It is a sanity bound,
  not working out "today" (time zones put the two a day apart): a phone set to 2200 would otherwise
  settle 170 years of missed deadlines in one sync. The refusal says "Your phone's date looks
  wrong…". `Game` takes the server's day as a function, so tests pass a fixed one.
- **Settling is linear in days.** `award` (weekly hearts, Veggie Shields) is an `awarder` made once
  per settle that carries on from where its last call stopped, instead of rescanning from the run's
  start for every fight. The loop is bounded by 61 passes per day since the open fight began.
- **Log points of an ended run** count only entries on or before its last day (`GameLog.entryDays`):
  something logged after a defeat but before the next sync is not part of the run.
- **Weekly hearts never pay the same days twice.** A week that overlaps one already given a heart is
  skipped, so changing the week start mid-run can't give a second heart for those days.
- **A Veggie Shield whose blocked heal no longer counts** (the splurge was deleted, or moved out of
  the fight) goes back up from where it went up: a `powerup_used` event with `action: 'back'` (and
  the original point in `from`), so the next heal is blocked instead. With nothing to block it stays
  up, into the next fight too.
- **Results survive a reload.** `state.ts` keeps, per person in localStorage
  (`jt-game-seen:<person id>`, every access in try/catch), the newest event they are done with:
  while a result waits, that is the event just before it. On load the queue is rebuilt from
  `view.events` newer than that. With nothing stored (the first time on this browser), old history
  isn't replayed; the newest id is only noted. The queue and toasts are one person's: a different
  person on the game page (Switch to, signing in as someone else) starts with an empty queue.
- **Starting a run** tells what happened after its own `run_start` (fight 1 counts the whole of
  today, so earlier workouts can KO Crumbs at once: the Victory comes up), and the "Run #N begins!"
  splash shows the monster the run is really on (`view.fight`). Ending a run that is still going
  takes a second tap: "End Run #N? It can't be brought back."
- **Tracker logs reach the game.** `LOG_KEYS` includes `["game"]` and `["game-hall"]`, so any log
  change refetches the game the next time it shows (and that view's `needsSync` runs the sync).
  One auto-sync at a time, however many screens read the view. A game change drops any read still
  in flight, so an older view can't come back over it.
- **Deadline wording.** A fight ends at midnight at the end of its last day (a log at 23:59 still
  counts), shown as "Due end of Sat Nov 14". The countdown counts to that midnight, and every screen
  (battle, map flag, Monster Book) uses the countdown's own words ("3 days 1 h left").
- **Previews** stamp a new entry after the newest server time in the fight's input (an entry, a
  potion, the shield going up, the fight's start), so a phone clock behind the server previews it
  in the order the server will use.
- **Phones narrower than 390 px:** the map and the world page are drawn at 390 and scaled to fit;
  the NOW flag anchors on its node's side so it never runs off the edge. Above 3 hearts, the battle's
  top row and the map's bar show one heart × N, and below 370 px the battle drops the word SCORE.
- **Small ones:** "Back to tracker" on a Strike closes that one and keeps the rest of the queue; the
  results overlay keeps Tab inside it; the "Run #N begins!" splash is a dialog with a button (Enter
  or Esc to go on); the Hall's date lines are #6b587d (about 5.6:1 on the cards, which are the same
  in both themes); only the deadline panel ticks each second; `#/game/<anything else>` (even
  `toString`) is the title screen.

## Decisions made while building (Nov 14 2026: bonus HP and Keep the monsters coming)
Matt asked for two things: a splurge at full HP should still cost something, and a setting that
keeps a monster going every day without tapping Start a run.

**Bonus HP** (`simulateFight`'s `heal()` and `hit()` in engine.ts)
- **Overflow, not a flat 20%.** A heal past full goes on as bonus HP, up to 20% of max HP. Matt said
  "maybe 20% bonus health". A flat +20% per splurge would make a Snack at full HP cost a boss 256
  (20% of 1,280), more than a Feast heals. Overflow keeps "splurge size sets the heal" and makes 20%
  the cap of the violet bar he described.
- **Every heal that "lands" can go into bonus HP:** a splurge, its "then N more the next day" part,
  and the day-end heals (Slurp, Sundown Howl). The monster's own comebacks (Wobble Back, Reboot,
  Brother Act, Rise Again) stay capped at max HP, as before.
- **Damage takes bonus HP off first.** So bonus HP > 0 only while `hp === max`. The abilities' HP
  checks (half, a quarter) read `hp` alone, so bonus HP never moves them.
- **The whole hit counts as damage dealt**, bonus HP included, so the points still add up.
- **"HP left" includes bonus HP** everywhere it means "what you still have to beat": `finish`, the
  strike event's `hpLeft`, `preview().change`, "So close!", the map and the book, and `betPlan`.
  `FightView.hp` stays the HP bar; `bonus` and `bonusMax` sit beside it.
- **Battle line:** `amount` is the whole heal and `bonus` is the part that went on as bonus HP. The
  text ends with `bonusNote()`, which the heal panel strips before it reads the ability's name.
- **Already-settled fights are untouched** (frozen). The open fight is worked out again from the
  log, so a splurge at full HP logged before this change now gives that fight bonus HP.
- **The page:** `HpBar` (parts.tsx) draws orange up to max HP, then bonus HP as a violet (`#a35cff`)
  bar laid over it from the left (20 bonus on 100 HP covers a fifth). A preview stripes the part of
  either bar that would change. `hpText` gives "250 / 250 +20"; `hpShort` gives "250+20" for "before → after".

**Between fights** (Matt, Nov 14 2026, the same day: "I do NOT want a new monster to automatically
start the exact same day you just defeated one")
- `settle()` no longer opens a fight after a KO or a strike. `pendingLevel(st)` is the level up next
  (KO → level + 1; strike → the same; knock-back → the world's first); `GameView.next` describes it
  (with its three deadline cards for a start now), and `fight` is null.
- **`startNextFight(st, log, clock, bet, auto)`** opens it today and settles at once (today's
  unused entries may knock it out). After a KO **today** with a moment (`ko.data.used`), it gets the
  rest of the day: `started_after` = the KO's `at`, so `usedBeforeOf` and the KO-day rule still
  give each entry to one fight, and the deadline counts from tomorrow. Otherwise the whole of today,
  day 1 = today (like fight 1 of a new run). A `fight_start` event (`data.auto` when started by
  itself) records it.
- Between fights nothing hits or heals anything. Weekly hearts, Veggie Shields and log points still
  accrue. A strike happens only to an open fight, so a long time away costs one heart at most.
- The page: the battle screen's `Between` view (plays the KO / strike scene first), Choose your
  fight's "Start the fight!", the title's "Up next", the map's and the book's Start buttons, and a
  *No monster right now* note in place of the live panel in the game-skinned sheets.

**Keep the monsters coming** (`UserSettings.autoStart`, `Game.auto`, `dailyCheck` in state.ts)
- **What it starts:** the next fight when the run is between fights, or run N+1 when no run is going.
- **Once a day per person, on the server.** `users.game_checked_on` (database version 5) is the
  phone day the look was last taken. The first `POST /api/game/auto` of a day takes it (whichever
  phone sends it); later ones that day do nothing. With the setting off, nothing is stamped
  (`checked: false`), so turning it on later the same day still works.
- **It settles first, then decides.** Between fights, the next fight starts only if the last fight
  ended **before today** (`lastEndedBefore`): a KO logged this morning from the tracker, found by
  this very look, means nothing starts until tomorrow. A new run starts only if the run had already
  ended before this look (as stored); a run that ends in this look gets its Defeated or finish
  screen, and the new run starts the next day. What the look settled comes back in `happened`
  and is told as usual (the page pushes it), so the auto start never hides a result.
- **Mode:** the latest run's mode. A run dropped from Hardcore is Normal; the first run is Normal.
- **The page asks before the first game read of each day.** `useGame`'s query runs `dailyCheck`
  first, once per person and day per page load, forgotten when `checked` is false or the call fails.
  So the first view already shows the new run and the sync never races it. A started run is told
  like Start a run (`startedRun`), plus the `run_start` event (`data.auto`) as a toast; a started
  fight's `fight_start` (`data.auto`) is a toast too (`planResults`). Tracker
  pages (`useGame(false)`) never ask.
