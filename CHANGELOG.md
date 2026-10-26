# Changelog

All notable changes to Junk Tracker (Keep a Changelog style; dates are when the change was made).

## [Unreleased]

### Added
- 2026-10-26: **Goals.** Keep a list of things to aim for, like "Eat extra clean for the next
  2 weeks". The goal at the top of the list sits at the very top of Home on a yellow sticky note
  in handwriting, so it is the first thing you see every time you open the app; under it, which
  day of the goal you are on and how it is going (clean so far, or how many splurges). **Done**
  checks it off and the next goal takes its place, with **Undo** for a moment. A goal can run
  1 week, 2 weeks, a month or with no end; its days start when it reaches the top. When its time
  is up the note asks *did you do it?* — **Yes, done**, or **Keep going**. The Goals page (Now,
  Up next with arrows to reorder, Add a goal with ideas, Done) is under your initials. Each
  person has their own goals.
- 2026-10-26: **Updating is stop → git pull → start.** `./TRACKER.sh --start` now installs the
  app's packages by itself when an update changed them, and the app saves a copy of the database
  (`data/junk.db.before-v2`) before upgrading it for goals. Nothing already logged changes.

### Changed
- 2026-10-26: **Your initials open a menu** — **Goals**, **Settings** and, with users and sign-in
  on, **Sign out**. The separate sign-out button on Home is gone.
- 2026-10-26: **Tidy-up** (nothing looks or works differently): unused imports removed; the
  pounds-to-kilograms number is kept in one place (`shared/types.ts`) for the server and the page;
  Home and Settings work out your initials with the same code. The user guide now says to tap
  **Edit** on a splurge to change it.

## [0.1.0] — 2026-10-16

### Fixed
- 2026-10-16: **Code review fixes** (no look changes).
  - *Scripts:* `./TRACKER.sh --start` no longer exits with an error after a good start when the
    browser is not opened; the pid file and log now sit beside the config's own data, so a copy run
    on a different config can never stop the real one; a relative `JT_CONFIG` is read from where you
    typed it; a stray `PORT` in the shell no longer moves the server; Node.js 22.12 or newer is
    checked (the page builder needs it), also after Homebrew installs it; more files trigger a
    rebuild (lock file, build settings); `--start` and `INSTALL_APP.sh` say to restart when the
    running copy is older than the build.
  - *Server:* too-large requests get a plain refusal instead of a server error; adding the same name
    twice at once, or turning on sign-in twice at once, can no longer slip past the checks; a
    password can only be set with sign-in on; sign-in, setup and password changes have separate
    attempt limits, and only failed sign-ins count; a config.json that cannot be saved changes
    nothing; sign-ins end on the server after *Stay signed in for*, not only in the browser;
    Home shows your last weigh-in even when it is older than the trend window; a config.json that
    is not `{ … }` gives a clear message.
  - *Page:* "today" moves on at midnight when the page stays open; Weigh in no longer shows another
    day's weight in the box; the day picker no longer opens on *Other day* for a new splurge after
    editing an old one; a theme that fails to save keeps the editor open and the page in the saved
    look; *Last used* uses your own time zone; removing the person you switched to clears their log
    from the screen; the user count updates after adding someone; a weight change too small to show
    in kg reads "no change"; typing the confirm word in lower case works (and a wrong word says so);
    saving one setting no longer wipes what you were typing in another; re-saving a kg weigh-in
    unchanged keeps it exact.
  - 28 tests.

### Changed
- 2026-10-16: **Log a splurge asks for the day only, not the time** (Matt: the day is enough).
  The day is **Today**, **Yesterday** or **Other day**, which opens a big month calendar in the
  sheet with finger-sized days, in place of the phone's small date picker. Splurges logged
  earlier keep their time.
- 2026-10-16: **Weigh in picks the day the same way** — **Today** (the default), **Yesterday**
  or **Other day** with the big calendar — in place of the phone's date box.
- 2026-10-16: **A day you open looks tidier** — same content, better laid out: a one-line
  summary at the top (how many splurges, the biggest size, calories logged) or a check mark for a
  clean day; *Splurges* and *Weight* headings; each splurge as a card with its size and time,
  an Edit button, where and calories as small labelled tags, and notes in their own box; the
  weigh-in shows the weight on the right, or says to tap to add one.
- 2026-10-16: **Sign out is on the home screen**, beside your initial, and only when users and
  sign-in are on. It is no longer in Settings.
- 2026-10-16: **It starts with no sign-in, just you** (like the trading desk and People Manager).
  The first open goes straight to your log — no name or password to set up. Put your name on it
  with the pencil in Settings. Settings → **Users and sign-in** is one switch: turning it on asks
  for your name and a password and brings the Users list (add people, each with their own log);
  turning it off needs everyone else removed first and the word TURN OFF, and removes your password.

### Added
- 2026-10-16: **The first version.**
  - **Home**: *Days clean*, splurges *this week* and in the *last 30 days* (with how many were
    feasts), the last splurge, the *Last 14 days* coloured by size (tap a day to see it), and the
    weight card — latest weigh-in, change over the trend period, 7-day average and a small line.
    Big **+ Splurge** and **Weigh in** buttons at the bottom.
  - **Log a splurge**: what you had and its size (**Snack**, **Meal** or **Feast**, with your own
    examples under each), and optionally where, calories, the day, the time and notes. *Again?*
    offers the last few different things you had. Edit or delete from the day's sheet.
  - **Weigh in**: one weigh-in a day (saving again replaces it), pounds or kilograms.
  - **Calendar**: any month coloured by each day's biggest splurge, weigh-in marks, the month's
    splurges, clean days and weight change.
  - **Users**: add people with a password, change anyone's password, *Switch to* someone to see or
    fill in their log, remove someone (type DELETE). Each person has their own settings.
  - **Settings**: splurge-size examples, lb/kg, trend period, first day of the week; Light / Dark /
    System or your own themes; sign-in on or off and how long it lasts; network access, other
    names (Tailscale) and the port.
  - **INSTALL_APP.sh** (Node.js, packages, build, config.json, tests) and **TRACKER.sh**
    (start, stop, restart, status, logs, check, test, dev).
  - 21 tests (the API, and the home-screen numbers).
