# Junk Tracker — development

## Layout
```
server/src/   index.ts (listen) · app.ts (routes, guards) · config.ts · security.ts
              db.ts (tables, migrations) · users.ts (people, sessions, settings) · log.ts (splurges, weigh-ins)
shared/       types.ts — the data model both sides use
web/src/      App.tsx · components/ (Home, LogSheet, WeighSheet, DaySheet, CalendarPage, AuthScreen, ui)
              settings/ · lib/ (api, dates, stats, theme, route)
test/         api.test.ts (the server, end to end) · stats.test.ts (home-screen numbers) · helpers.ts
```
`npm run build` → `dist/node` (tsc) and `dist/web` (Vite). The server serves `dist/web`.

## Commands
```bash
npm test                 # vitest: 18 tests
npm run typecheck        # server + page
./TRACKER.sh --dev       # live-reloading page on :5173, API proxied to the server port
./TRACKER.sh --fg        # run the built app in the foreground
```
Use a scratch config so nothing real is touched:
```bash
JT_CONFIG=/tmp/jt/config.json JT_NO_OPEN=1 ./TRACKER.sh --start
```
Relative paths in a config (the database) are from that config file's folder.

## config.json
Created from `config.example.json` on first start. Settings edits the same file.

| Key | Default | Notes |
|---|---|---|
| `server.port` | 8420 | after a restart |
| `server.allowNetwork` | false | false = 127.0.0.1 only; true = every interface. After a restart |
| `server.extraHosts` | [] | extra Host names allowed (Tailscale). At once |
| `security.loginEnabled` | false | ask everyone to sign in. At once |
| `security.sessionDays` | 30 | how long a sign-in lasts. After a restart |
| `database.path` | ./data/junk.db | after a restart |
| `appearance.theme` | system | light, dark, system or a custom theme's id |
| `appearance.customThemes` | [] | `{id, name, dark, tokens: {bg: "#rrggbb", …}}` |

`data/session.key` (beside the database) signs the session cookies, so a restart does not sign
everyone out. Delete it to sign everyone out.

## Data
SQLite with WAL; the schema version is `PRAGMA user_version` (now 1). A newer database than the
app knows is refused. Add a migration to `MIGRATIONS` in `db.ts` for any change.

- `users(id, name UNIQUE NOCASE, password_hash, settings_json, created_at, last_used_at)` —
  `settings_json` holds `{units, trendDays, weekStart, examples}`.
- `splurges(id, user_id, what, size ∈ snack|meal|feast, place, calories, day, time, notes, …)`
- `weigh_ins(user_id, day, pounds, …)` — primary key `(user_id, day)`: one a day. Always pounds.

Days are `YYYY-MM-DD` in the phone's own time zone, sent by the page.

## API
All JSON. Writes must come from the app's own page (same origin) and a known Host name.

| | |
|---|---|
| `GET /api/health` | `{ok, app: "junk-tracker", version}` — the scripts use `app` |
| `GET /api/auth/me` | `{status: setup \| signin \| ok, …}` |
| `POST /api/auth/setup` · `login` · `logout` | first person / sign in / out (rate-limited) |
| `GET /api/overview?today=YYYY-MM-DD` | everything Home needs |
| `GET/POST /api/splurges`, `PUT/DELETE /api/splurges/:id` | `?from=&to=` on GET |
| `GET /api/weigh-ins`, `PUT/DELETE /api/weigh-ins/:day` | PUT `{weight, unit}` replaces the day's |
| `GET/PUT /api/me/settings` | the person on screen's settings |
| `GET/POST /api/users`, `PUT /api/users/:id/password`, `POST /api/users/:id/switch`, `POST /api/users/switch-back`, `DELETE /api/users/:id` `{confirm: "DELETE"}` | |
| `GET/PUT /api/settings` | config.json (checked; unknown keys refused); reply lists what needs a restart |

Errors are `{error: "a plain sentence"}`; 401 = sign in, 421 = unknown Host, 403 = another site.

## Sign-in and users
Login off: the session remembers who the browser switched to; otherwise it is the first user.
Login on: the session holds `{userId, tag}` where `tag` comes from the password hash, so a new
password signs that person out everywhere. *Switch to* sets `actingAs`; everything under
`/api/overview`, `/api/splurges`, `/api/weigh-ins` and `/api/me` uses that person.

## Look
Colours are CSS variables (`web/src/index.css`): light and dark sets, plus the size colours
`snack`, `meal`, `feast`. A custom theme sets the same variables inline. Figtree is bundled.
