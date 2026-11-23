# CLAUDE.md — working on Craving Crusher

**Names** (Matt, Nov 14 2026): the app is **Craving Crusher** (it was Junk Tracker) and its game mode
is **Calorie Crusher** (it was Craving Crusher until then). Only the names people see changed: the
folder, `TRACKER.sh`, `INSTALL_APP.sh`, `JT_*` variables, `junk.db`, the package name and the health
route's `"app":"junk-tracker"` stay as they are, so stop → git pull → start keeps working.

Read this before changing anything. `Docs/DEVELOPMENT.md` has the detail.

## What it is
A phone-first web app that tracks junk food ("splurges"), weight and activity, and nothing else. Runs on
Matt's Mac (or Mac mini over Tailscale), used in a phone browser. Server: Node 22.12+ / Express 5 /
TypeScript / better-sqlite3. Page: React 19 + Vite + Tailwind v4 + Radix Dialog + TanStack Query.
The person using it is not a developer — every message the page shows is a plain sentence.

## Map
- `server/src/log.ts` — splurges, activities and weigh-ins (all checks, the overview); `goals.ts` — each
  person's goal list (the top open goal is on Home); `users.ts` — people,
  passwords, sessions, Switch to, per-person settings; `app.ts` — routes and guards;
  `config.ts` — config.json; `settingsSchemas.ts` — what Settings may save, checked; `security.ts` — Host
  guard, same-origin writes; `migrations.ts` — the tables, as numbered steps (`PRAGMA user_version`);
  `db.ts` — opens the file, keeps the copy before an upgrade and runs the steps.
- `shared/types.ts` — the data model used by both sides; `shared/reminders.ts` — when a reminder is due (pure).
  `web/src/lib/health.ts` — bringing in workouts from the phone's health app (rule 15). `shared/game/` — Calorie Crusher's pure engine
  (levels, abilities, fights, points; tested in `test/game.test.ts`); `server/src/game.ts` stores runs.
- `web/src/components/Home.tsx` (home), `GoalNote.tsx` (the sticky note on Home), `UserMenu.tsx`
  (the initials menu), `GoalsPage.tsx`, `GoalSheet.tsx`, `LogSheet.tsx`, `ActivitySheet.tsx` (Log activity), `WeighSheet.tsx`,
  `DaySheet.tsx`, `CalendarPage.tsx`; `web/src/settings/` — Settings pages; `web/src/lib/stats.ts` — the numbers
  on the home screen (pure, tested).
- `APP_PORTS/` — the iPhone and Android apps (`ios/`, `android/`, each with `BUILD_APP.sh`) and what both run
  (`shared/`); never built by `TRACKER.sh`. `APP_PORTS/README.md` says how they work (rule 14).

## Rules that exist for a reason
1. **Matt's chosen design** (mockups artifact JaQKDBbcdYyzDybDBx2eXS, round 2 "E/F"): home =
   big *Days clean* tile + *This week* + *30 days*, the *Last 14 days* strip coloured by size with
   a Calendar button (Matt, Nov 14 2026: the whole card is it; a day still opens that day), the weight card (current, change over the trend period, 7-day average,
   sparkline), the big buttons at the bottom (**+ Splurge**, **Weigh in** — and since rule 10,
   **+ Activity** between them). The *Log a splurge*
   sheet was approved as mocked. Keep it. Phone first: check every change at 390px wide.
   **Goals** (round 3, Oct 26 2026): Matt picked **G3, the sticky note** — the goal now, in
   handwriting (Caveat, bundled), at the very top of Home, always there when a goal is set, with
   Done. The initials button opens a menu: **Goals**, **Settings**, **Sign out** (only with
   sign-in on) — there is no separate sign-out button. The Goals list (Now / Up next with up and
   down / Add a goal / Done) and the Add a goal sheet were approved as mocked.
2. **Spec decisions:** a splurge needs only *what* and *size*; sizes are **Snack / Meal / Feast**
   (default examples a candy bar / burger & fries / a whole pizza; each person can write their
   own in Settings, shown under the size buttons); a day's colour is its biggest splurge;
   weigh-ins are optional and **one per day** (saving again replaces it); stored in pounds, shown
   in lb or kg; trend period 1 week / 2 weeks / month.
3. **Days are the phone's local dates** (`YYYY-MM-DD`), sent by the page — the server never works
   out "today" in its own time zone (`/api/overview?today=`).
4. **It starts with no login and one person** (Matt, Oct 16 2026 — like ai_trading_desk and
   people_manager): first open makes "Me" (no password) and goes straight to Home; no setup
   screen. **Users and sign-in** is ONE switch (`/api/auth/enable` asks for your name + password,
   `/api/auth/disable` needs TURN OFF and only one user left, then clears the password);
   `security.loginEnabled` cannot be set through `PUT /api/settings`. Adding users needs it on.
   The setup screen only appears if config.json turns the login on with no passwords.
5. **Several users = separation, not privacy**: every person can add users, set anyone's
   password, rename, Switch to anyone (a strip says whose log is on screen) and remove others.
   Matt rejected a fixed "2 people" setting — it is a Users table, shown only with sign-in on.
   A new password signs that person out everywhere (session carries a tag of the hash); your
   own change keeps you signed in.
6. **Host guard + same-origin writes** stay on: unknown Host → 421, cross-site writes → 403.
   Tailscale names go in `server.extraHosts`.
7. **Goals:** a list per person; the first open one is the goal now. A goal's days (no end, 1
   week, 2 weeks, 1 month) count from the day it reaches the top (`started_on`, the phone's day);
   one moved off the top starts over — so only one goal is ever really active (Matt, Oct 26 2026).
   A goal says up to `GOAL_MAX` (300) characters; the note's handwriting size comes from
   `goalFontPx` (36 → 31 → 26 → 22 → 19 px by length; Matt, Nov 9 2026), both in `shared/types.ts`.
   Day 1 is set by the changes (they carry `today`), never by a GET: reads must not write. When its time is up the note asks "did you do it?" — Yes,
   done, or Keep going (no end date). Nothing is ever checked off for the person.
8. **Updating is stop → git pull → start** (Matt, Oct 26 2026: his real data is on another
   computer). `--start` reinstalls packages when the packages in `package-lock.json` differ from the
   ones installed (`node_modules/.package-lock.json`; not file dates — and the old packages are put back
   if the install fails, so it still starts with no internet) and rebuilds when the code changed; a
   database upgrade first saves `junk.db.before-v<N>` (N = the new version). Keep it that way: no update
   step that needs anything else.
9. **Settings marked "after a restart"** (port, network access, sign-in length, database path)
   are listed in `RESTART_REQUIRED` in `config.ts`; the page says to run `./TRACKER.sh --restart`.
10. **Activity** (round 4, Matt, Nov 9 2026; mockups ActHomeCard = H1, LogActivity, DayActivity):
    an activity needs only *what*; how long and calories burned are optional (How long is typed
    as minutes `90` or h:mm `1:30` — `parseDuration` in `web/src/lib/stats.ts` — and saved as minutes); the
    Day picker is the splurge one, plus a time that starts at now; **any number a day** (only
    weigh-ins are one a day). Six quick picks (default Walk, Run, Bike, Gym, Swim, Yoga) are
    per person in Settings → You (`quickPicks`, six strings, `""` = default). Home keeps
    everything and adds the **Activity this week** card (renamed Nov 14 2026; tapping it opens the week
    in detail, `WeekSheet.tsx`) above the 14 days (days active of 7 from the
    person's week start — a day counts once; minutes and calories add up every activity, calories
    only from those that say; last activity; seven dots); active days get a green notch under the
    date on the strip and in the Calendar (the day's text colour on Meal/Feast); THREE buttons at
    the bottom (**+ Splurge · + Activity · Weigh in**). The day sheet lists activities (Edit,
    Delete) after the splurges, with **+ Splurge / + Activity**; the Splurges / Activity headings
    show the day's calories eaten / burned when any entry has them. Colours: the `active*` tokens.
    Not yet: goals that count activity (Matt: later).
11. **Game mode — built** (Matt, Nov 11 2026): **Calorie Crusher** (named Craving Crusher until Nov 14), a monster battle made from the
    person's own log, opened from the initials menu (**Game mode** / **Back to tracker**). What it does:
    `Docs/GAME_MODE.md`; how it is built and every reading taken: `Docs/game/ARCHITECTURE.md`; mockups
    are canvas rounds 5–7. Keep these:
    - **Same fields in both skins:** the game's Log a splurge / Log activity are the tracker's sheets
      (`skin="game"`), same fields, order and labels; the game only adds the live panel. No Weigh in.
    - **Game visuals stay in the game** (Matt, Nov 12 2026): on tracker pages the sheets never show a
      monster or panel (`useGame(false)` returns nothing). **When the app opens** (`openIn`, Settings →
      You) sends a front-door open to `#/game`; a `#/…` address always wins.
    - **GET never writes:** `GET /api/game` says `needsSync`; only `POST /api/game/sync` (and the
      action routes) settle and store.
    - **The battle log** is newest first, in the order things happened (Matt, Nov 14 2026): an entry's
      time, or when it was logged (`BattleLine.at`); `battleLog()` in `logic.ts` orders it — the engine's
      own order (untimed entries after timed ones) is unchanged.
    - **Settled fights are frozen:** editing old entries never rewrites a won or struck fight; only
      the open fight is worked out from the log. On a KO day each entry counts for exactly one fight.
    - **Today comes from the phone** (rule 3); the server only refuses a day more than 2 days from
      its own date ("Your phone's date looks wrong").
    - The engine (`shared/game/`) is pure and shared by the server and the page; the tracker's log is
      never changed by the game.
    - **Bonus HP** (Matt, Nov 14 2026): a heal past full HP goes on as bonus HP (a violet bar over the
      HP bar), capped at 20% of max HP; damage takes it off first. "HP left" counts it.
    - **A strike adds a day** (Matt, Nov 15 2026): a missed deadline costs a heart and the SAME fight
      goes on one more day with its HP as it was; each further missed day costs another heart. Only
      the last heart ends the fight (knock-back on Normal, defeat on Hardcore). No rematch at full HP.
      The bet stays (Matt, Nov 15 2026): a Bold or Daredevil fight that strikes keeps its ×1.5 / ×2 —
      paying a heart for the day back is the price. Don't "fix" it.
    - **Extra lives** (Matt, Nov 15 2026): Normal runs only — one for every 20 monsters beaten in the
      run (`LIFE_EVERY`), 2 held at most (`MAX_LIVES`). At 0 hearts a life is spent by itself in place
      of the knock-back: 3 hearts, no points lost, and the same monster is up for a rematch at full HP
      with its full time. No life left: knock-back to the world's first level. Hardcore: never a life.
    - **120 levels, 12 worlds** (Matt, Nov 21–22 2026; `Docs/GAME_MODE.md` "Growing to 120 levels"): worlds 7
      Freezer Tundra, 8 Concession Canyon, 9 Brunch Boulevard, 10 Takeout Temple, 11 Deep-Fry Volcano, 12 Calorie
      Cosmos; The Snackularity (120) is the final boss. Never hard-code a level count: use `LEVEL_COUNT` /
      `WORLDS.length`. The database allows levels to 120 (`PLANNED_LEVELS`). A run that finished before the game
      grew carries on (`run_continues`). The map's picture (`web/public/game-map-scenery.svg`, 5,216 tall) is drawn
      for 12 bands; a world added later would need its band on top (everything else moves down 426) and its
      `WORLD_LOOK` / `WORLD_MAP` colours in `art.tsx`.
    - **Monster moves** (Matt, Nov 22 2026; `Docs/GAME_MODE.md` "Monster moves"): every monster moves — its own idle,
      takes-a-heart, defeated and beats-you moves (`web/src/game/moves.ts`, drawn by `monster-moves.css`, played by
      `LiveMonster.tsx`, which puts the SVG inline). Each drawing's parts are tagged (`cc-fig`, `cc-arm-l/r`, …, each
      with a pivot) and must look exactly the same when still. A new monster needs its parts tagged and its mix
      in `moves.ts` (`test/moves.test.ts`). Reduced motion stops them all.
    - **Monster toughness** (Matt, Nov 15 2026): Settings → You, Standard ×1 / Tough ×1.5 / Brutal ×2
      HP (`toughness`); deadlines unchanged. A fight keeps the multiplier it started with
      (`game_fights.hp_mult`); the person may change the setting at any time and it only counts for
      fights started after. Never use `levelInfo().hp` for a real fight: `monsterHp(level, hpMult)`.
    - **Between fights** (Matt, Nov 14 2026): a KO or a knock-back never opens the next fight by itself; it
      waits for **Start the next fight** (`POST /api/game/next`) or Keep the monsters coming. With no
      fight open, entries hit and heal nothing.
    - **Keep the monsters coming** (`autoStart`, Settings → You, off by default): the first game open of
      a day (once a day per person, on the server) starts the next fight — never on a day one went
      down — or a new run when the last one had already ended.
12. **Reminders** (Matt, Nov 21 2026): Settings → You has a **Weigh-in reminder** and an **Activity
    reminder**, independent, each on/off with its own days (`weighReminder(Days)` / `activityReminder(Days)`,
    defaults ON with 7 / 3, 1–60 — `REMINDER_DEFAULT_DAYS` in `shared/types.ts`). Due = nothing logged today or
    on the N − 1 days before (`shared/reminders.ts`, pure; never logged = counted from the day the person was
    added — that day as the phone saw it, from `&tz=`, the phone's time-zone offset). `GET /api/reminders?today=&tz=` reads only. The window (`ReminderWindow.tsx`) comes up when the app
    opens (page load, or back after 30+ min away; not on Switch to) and closes ONLY with its Close button —
    Matt wants it acknowledged. Don't make it dismissable by a tap outside or Esc.
13. **App icon + home screen** (Matt, Nov 21 2026): ONE drawing, `Docs/icon/icon.svg` (full square, no
    transparency, picture inside the middle 80% circle), makes every icon file via `node scripts/make_icons.mjs`
    (headless Chrome; writes `web/public/apple-touch-icon.png`, `icon-192/512.png`, `icon-maskable-512.png`,
    `icon.svg` and `Docs/icon/icon-1024.png` — all committed, rule 8). The name under the icon is exactly
    **Craving Crusher** (`apple-mobile-web-app-title` in `web/index.html`, `name`/`short_name` in
    `web/public/manifest.webmanifest`). Never hand-edit the PNGs; change the drawing and rerun. Options: `Docs/icon/options/`.
    The phone apps' icons (`APP_PORTS/ios/…/AppIcon.appiconset/icon-1024.png`, `APP_PORTS/android/…/cc_icon.png`) are
    written by the same script.
14. **Phone apps** (Matt, Nov 21 2026: "standalone, data on the phone"): `APP_PORTS/ios` and `APP_PORTS/android` are
    the web app's page inside a native shell, with the log kept on the phone (one SQLite file; no server, no
    sign-in, one person). The page's `/api` calls are answered in the page by `APP_PORTS/shared/src/backend.ts`,
    which runs the server's OWN `log.ts` / `goals.ts` / `game.ts` / `users.ts` on sql.js — so keep those free of
    Node-only code (they only take `type Database`), keep the tables in `server/src/migrations.ts` and the
    settings checks in `server/src/settingsSchemas.ts`, and when a route changes in `app.ts` change `backend.ts`
    too (its test fails when a call in `web/src/lib/api.ts` has no answer). The page knows it's in the app only
    by `PHONE_APP` (`web/src/lib/phone.ts`: Settings hides Users and sign-in and Network access). **The phone apps
    are single-user, with no sign-in of any kind** (Matt, Nov 22 2026: "does not require ANY multi-user functionality
    or require any forms of signing in" — ONLY the iPhone/Android apps; the web app keeps all of it): no sign-in or
    setup screen, no Switch to strip, no Users list, and the Hall of Heroes lists only your own runs (no names, no
    My runs tab). Every app change also keeps the phone apps in step: phone tests, a new migration run on the
    phone, both apps rebuilt. Build with
    `APP_PORTS/<platform>/BUILD_APP.sh` (`--check`, `--run`, …); its `BUILD/` and the built page are never
    committed, nor signing keys. Not yet: moving a log between the phone and the web app.
    **The phone's log is never lost** (review, Nov 22 2026; `APP_PORTS/shared/src/open.ts`, tested in
    `APP_PORTS/shared/test/keeping.test.ts` and the recovery/damage tests beside it): a save the phone can't make is
    undone in the page at once (the screen shows only what was kept); a log file that can't be read stops the app
    with the reason and is never replaced by a new empty one; a damaged one (it won't open, or `quick_check` finds
    damage anywhere) is moved to `junk.db.damaged` and a whole `junk.db.prev` (the file before the last save) is
    opened, with a notice; no `junk.db` but a whole `junk.db.prev` (a recovery cut short) opens the backup, never a
    new log; opening an older log upgrades it and keeps the older one for good as `junk.db.before-v<N>`, N the new
    version — the same name as the web app's copy (Matt, Nov 22 2026: "whatever best practices are used"). **Updates install over the old app:** build numbers come from the version (1.11.0 → 11100), never a
    commit count; the Apple team id lives in the untracked `ios/CravingCrusher/Local.xcconfig` (`--team <id>`),
    never in `project.pbxproj`.
15. **Workouts from the phone's health app** (Matt, Nov 22 2026; canvas round 17, boards H1–H6): the iPhone app reads
    **Apple Health**, the Android app **Health Connect** — READ ONLY, workouts and the calories each burned, never steps.
    Settings → You (phone apps only) turns it on; then workouts come in **by themselves** each time the app opens or
    comes back (`web/src/lib/health.ts`), the first time from the last 7 days (`HEALTH_FIRST_DAYS`), after that up to
    30 days back. Each workout is taken once (`health_imports`, database version 8): an edit stays, a delete never comes
    back; one is skipped as the same one when an activity logged by hand that day has its time from 30 minutes before
    the workout's start to 30 minutes after its end (Log activity's time starts at now) or, untimed, its name
    (`HEALTH_SAME_MINUTES`), or when one brought in from another app overlaps it (`sameWorkout` in log.ts). The game
    screen waits for a bring-in that is running before it settles (`workoutsIn`), so last night's run counts before
    a missed deadline does. Imported activities carry `source` and show a tag; they count in the
    game like any activity. The shells: `APP_PORTS/ios/CravingCrusher/Health.swift` (HealthKit; `--health off` builds
    without it if Apple won't give the team HealthKit) and `APP_PORTS/android/…/HealthBridge.kt` (Health Connect; the
    builds you install only READ — write permissions only in the `CC_HEALTH_TEST=1` test build). Nothing reaches the
    network (Android still has no INTERNET permission).

## Working rules
- Commit locally per feature with a dated CHANGELOG entry; `git add` explicit paths.
  **Never push — Matt pushes.**
- Never touch Matt's real `config.json` or `data/` — and **never delete `data/`** in the repo (Oct 16 2026:
  a scratch-test cleanup `rm -rf data` deleted the database Matt had just started using). Try things with a scratch config:
  `JT_CONFIG=/some/scratch/config.json ./TRACKER.sh …` (and `JT_NO_OPEN=1` to skip the browser).
- `npm test` (vitest) and `npm run typecheck` must pass before a commit; so must the phone code's
  (`npx vitest run --config APP_PORTS/shared/vitest.config.ts` and `(cd APP_PORTS/shared && npx tsc -p tsconfig.json --noEmit)`).
