# CLAUDE.md — working on Junk Tracker

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
  `config.ts` — config.json; `security.ts` — Host guard, same-origin writes; `db.ts` — tables
  and migrations (`PRAGMA user_version`).
- `shared/types.ts` — the data model used by both sides.
- `web/src/components/Home.tsx` (home), `GoalNote.tsx` (the sticky note on Home), `UserMenu.tsx`
  (the initials menu), `GoalsPage.tsx`, `GoalSheet.tsx`, `LogSheet.tsx`, `ActivitySheet.tsx` (Log activity), `WeighSheet.tsx`,
  `DaySheet.tsx`, `CalendarPage.tsx`; `web/src/settings/` — Settings pages; `web/src/lib/stats.ts` — the numbers
  on the home screen (pure, tested).

## Rules that exist for a reason
1. **Matt's chosen design** (mockups artifact JaQKDBbcdYyzDybDBx2eXS, round 2 "E/F"): home =
   big *Days clean* tile + *This week* + *30 days*, the *Last 14 days* strip coloured by size with
   a Calendar button, the weight card (current, change over the trend period, 7-day average,
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
   computer). `--start` reinstalls packages when `package-lock.json` changed and rebuilds when the
   code changed; a database upgrade first saves `junk.db.before-v<N>`. Keep it that way: no update
   step that needs anything else.
9. **Settings marked "after a restart"** (port, network access, sign-in length, database path)
   are listed in `RESTART_REQUIRED` in `config.ts`; the page says to run `./TRACKER.sh --restart`.
10. **Activity** (round 4, Matt, Nov 9 2026; mockups ActHomeCard = H1, LogActivity, DayActivity):
    an activity needs only *what*; how long and calories burned are optional (How long is typed
    as minutes `90` or h:mm `1:30` — `parseDuration` in `web/src/lib/stats.ts` — and saved as minutes); the
    Day picker is the splurge one, plus a time that starts at now; **any number a day** (only
    weigh-ins are one a day). Six quick picks (default Walk, Run, Bike, Gym, Swim, Yoga) are
    per person in Settings → You (`quickPicks`, six strings, `""` = default). Home keeps
    everything and adds the **Active this week** card above the 14 days (days active of 7 from the
    person's week start — a day counts once; minutes and calories add up every activity, calories
    only from those that say; last activity; seven dots); active days get a green notch under the
    date on the strip and in the Calendar (the day's text colour on Meal/Feast); THREE buttons at
    the bottom (**+ Splurge · + Activity · Weigh in**). The day sheet lists activities (Edit,
    Delete) after the splurges, with **+ Splurge / + Activity**; the Splurges / Activity headings
    show the day's calories eaten / burned when any entry has them. Colours: the `active*` tokens.
    Not yet: goals that count activity (Matt: later).
11. **Game mode — planned, not built** (Matt, Nov 11 2026): a monster battle ("Crave Crusher", working
    title) switched on from the initials menu. The design, Matt's decisions and the numbers are in
    `Docs/GAME_MODE.md`; the research behind it is in `Docs/GAME_RESEARCH.md`; mockups are rounds 5–6 of the canvas.

## Working rules
- Commit locally per feature with a dated CHANGELOG entry; `git add` explicit paths.
  **Never push — Matt pushes.**
- Never touch Matt's real `config.json` or `data/` — and **never delete `data/`** in the repo (Oct 16 2026:
  a scratch-test cleanup `rm -rf data` deleted the database Matt had just started using). Try things with a scratch config:
  `JT_CONFIG=/some/scratch/config.json ./TRACKER.sh …` (and `JT_NO_OPEN=1` to skip the browser).
- `npm test` (vitest) and `npm run typecheck` must pass before a commit.
