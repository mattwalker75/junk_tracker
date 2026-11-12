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
3. **Reads never write** (CLAUDE.md rule 7). `GET /api/game?today=&now=` returns the view. If it finds a KO or a missed deadline that hasn't been settled yet, it says `needsSync: true`. The page then calls `POST /api/game/sync {today, now}`, which settles everything in a loop: KO → next fight, strike → rematch, … up to today. The page also calls sync after every log save, edit or delete while game mode is open.
4. **Days and times always come from the phone** (CLAUDE.md rule 3). The server never works out "today".
5. **Each person has their own run.** Several users means separation, not privacy (rule 5), so the Hall of Heroes lists everyone's runs.

## Data (database version 4: one migration, saved first as `junk.db.before-v4`)
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
  - `deadline_on` (day; the fight ends at 23:59 that day), `bet` (1 | 1.5 | 2)
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
- If the fight began partway through a day (`started_after` is set, after a KO), an entry on that same day counts only if it was **created** after `started_after`.
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
- **Splurge heal:** Snack 10, Meal 25, Feast 60. A planned treat heals half, rounded up. Healing is capped at max HP.
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
- **KO:**
  1. Settle the fight (won, with points).
  2. A boss kill gives +1 heart (max 5) and +1 Second Wind (max 3).
  3. Open the next level at once: same day, `started_after` = when the knockout entry was created, Steady bet. The player can change the bet on **Choose your fight** until the first attack lands or the start day ends.
  4. After level 60: the run is 'finished'.
- **Strike** (today > deadline_on and HP > 0):
  1. Hearts −1 and the fight is 'struck'.
  2. At 0 hearts: **Normal** is a knock-back (−250, hearts back to 3, the current level goes back to the first level of its world). **Hardcore** is defeat: the run ends and its score is final.
  3. Otherwise there is a rematch of the same level, attempt + 1, starting the day after the deadline, Steady bet.
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
- **Several years away** is settled with a loop guard of 5,000 fights.
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
