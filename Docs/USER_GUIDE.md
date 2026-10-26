# Junk Tracker — user guide

## The first time
Open the app (`./TRACKER.sh` opens http://localhost:8420). There is nothing to set up: it opens
straight onto your log, with no account and no password. You are called "Me" until you tap the
pencil at the top of Settings and type your name.

Want other people on it, or a password? Settings → **Users and sign-in** (below).

## Home
- **My goal** — when you have a goal, it sits at the very top on a yellow sticky note, so you see
  it every time you open the app. Under it: which day of the goal you are on and how it is going.
  Tap **Done** when you have done it — the next goal on your list takes its place (and **Undo** is
  there for a moment if you tapped it by mistake). When a goal's time is up, the note asks
  *did you do it?*: **Yes, done**, or **Keep going** to leave it up with no end date. Tap the
  words to open your goals.
- **Days clean** — whole days since your last splurge. `0` means you had one today. Under it:
  the day and, if you said, where.
- **This week** — splurges since the start of the week (Sunday or Monday, your choice in Settings).
- **30 days** — splurges in the last 30 days, and how many were feasts.
- **The last splurge** — its size, what it was and how long ago. Tap it to open that day.
- **Last 14 days** — one square a day, coloured by the biggest splurge that day:
  pale = Snack, orange = Meal, red = Feast, grey = clean. Today has an outline. Tap any day to
  see what you had and your weigh-in, to change or delete them, or to add something to that day.
  **Calendar** goes further back.
- **Weight** — your latest weigh-in, how much it went up or down over your trend period
  (green when down), the average of the last 7 days, and a small line of the period.
- **+ Splurge** and **Weigh in** — the two big buttons at the bottom.

## Log a splurge
1. **What did you have?** — or tap one under *Again?* (the last few different things you had;
   it fills in the size too).
2. **How big a splurge?** — **Snack**, **Meal** or **Feast**. Under each is an example: yours
   from Settings, or a candy bar / burger & fries / a whole pizza. Pick the closest.
3. Optional: **Where** and **Calories**.
4. **Day** — **Today** unless you tap **Yesterday**, or **Other day** for a big calendar of the
   month (arrows for earlier months; days after today can't be picked). There is no time to fill in.
5. Optional: **Notes**.
6. **Save splurge**.

To change or delete one, tap its day on Home or in the Calendar, then tap **Edit** on the splurge.

## Weigh in
Type your weight (pounds or kilograms, as set in Settings) and **Save weigh-in**. One weigh-in a
day: if the day already has one, the sheet says so and saving replaces it. The **Day** works like a
splurge's: **Today** unless you tap **Yesterday**, or **Other day** for the big calendar — to fill
in a day you missed. **Remove this day's weigh-in** deletes it. Weigh-ins are optional;
the weight card just waits for the first one.

## Goals
Tap your initials (top right of Home), then **Goals**.
- **Now** — the goal on your Home screen, with **I did it — check it off**.
- **Up next** — the goals waiting, in order. The arrows move one up or down; moving one to the top
  makes it the goal now. A goal's days start when it reaches the top, so goals waiting don't run
  down (and one moved off the top starts over when it comes back).
- **Add a goal** — type it, or tap one of the ideas; choose how long (no end, 1 week, 2 weeks or
  1 month) and whether it is the goal now or goes at the end of the list.
- **Done** — the goals you checked off, with the day.

Tap any open goal to change its words or length, or to delete it. Each person has their own goals.

## Calendar
Any month: days coloured like Home, a small line under days with a weigh-in, then the month's
splurge count, clean days and weight change, and the list of that month's splurges. Arrows move
between months. Tap a day to open it.

## Settings
Tap your initials at the top right of Home, then **Settings**. The same menu has **Goals**, and
— with users and sign-in on — **Sign out**.

**Your splurge sizes** — what a Snack, a Meal and a Feast mean *to you* (for example
"candy bar, 2 cookies"). They show under the size buttons when you log. Leave one empty for the
usual example.

**Weight and weeks** — pounds or kilograms (weigh-ins are kept exactly; only the display
changes); the trend over 1 week, 2 weeks or a month; weeks start on Sunday or Monday.

These two are **yours** — each person has their own.

**Users and sign-in** — off to start with: no sign-in, one log. Turn on *Several users, each
signing in* and it asks for your name and a password; you become the first user and your log
stays as it is. From then on everyone signs in, and the **Users** list appears in Settings.
*Stay signed in for* 1 day to 90 days (after a restart). To turn it off, remove everyone but
yourself first (so no log is lost), then type TURN OFF; your password is removed.

**Users** (only with users and sign-in on) — everyone with a log.
- **Add a user**: a name and a password (twice).
- **Password**: set a new password for anyone. If sign-in is on, that person is signed out
  everywhere and uses the new one. Changing your own keeps you signed in here.
- **Switch to**: shows that person's log (and their settings) so you can look or fill it in for
  them. A strip at the top says whose log you are in, with a button to go back to yours.
- **Remove**: deletes the person with all their splurges and weigh-ins (type DELETE to confirm).
  You cannot remove yourself or the last person.

Anyone can do all of this — users keep logs apart; they are not private from each other.

**Appearance** — Light, Dark, System (follows the phone), or **New theme…** to make your own
with a live preview (including the goal note's paper and writing). The same for everyone.

**Network access** — *Allow other devices on my network* lets phones open it (after
`./TRACKER.sh --restart`); the addresses to use are listed. *Other names for this computer* is
for a VPN name such as Tailscale's `my-mac.tailnet-name.ts.net` (applies at once). **Port**
changes the address (after a restart).

**About** — the version, and where the settings file and the database are.

## Running it
| | |
|---|---|
| `./TRACKER.sh` | start it in the background and open it |
| `./TRACKER.sh --stop` | stop it |
| `./TRACKER.sh --restart` | after a setting that says "after a restart" |
| `./TRACKER.sh --status` | is it running, and where? |
| `./TRACKER.sh --logs` | watch the server log (Ctrl-C to leave) |
| `./TRACKER.sh --check` | is everything it needs in place? |
| `./TRACKER.sh --stop`, `git pull`, `./TRACKER.sh --start` | update to new code — the start installs and builds what it needs |
| `./INSTALL_APP.sh -k` | the same by hand: packages and build, no tests |

## Backing up
Everything is in one file, `data/junk.db` (Settings → About shows where). Stop the app and copy
that file, or copy it while running together with `junk.db-wal` if it is there.

When an update changes how the database is laid out, the app first saves a copy of it as it was,
for example `data/junk.db.before-v2`. Keep it until you are happy with the update.
