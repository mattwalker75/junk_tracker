# Craving Crusher — development

## Layout
```
server/src/   index.ts (listen) · app.ts (routes, guards) · config.ts · settingsSchemas.ts (what Settings may save)
              security.ts · util.ts (checks, plain errors, atomic writes)
              migrations.ts (the tables, as numbered steps) · db.ts (opens the file, the copy before an upgrade)
              users.ts (people, sessions, settings) · log.ts (splurges, activities, weigh-ins, reminders, Home's
              overview, workouts from the phone's health app) · goals.ts (each person's goal list)
              game.ts (Calorie Crusher: loads a run, calls the engine, stores what it settled)
shared/       types.ts — the data model both sides use · reminders.ts — when a reminder is due (pure)
              game/ — Calorie Crusher's pure engine: levels, abilities, engine (fights, settling a run,
              the view), score, badges, bios, days
web/src/      App.tsx · components/ (Home, GoalNote, UserMenu, GoalsPage, GoalSheet, LogSheet, ActivitySheet, WeighSheet,
              DaySheet, DayPicker, WeekSheet, CalendarPage, AuthScreen, SwitchedStrip, ReminderWindow, HealthAutoImport,
              PhoneNotice, ui) · fonts/ (Caveat, the goal note's handwriting; Lilita One and Nunito, the game's)
              settings/ (You, Appearance, Users, Sign-in, Network, HealthCard) · lib/ (api, actions, dates, stats, theme,
              route, useToday, phone — `PHONE_APP` and the phone's health app, health — bringing workouts in)
              game/ — the game's screens (TitleScreen, StartRun, Battle, Choose, Map, Hall, How, Book, Results, Panels,
              GamePage), art.tsx + parts.tsx + icons.tsx (drawings), LiveMonster.tsx + moves.ts + monster-moves.css +
              inlineSvg.ts (monster moves), state.ts (the view, the sync, the results queue), logic.ts + layout.ts +
              outcomes.ts (pure)
web/public/   monsters/ (the 120 drawings, plus Fry Hydra's hurt and strike), game-map-scenery.svg, the icons, manifest
test/         api.test.ts (the server, end to end, game routes included) · stats.test.ts (home-screen numbers)
              game.test.ts (the engine: every ability, settling, points) · gameui.test.ts (logic.ts)
              game3.test.ts (bios, badges, map layout, results queue, routes) · moves.test.ts (every monster's moves
              and its tagged parts) · reminders.test.ts · health.test.ts (workouts from the phone's health app)
              engine-fuzz.test.ts (random play-throughs) · server-review, shield-review, game-results-review,
              game-screens-review (the Nov 22 2026 review's fixes) · helpers.ts
APP_PORTS/    the iPhone and Android apps and the code both run (shared/, with its own tests): APP_PORTS/README.md
scripts/      make_icons.mjs — every icon file from Docs/icon/icon.svg
```
The game's rules and every reading taken while building it are in `Docs/game/ARCHITECTURE.md`.
`npm run build` → `dist/node` (tsc) and `dist/web` (Vite). The server serves `dist/web`.

## Commands
```bash
npm test                 # vitest: 418 tests (FUZZ_RUNS=300 npm test for the full random play-through)
npm run typecheck        # server + page
npx vitest run --config APP_PORTS/shared/vitest.config.ts      # the phone code: 20 tests
(cd APP_PORTS/shared && npx tsc -p tsconfig.json --noEmit)     # the phone code's typecheck
./TRACKER.sh --dev       # live-reloading page on :5173, API proxied to the server port
./TRACKER.sh --fg        # run the built app in the foreground
```
The phone apps are built with `APP_PORTS/ios/BUILD_APP.sh` and `APP_PORTS/android/BUILD_APP.sh`, never by
`TRACKER.sh` (`APP_PORTS/README.md`).
Use a scratch config so nothing real is touched:
```bash
JT_CONFIG=/tmp/jt/config.json JT_NO_OPEN=1 ./TRACKER.sh --start
```
Relative paths in a config (the database) are from that config file's folder.

**Testing the game.** The engine is pure, so most of it is unit tests (`test/game.test.ts`: build a
`RunState` with `newRun`, a `GameLog`, a clock with the phone's day, then `settle`/`buildView`). The
server's game routes refuse a `today` more than 2 days from the computer's own date, so the API
tests pass a fixed one: `scratch({}, { serverDay: () => "2026-11-12" })`. To play it for real, run
a scratch config as above and open `#/game`; to see a strike without waiting days, move the open
fight back in the scratch database (`started_on`, `deadline_on`) and log splurges on those days.

## Updating a copy that is in use
```bash
./TRACKER.sh --stop && git pull && ./TRACKER.sh --start
```
`--start` installs the packages again (`npm ci`) when the packages in `package-lock.json` differ from npm's
own record of what it installed (`node_modules/.package-lock.json`) — a package's version, or one added or
removed; file dates and the lockfile's own version line don't count. The old `node_modules` waits as
`node_modules.before-install` and is put back if the install fails (no internet), and the app starts on it.
Then it rebuilds when any source file is newer than the last build (`dist/.built`), and the server upgrades
the database itself — saving a copy first (below).

## config.json
Created from `config.example.json` on first start. Settings edits the same file.

| Key | Default | Notes |
|---|---|---|
| `server.port` | 8420 | after a restart |
| `server.allowNetwork` | false | false = 127.0.0.1 only; true = every interface. After a restart |
| `server.extraHosts` | [] | extra Host names allowed (Tailscale). At once |
| `security.loginEnabled` | false | users and sign-in. Changed only by `/api/auth/enable` / `disable`. At once |
| `security.sessionDays` | 30 | how long a sign-in lasts. After a restart |
| `database.path` | ./data/junk.db | after a restart |
| `appearance.theme` | system | light, dark, system or a custom theme's id |
| `appearance.customThemes` | [] | `{id, name, dark, tokens: {bg: "#rrggbb", …}}` |

`data/session.key` (beside the database) signs the session cookies, so a restart does not sign
everyone out. Delete it to sign everyone out.

## Data
SQLite with WAL; the schema version is `PRAGMA user_version` (see `SCHEMA_VERSION` in
`server/src/migrations.ts`; 8 as of 1.13). A newer database than the app knows is refused. Add a migration to
`MIGRATIONS` in `migrations.ts` for any change (the phone apps run the same list). Before upgrading a database
that already has data, the app saves a copy beside it as `junk.db.before-v<new version>` (written to a temporary
name first; an older copy of the same name is kept, renamed with its date; delete them when you no longer need
them). To go back to an older app, stop it and put that copy back as `junk.db`. The database and its `-wal` /
`-shm` files are private to your account (0600). The phone apps keep the same file on the phone, but name
their before-upgrade copy after the version the log WAS at (`junk.db.before-v7` on the way to 8;
`APP_PORTS/README.md`).

- `users(id, name UNIQUE NOCASE, password_hash, settings_json, created_at, last_used_at, game_checked_on)` —
  `settings_json` holds `UserSettings` (`shared/types.ts`, defaults in `DEFAULT_USER_SETTINGS`): `units,
  trendDays, weekStart, examples, quickPicks, openIn, autoStart, toughness, weighReminder(Days),
  activityReminder(Days), healthImport, healthSince` and, written only by the import, `healthLastAt,
  healthLastAdded`. `quickPicks` is always six strings in order, `""` = the default (`DEFAULT_QUICK_PICKS`:
  Walk, Run, Bike, Gym, Swim, Yoga; `quickPickNames()` in `shared/types.ts` resolves them). A shorter list
  sent to `PUT /api/me/settings` changes only the first ones. `game_checked_on` (v5) is Keep the monsters
  coming's once-a-day look.
- `splurges(id, user_id, what, size ∈ snack|meal|feast, place, calories, day, time, notes, planned, …)` —
  `planned` (v4) is the Planned treat switch.
- `activities(id, user_id, what, minutes, calories, day, time, notes, source, source_id, …)` (v3, Nov 9 2026) — any
  number a day; only `what` is needed; `minutes` 1–1440 and `calories` (burned) 0–20000 are
  whole numbers or NULL. `source` (v8) is `""` (logged by hand), `apple-health` or `health-connect`, and
  `source_id` the health app's own id for the workout.
- `health_imports(user_id, source, source_id, seen_at, activity_id, skipped)` (v8, Nov 22 2026) — every
  workout the phone's health app has handed over, brought in (`activity_id`) or skipped as one logged by
  hand (`skipped`), so it is taken only once: an edited one stays as edited, a deleted one never comes back.
- `game_runs`, `game_fights`, `game_events` (v4; `lives` and `hp_mult` v6; a fight's level 1–120 v7) —
  Calorie Crusher's runs, its fights and what happened in them: `Docs/game/ARCHITECTURE.md`.
- `weigh_ins(user_id, day, pounds, …)` — primary key `(user_id, day)`: one a day. Always pounds.
- `goals(id, user_id, text, days ∈ 7|14|30|NULL, position, started_on, done_on, …)` — open goals
  (`done_on` NULL) in `position` order; the first is the goal now. `started_on` is its day 1. Every
  change to the list carries the phone's `today` and ends by giving the top goal a day 1 if it has
  none and clearing it on the goals below (one moved off the top starts over). Reads never write —
  only writes get the same-origin guard.

Days are `YYYY-MM-DD` in the phone's own time zone, sent by the page.

## API
All JSON. Writes must come from the app's own page (same origin) and a known Host name.

| | |
|---|---|
| `GET /api/health` | `{ok, app: "junk-tracker", version}` — the scripts use `app` |
| `GET /api/auth/me` | `{status: setup \| signin \| ok, …}` |
| `GET /api/appearance` | the look (theme and custom themes), also before sign-in |
| `POST /api/auth/login` · `logout` | sign in / out (rate-limited) |
| `POST /api/auth/enable` `{name, password}` | turn on users and sign-in: names you, sets your password, signs this browser in |
| `POST /api/auth/disable` `{confirm: "TURN OFF"}` | turn it off — refused while there is more than one user; clears the password |
| `POST /api/auth/setup` | only when the login is on and nobody has a password (config.json edited by hand) |
| `GET /api/overview?today=YYYY-MM-DD` | everything Home needs, including `goal`, `goalSplurges`, `goals`, and `activities` (last 40 days), `lastActivity`, `recentActivities` |
| `GET /api/goals?today=` | `{open, done (latest 100), doneCount, goalSplurges}` |
| `POST /api/goals` `{text, days, place: now\|later, today}`, `PUT /api/goals/:id` `{text, days}`, `DELETE /api/goals/:id` `{today}` | at most 50 open goals |
| `POST /api/goals/:id/move` `{dir: up\|down, today}`, `/done` `{today}`, `/reopen` `{today}` (undo) | |
| `GET/POST /api/splurges`, `PUT/DELETE /api/splurges/:id` | `?from=&to=` on GET |
| `GET/POST /api/activities`, `PUT/DELETE /api/activities/:id` | `?from=&to=` on GET; body `{what, minutes, calories, day, time, notes}` |
| `GET /api/weigh-ins`, `PUT/DELETE /api/weigh-ins/:day` | PUT `{weight, unit}` replaces the day's |
| `GET /api/reminders?today=&tz=` | `{due: [...]}` — the reminders due now (`tz` = the phone's time-zone offset in minutes); reads only |
| `POST /api/health/import` `{source, today, workouts}` | workouts from the phone's health app (`source`: `apple-health` \| `health-connect`, at most 1000); each is taken once; replies `{added, skipped}` |
| `GET /api/health/summary?today=` | `{lastAt, lastAdded, thisWeek}` for the Settings card |
| `GET /api/game…`, `POST /api/game/…` | Calorie Crusher: `Docs/game/ARCHITECTURE.md` ("API") |
| `GET/PUT /api/me/settings` | the person on screen's settings |
| `GET/POST /api/users` (POST needs sign-in on), `PUT /api/users/:id/name`, `PUT /api/users/:id/password`, `POST /api/users/:id/switch`, `POST /api/users/switch-back`, `DELETE /api/users/:id` `{confirm: "DELETE"}` | |
| `GET/PUT /api/settings` | config.json (checked; unknown keys refused); reply lists what needs a restart |

Errors are `{error: "a plain sentence"}`; 401 = sign in, 421 = unknown Host, 403 = another site.
The phone apps answer the same routes inside the page (`APP_PORTS/shared/src/backend.ts`), except sign-in,
adding or removing users, passwords, Switch to and the network and sign-in settings, which they refuse; they
add `GET /api/phone/notice` and `POST /api/phone/notice/seen` (the one-time "your log was recovered" message).

## Sign-in and users
Login off (the default): one person, made on first open as "Me" with an empty `password_hash`
(nobody can sign in as them); every browser is that person. Login on:
the session holds `{userId, tag}` where `tag` comes from the password hash, so a new
password signs that person out everywhere. *Switch to* sets `actingAs`; everything under
`/api/overview`, `/api/splurges`, `/api/activities`, `/api/weigh-ins`, `/api/goals`, `/api/reminders`, `/api/health`,
`/api/game` and `/api/me` uses that person.

## Look
Colours are CSS variables (`web/src/index.css`): light and dark sets, plus the size colours
`snack`, `meal`, `feast`, the goal note's `note`, `note-ink`, `note-mute`, and activity's green
`active`, `active-ink`, `active-soft`, `active-text`. A custom theme sets the same variables inline
(a theme saved before activity existed keeps the built-in green for its light or dark base). The
mark under an active day uses `.notch` / `.notch-ink` / `.notch-snack` in `index.css`: green, or
the day's own text colour on Meal and Feast (and on Snack in a dark theme). Figtree is bundled; so is Caveat (`web/src/fonts/`, SIL Open Font License)
for the note's handwriting, and Lilita One and Nunito for the game.
