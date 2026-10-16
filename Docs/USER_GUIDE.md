# Junk Tracker — user guide

## The first time
Open the app (`./TRACKER.sh` opens http://localhost:8420). It asks for your **name** and a
**password** (at least 8 characters). You are the first user. The password is only asked for
when sign-in is on (Settings → Sign-in), but it is set now so it is ready.

## Home
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
3. Optional: **Where**, **Calories**, **Day** and **Time** (now, unless you change them) and
   **Notes**.
4. **Save splurge**.

To change or delete one, tap its day on Home or in the Calendar, then tap the splurge.

## Weigh in
Type your weight (pounds or kilograms, as set in Settings) and **Save weigh-in**. One weigh-in a
day: if the day already has one, the sheet says so and saving replaces it. Change the **Day** to
fill in a day you missed. **Remove this day's weigh-in** deletes it. Weigh-ins are optional;
the weight card just waits for the first one.

## Calendar
Any month: days coloured like Home, a small line under days with a weigh-in, then the month's
splurge count, clean days and weight change, and the list of that month's splurges. Arrows move
between months. Tap a day to open it.

## Settings
Tap your initial at the top right of Home.

**Your splurge sizes** — what a Snack, a Meal and a Feast mean *to you* (for example
"candy bar, 2 cookies"). They show under the size buttons when you log. Leave one empty for the
usual example.

**Weight and weeks** — pounds or kilograms (weigh-ins are kept exactly; only the display
changes); the trend over 1 week, 2 weeks or a month; weeks start on Sunday or Monday.

These two are **yours** — each person has their own.

**Users** — everyone with a log.
- **Add a user**: a name and a password (twice).
- **Password**: set a new password for anyone. If sign-in is on, that person is signed out
  everywhere and uses the new one. Changing your own keeps you signed in here.
- **Switch to**: shows that person's log (and their settings) so you can look or fill it in for
  them. A strip at the top says whose log you are in, with a button to go back to yours.
- **Remove**: deletes the person with all their splurges and weigh-ins (type DELETE to confirm).
  You cannot remove yourself or the last person.

Anyone can do all of this — users keep logs apart; they are not private from each other.

**Appearance** — Light, Dark, System (follows the phone), or **New theme…** to make your own
with a live preview. The same for everyone.

**Sign-in** — off: whoever opens the app is in the first person's log (fine on a computer only
you use). On: everyone signs in with their name and password. *Stay signed in for* 1 day to 90
days (after a restart).

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
| `./INSTALL_APP.sh -k` | after pulling new code: packages and build, no tests |

## Backing up
Everything is in one file, `data/junk.db` (Settings → About shows where). Stop the app and copy
that file, or copy it while running together with `junk.db-wal` if it is there.
