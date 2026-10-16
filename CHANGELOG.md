# Changelog

All notable changes to Junk Tracker (Keep a Changelog style; dates are when the change was made).

## [0.1.0] — 2026-10-16

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
  - 18 tests (the API, and the home-screen numbers).
