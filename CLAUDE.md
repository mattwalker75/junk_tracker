# CLAUDE.md — working on Junk Tracker

Read this before changing anything. `Docs/DEVELOPMENT.md` has the detail.

## What it is
A phone-first web app that tracks junk food ("splurges") and weight, and nothing else. Runs on
Matt's Mac (or Mac mini over Tailscale), used in a phone browser. Server: Node 22+ / Express 5 /
TypeScript / better-sqlite3. Page: React 19 + Vite + Tailwind v4 + Radix Dialog + TanStack Query.
The person using it is not a developer — every message the page shows is a plain sentence.

## Map
- `server/src/log.ts` — splurges and weigh-ins (all checks, the overview); `users.ts` — people,
  passwords, sessions, Switch to, per-person settings; `app.ts` — routes and guards;
  `config.ts` — config.json; `security.ts` — Host guard, same-origin writes; `db.ts` — tables
  and migrations (`PRAGMA user_version`).
- `shared/types.ts` — the data model used by both sides.
- `web/src/components/Home.tsx` (home), `LogSheet.tsx`, `WeighSheet.tsx`, `DaySheet.tsx`,
  `CalendarPage.tsx`; `web/src/settings/` — Settings pages; `web/src/lib/stats.ts` — the numbers
  on the home screen (pure, tested).

## Rules that exist for a reason
1. **Matt's chosen design** (mockups artifact JaQKDBbcdYyzDybDBx2eXS, round 2 "E/F"): home =
   big *Days clean* tile + *This week* + *30 days*, the *Last 14 days* strip coloured by size with
   a Calendar button, the weight card (current, change over the trend period, 7-day average,
   sparkline), two big buttons at the bottom (**+ Splurge**, **Weigh in**). The *Log a splurge*
   sheet was approved as mocked. Keep it. Phone first: check every change at 390px wide.
2. **Spec decisions:** a splurge needs only *what* and *size*; sizes are **Snack / Meal / Feast**
   (default examples a candy bar / burger & fries / a whole pizza; each person can write their
   own in Settings, shown under the size buttons); a day's colour is its biggest splurge;
   weigh-ins are optional and **one per day** (saving again replaces it); stored in pounds, shown
   in lb or kg; trend period 1 week / 2 weeks / month.
3. **Days are the phone's local dates** (`YYYY-MM-DD`), sent by the page — the server never works
   out "today" in its own time zone (`/api/overview?today=`).
4. **Several users = separation, not privacy** (like People Manager): every person can add users,
   set anyone's password, Switch to anyone (a strip says whose log is on screen) and remove
   others. Matt rejected a fixed "2 people" setting — it is a Users table.
5. **Login off** = the browser is the first user (or whoever it switched to). **Login on** =
   name + password; changing a person's password signs them out everywhere (session carries a
   tag of the hash); your own change keeps you signed in.
6. **Host guard + same-origin writes** stay on: unknown Host → 421, cross-site writes → 403.
   Tailscale names go in `server.extraHosts`.
7. **Settings marked "after a restart"** (port, network access, sign-in length, database path)
   are listed in `RESTART_REQUIRED` in `config.ts`; the page says to run `./TRACKER.sh --restart`.

## Working rules
- Commit locally per feature with a dated CHANGELOG entry; `git add` explicit paths.
  **Never push — Matt pushes.**
- Never touch Matt's real `config.json` or `data/`. Try things with a scratch config:
  `JT_CONFIG=/some/scratch/config.json ./TRACKER.sh …` (and `JT_NO_OPEN=1` to skip the browser).
- `npm test` (vitest) and `npm run typecheck` must pass before a commit.
