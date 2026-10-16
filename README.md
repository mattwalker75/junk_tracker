# Junk Tracker

A small app for your phone that tracks two things and nothing else: **junk food** ("splurges")
and **weight**. Log a splurge in a few taps, see how many days you have stayed clean, and watch
your weight trend. It runs on your own computer and keeps everything in one SQLite file.

- **Home**: *Days clean* in big type, splurges *this week* and in the *last 30 days*, the last
  14 days as coloured squares (tap one to see that day), and your weight with its trend.
- **+ Splurge**: what you had and how big — **Snack**, **Meal** or **Feast** — plus, if you
  like, where, calories, when and notes. Things you had before are one tap away.
- **Weigh in**: at most one weigh-in a day, in pounds or kilograms. Weigh-ins are optional.
- **Calendar**: any month, coloured by the biggest splurge of each day, with that month's totals.
- **Just you, no sign-in** to start with. Turn on *Users and sign-in* in Settings to add other
  people, each with their own log and settings, each signing in with a password. Anyone can
  *switch to* anyone (to check in or to fill it in for them) — it keeps logs apart; it is not privacy.
- **Settings**: your own examples of a Snack, Meal and Feast; pounds or kilograms; the trend
  period (1 week, 2 weeks or a month); users and sign-in on or off; light, dark or a theme you
  make; other devices on your network on or off.

## Get started

```bash
./INSTALL_APP.sh        # installs Node.js if needed, the packages, builds, runs the tests
./TRACKER.sh            # starts it and opens http://localhost:8420
```

It opens straight onto your log — no account, no password. Tap the pencil in Settings to put
your name on it.

`./TRACKER.sh --help` lists everything: `--stop`, `--restart`, `--status`, `--logs`, `--check`, …

## Use it from your phone

Settings → **Network access** → *Allow other devices on my network*, then `./TRACKER.sh --restart`.
The page lists the addresses to open on the phone. If you reach the computer through Tailscale,
add its name (for example `my-mac.tailnet-name.ts.net`) under *Other names for this computer*.
Turn on Settings → **Users and sign-in** at the same time so nobody else on the network walks in.

On the phone, *Add to Home Screen* makes it open like an app.

## More

- [Docs/USER_GUIDE.md](Docs/USER_GUIDE.md) — every screen and setting
- [Docs/DEVELOPMENT.md](Docs/DEVELOPMENT.md) — how it is built, the config file, the data, the API, tests
- [CHANGELOG.md](CHANGELOG.md)
