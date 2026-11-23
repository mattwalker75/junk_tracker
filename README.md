# Craving Crusher

A small app for your phone that tracks **junk food** ("splurges"), **weight** and, on the good
side, **activity**. Log a splurge in a few taps, see how many days you have stayed clean, how
active you were this week, and watch your weight trend. It runs on your own computer and keeps everything in one SQLite file.

- **Goals**: keep a list of things to aim for ("Eat extra clean for the next 2 weeks"). The one at
  the top sits on Home as a sticky note, every time you open the app; check it off and the next
  one moves up.
- **Home**: *Days clean* in big type, splurges *this week* and in the *last 30 days*, the last
  14 days as coloured squares (tap one to see that day, or the card for the Calendar), *Activity this week* (tap it for the week in detail), and your weight with
  its trend.
- **+ Splurge**: what you had and how big — **Snack**, **Meal** or **Feast** — plus, if you
  like, where, calories, when and notes. Things you had before are one tap away.
- **+ Activity**: what you did (or one tap on a quick pick — Walk, Run, Bike, Gym, Swim, Yoga, or
  your own six), and if you like how long and the calories burned. Active days get a green mark.
- **Weigh in**: at most one weigh-in a day, in pounds or kilograms. Weigh-ins are optional.
- **Calendar**: any month, coloured by the biggest splurge of each day, active days marked, with
  that month's totals.
- **Just you, no sign-in** to start with. Turn on *Users and sign-in* in Settings to add other
  people, each with their own log and settings, each signing in with a password. Anyone can
  *switch to* anyone (to check in or to fill it in for them) — it keeps logs apart; it is not privacy.
- **Calorie Crusher** (game mode, from the initials menu): a monster battle made from your own log —
  workouts hit the monster, splurges heal it, beat 120 monsters in 12 worlds before their deadlines.
  Every monster moves: it breathes, attacks when it takes a heart, falls when you beat it. Your log is
  never changed by it.
- **Reminders**: a window when you open the app and haven't weighed in for 7 days or logged an
  activity for 3 (your numbers, each on or off).
- **Settings**: your own examples of a Snack, Meal and Feast; your six activity quick picks; the two
  reminders; whether the app opens in the tracker or the game; Monster toughness and *Keep the
  monsters coming* for the game; pounds or kilograms; the trend
  period (1 week, 2 weeks or a month); users and sign-in on or off; light, dark or a theme you
  make; other devices on your network on or off.
- **iPhone and Android apps** (`APP_PORTS/`): the same app installed on a phone, with the log kept on
  the phone — no computer, no sign-in. They can bring in your workouts from Apple Health or Health
  Connect by themselves.

## Get started

```bash
./INSTALL_APP.sh        # installs Node.js if needed, the packages, builds, runs the tests
./TRACKER.sh            # starts it and opens http://localhost:8420
```

It opens straight onto your log — no account, no password. Tap the pencil in Settings to put
your name on it.

`./TRACKER.sh --help` lists everything: `--stop`, `--restart`, `--status`, `--logs`, `--check`, …

## Update it

```bash
./TRACKER.sh --stop
git pull
./TRACKER.sh --start     # installs and builds what changed; your data stays as it is
```

## Use it from your phone

Settings → **Network access** → *Allow other devices on my network*, then `./TRACKER.sh --restart`.
The page lists the addresses to open on the phone. If you reach the computer through Tailscale,
add its name (for example `my-mac.tailnet-name.ts.net`) under *Other names for this computer*.
Turn on Settings → **Users and sign-in** at the same time so nobody else on the network walks in.

On the phone, *Add to Home Screen* makes it open like an app.

## As an iPhone or Android app

`APP_PORTS/ios/BUILD_APP.sh` and `APP_PORTS/android/BUILD_APP.sh` build Craving Crusher as an app that keeps
its log on the phone (one person, no sign-in, nothing goes over the network). `--check` says what to
install first, `--help` lists the rest. The phone's log and this computer's log are separate. How it
works: [APP_PORTS/README.md](APP_PORTS/README.md).

## More

- [Docs/USER_GUIDE.md](Docs/USER_GUIDE.md) — every screen and setting
- [Docs/DEVELOPMENT.md](Docs/DEVELOPMENT.md) — how it is built, the config file, the data, the API, tests
- [APP_PORTS/README.md](APP_PORTS/README.md) — the iPhone and Android apps
- [CHANGELOG.md](CHANGELOG.md)
