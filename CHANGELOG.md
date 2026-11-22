# Changelog

All notable changes to Junk Tracker (Keep a Changelog style; dates are when the change was made).

## [Unreleased]

## [1.10.0] — 2026-11-22
### Added
- 2026-11-22: **Calorie Crusher is complete: 120 levels in 12 worlds.** Four more worlds after Concession Canyon:
  world 9 **Brunch Boulevard** (boss Lady Short Stack), world 10 **Takeout Temple** (boss The Takeout Dragon), world 11
  **Deep-Fry Volcano** (boss The Fry Lord) and world 12 **Calorie Cosmos**, ending with the final boss **The
  Snackularity** at level 120. Forty more monsters, each with its own drawing, new ability and Monster Book line; HP
  climbs from 1,300 to 2,450 and deadlines are 9 to 10 days (a boss one more). The map, the world pages, the battle
  arenas and the Monster Book have them all.
- 2026-11-22: A run that finished at level 80 carries on at level 81, as one that finished at 60 did.
- 2026-11-22: A splurge whose heal an ability holds back for the next morning says so in the live panel ("tomorrow").
### Changed
- 2026-11-22: Count Concession is now world 8's boss. No database change: version 7 already allows level 120.

## [1.9.0] — 2026-11-22
### Added
- 2026-11-22: **Calorie Crusher has 80 levels: two new worlds after Feast Fortress.** World 7 **Freezer Tundra**
  (Pint Yeti, Pizza Roll Pack, Popsicle Pete, Freezer Burn, Waffle Cone Walrus, Snow Cone Owl, Sandwich Seal,
  Polar Pizza Bear, Cake Igloo; boss Emperor Neapolitan) and world 8 **Concession Canyon** (Nacho Gremlin, Pretzel
  Python, Candy Box Goblin, Jumbo Cup Jellyfish, Licorice Wrangler, Butter Banshee, Hot Dog Usher, Sour Straw
  Scorpion, Bucket Bison; final boss for now Count Concession). Each monster has its own drawing, new ability and
  Monster Book line; HP keeps climbing (1,000 to 1,670) and deadlines are 8 days (a boss 9). The adventure map,
  the world pages (two rows of world chips), the battle arena and the Monster Book have the new worlds. Worlds 9 to
  12 come next, mocked up first (the game is planned to reach 120).
- 2026-11-22: **A run that had beaten all 60 carries on at level 61** the next time the game is opened, with its
  score, hearts, lives and power-ups (a "More monsters!" note). Pint Yeti waits to be started, or Keep the monsters
  coming starts it. Runs that ended any other way stay ended.
### Changed
- 2026-11-22: Database version 7 (saved first as `junk.db.before-v7`): a fight's level may go up to 120. The phone
  apps upgrade their log the same way, and save it at once (the version before stays beside it as `junk.db.prev`).
- 2026-11-22: The Midnight Snacker is now world 6's boss; "FINAL BOSS", "Level N of …" and the finish screen follow
  the number of levels there are.

## [1.8.1] — 2026-11-22
### Changed
- 2026-11-22: **The iPhone and Android apps are for one person, with no sign-in of any kind** (Matt: they run only
  on the person's own phone or tablet). Besides Settings having no *Users and sign-in* or *Network access*, the
  apps never show a sign-in or setup screen or a *Switched to* strip, and the Hall of Heroes lists only your own
  runs: no names or YOU tags, and no *My runs* tab (All time already is them). The web app is unchanged and keeps
  users, sign-in and Switch to.
- 2026-11-21: The phone apps' folder is now `APP_PORTS/` (it was `app_ports/`).

## [1.8.0] — 2026-11-21
### Added
- 2026-11-21: **Craving Crusher as an iPhone and an Android app, with the log kept on the phone** (no server,
  no network, no sign-in). `APP_PORTS/ios/BUILD_APP.sh` and `APP_PORTS/android/BUILD_APP.sh` check what is
  needed (and say what to install), build the app into each one's `BUILD/` folder, and say where it is and how
  to try it: on this Mac in the iPhone Simulator / the Android Emulator (`--run`) or on a phone (`--open` /
  `--device` for an iPhone, `--install` or the .apk for Android). The app is the web app's page; its requests
  are answered inside the app by the server's own code on a SQLite file the phone keeps (and backs up). How it
  works: `APP_PORTS/README.md`. Android also has `--release` for the Play Store and `--install-tools`.
- 2026-11-21: The `APP_PORTS/` folder for the phone apps (`ios/`, `android/`, `shared/`).

### Changed
- 2026-11-21: In the phone apps, Settings leaves out Users and sign-in and Network access, and About says the
  log is on the phone. The web app is unchanged. (Under the hood: the database's tables moved to
  `server/src/migrations.ts` and the settings checks to `server/src/settingsSchemas.ts`, so the apps share them.)
- 2026-11-21: `scripts/make_icons.mjs` also writes the iPhone and Android apps' icons.

## [1.7.1] — 2026-11-21
### Changed
- 2026-11-21: **The new app icon** (Matt's pick, idea 9 of Round 8): two chunky letter Cs, cream and
  yellow with dark outlines on a red burst, drawn like Calorie Crusher. Every icon file was remade from
  it with `node scripts/make_icons.mjs`. A phone that already has the link on its home screen keeps the
  old burger: remove it and add it again.

## [1.7.0] — 2026-11-21
### Added
- 2026-11-21: **Ready for a phone's home screen.** Saving the link on an iPhone (Share → Add to Home
  Screen) or Android (Add to Home screen / Install app) now gives an icon and the name **Craving
  Crusher**, and it opens full screen. The icon files are made from one drawing, `Docs/icon/icon.svg`, by
  `node scripts/make_icons.mjs`, with a 1024 × 1024 master kept for a future iPhone / Android app
  (`Docs/icon/README.md`). The drawing is still the burger until a new icon is picked — 14 ideas are on
  the mockups canvas (Round 8) and in `Docs/icon/options/`.

## [1.6.0] — 2026-11-21
### Added
- 2026-11-21: **Reminders to weigh in and to log an activity.** Settings → You has a **Weigh-in
  reminder** and an **Activity reminder**, each with its own on/off switch and number of days (7 and
  3 to start with, 1 to 60). When you open the app and nothing has been logged today or in the days
  before, a window comes up over the app with **Weigh in now** / **Log an activity now**. It closes
  only with its **Close** button (not a tap outside, not Esc), and it comes back each time you open
  the app until you log one. Both start on, for everyone.

### Changed
- 2026-11-15: While a monster's hit is still waiting to be played in the fight, the title screen,
  the map and Choose your fight keep showing the hearts you had. The heart goes when you see the hit.

## [1.5.0] — 2026-11-15
### Added
- 2026-11-15: **Calorie Crusher: extra lives** (Normal runs only). Every 20 monsters you beat in a
  run earn an extra life; you can hold 2. When your last heart goes, a life is spent by itself
  instead of a knock-back: you get a full set of 3 hearts and fight the same monster again at full
  HP with its full time, and you lose no points. With no life left, Normal knocks you back to the
  start of the world as before. Hardcore has no extra lives: at 0 hearts the run is over. Lives show
  next to your hearts on the battle screen.
- 2026-11-15: **Monster toughness** in Settings → You: **Standard**, **Tough** (monsters have 1.5
  times the HP) or **Brutal** (twice the HP). Deadlines stay the same, and tougher monsters are
  worth more points. You can change it whenever you like; it counts from the next monster you
  start, and the one you are fighting stays as it is.

### Changed
- 2026-11-15: The database moves to version 6 the first time the app starts (a copy of the old one
  is saved beside it as `junk.db.before-v6`, as always).

## [1.4.0] — 2026-11-15
### Changed
- 2026-11-15: **Calorie Crusher: a missed deadline now buys one more day.** When a monster's
  deadline passes, you still lose a heart, but the fight carries on: you get one more day and the
  monster's HP stays where you left it (it used to heal back to full and wait for a rematch with a
  fresh deadline). Each further day you miss costs another heart. Your last heart works as before:
  knocked back to the start of the world on Normal, the run is over on Hardcore. The *Comeback Kid*
  badge is now for beating a monster after it struck you.
- 2026-11-15: **You see the hit when you go into the fight.** If a deadline passed while you were
  away, the "it strikes" screen no longer comes up on the title screen or the map. It waits until
  you open the fight: the monster lunges at you, a heart cracks, and then the screen tells you about
  the extra day. (With your phone set to reduce motion, the screen comes up at once, as before.)
### Fixed
- 2026-11-15: A Victory or "it strikes" screen you hadn't closed came back after closing and
  reopening the app once, but was lost if you did that a second time. It now keeps coming back
  until you close it.

## [1.3.0] — 2026-11-14
### Changed
- 2026-11-14: **New names.** The app is now **Craving Crusher** (was Junk Tracker), and its game
  mode is now **Calorie Crusher** (was Craving Crusher). The app's name is on the page title, Home,
  the sign-in screen and Settings; the game's is on its title logo and the small heading on every
  game screen. Your data, the scripts (`TRACKER.sh`) and the folder are unchanged. A phone that
  added the app to its home screen keeps the old name until you add it again.
- 2026-11-14: *Keep the monsters coming* in Settings → You no longer says the next monster starts
  the moment you beat one (it hasn't since 1.1.0).

## [1.2.0] — 2026-11-14
Small tweaks: easier taps on Home, the week's activity in detail, and a battle log that reads
newest first.

### Added
- 2026-11-14: **The week in detail.** Tap the *Activity this week* card on Home: days active, time
  and calories burned, each kind of activity (how many times, how long, calories), and the seven
  days one by one with every activity and its time. Tap a day to open it; the arrows step back to
  earlier weeks.

### Changed
- 2026-11-14: *Active this week* is now called **Activity this week**.
- 2026-11-14: The **Calendar** button on *Last 14 days* is gone: tap anywhere on that card (outside
  the days) to open the Calendar. Tapping a day still opens that day.
- 2026-11-14: Craving Crusher's **battle log** is newest at the top, in the order things happened:
  an entry's own time, or — with no time — when it was logged. A splurge, a workout and a second
  splurge now read in that order (before, splurges with no time were listed after every timed
  workout). How the fight is worked out is unchanged.

## [1.1.0] — 2026-11-14
Craving Crusher: splurging at full HP now costs something; you choose when the next monster starts,
or let it start by itself each morning.

### Added
- 2026-11-14: **Bonus HP.** A splurge when the monster is already at full HP is no longer free:
  what doesn't fit goes on as **bonus HP**, a violet bar laid over its HP bar, up to **20% of its
  max HP** (20 for Crumbs). Workouts knock the bonus off first, and "So close!", the map, the
  Monster Book and the live panels count it in the HP left. The size buttons show "+20 bonus", or
  "maxed out" once the bonus bar is full. How to crush explains it.
- 2026-11-14: **Keep the monsters coming** (Settings → You, off unless you turn it on). The first
  time you open game mode each day, if no monster is going, the next one starts by itself with the
  whole day ahead, and a note at the top says so. It never starts one on the same day a monster
  went down. If your run is over (or you never started one), a new run starts the same way, in the
  same mode as your last one; when a run ends you still see how it went first, and the new one
  starts the next day.

### Changed
- 2026-11-14: **The next monster waits for you.** Beating a monster (or missing a deadline) no
  longer starts the next one (or the rematch) by itself. The battle screen says *No monster right
  now*, shows who is up next, and has **Start the next fight** (it goes to Choose your fight, where
  you pick the deadline and tap **Start the fight!**). Until it starts, what you log hits and heals
  nothing, but still earns +5 points. Started the same day, it gets the rest of that day as a head
  start; on another day, that day is day 1. The map, the Monster Book and the title screen show it
  as *Up next*.
- 2026-11-14: The database goes to version 5 (one new column, for Keep the monsters coming). Your
  first start after updating saves a copy first, as `junk.db.before-v5`.
- 2026-11-14: The fight you are in now is worked out again with bonus HP, so a splurge you logged
  at full HP during it now shows up as bonus HP. Fights already won or struck stay as they were.

## [1.0.0] — 2026-11-12
Version 1.0.0: the tracker (splurges, activity, weight, goals) and Craving Crusher.

### Added
- 2026-11-12: **When the app opens** (Settings → You): open in the **Tracker** or straight into
  **Craving Crusher**. Each person picks their own; the menu still switches any time.

### Changed
- 2026-11-12: **The tracker and the game stay apart.** On the tracker's pages, *Log a splurge* and
  *Log activity* never show a monster or a damage/heal panel — even right after playing; all the
  game's looks stay in game mode. (The Planned treat hint there no longer mentions the monster.)


### Fixed
- 2026-11-11: **Craving Crusher: fixes after two reviews and a full play-through.**
  - On the day a monster goes down, every workout and splurge now counts for exactly one monster.
    Before, a workout logged with an earlier time could hit two monsters, and one logged out of
    order could hit none. Two big workouts on one day now beat two monsters, as they should.
  - A phone with its date far off (years ahead, say) no longer freezes the app: the game says
    "Your phone's date looks wrong" instead. Catching up after a long time away is quick.
  - A run that ended no longer collects +5 points for things logged after it ended.
  - Changing your week start in the middle of a run can't give the same week's heart twice.
  - Deleting the splurge a Veggie Shield blocked gives you the shield back.
  - Starting a run on a day you already worked out now shows the Victory over Crumbs, and the
    "Run #N begins!" screen shows the monster you are really on.
  - Starting a new run while one is going asks first: "End Run #N? It can't be brought back."
  - A workout logged from the tracker now shows up in the game (and its Victory) as soon as you go
    back to the game, not up to 15 seconds later.
  - A Victory or Strike screen comes back if you reload or close the app before you've seen it.
    The first time on a phone, old history isn't replayed.
  - "Back to tracker" on a Strike screen no longer throws away the screens waiting behind it.
  - Results and pop-ups belong to the person on screen: after Switch to they don't show over
    someone else's game.
  - With 4 or 5 hearts and a big score, the battle's top row no longer cuts the score off (hearts
    show as one heart × 5). The map and a world up close now fit phones narrower than 390 px, and
    the flag over your monster no longer runs off the left edge.
  - The deadline is "the end of" its last day everywhere, and the battle countdown, the map flag
    and the Monster Book say the time left in the same words. A log in the last minute before
    midnight still counts, and the countdown no longer says "Time's up" a minute early.
  - The damage and heal previews are right even when the phone's clock is a little behind.
  - The Hall of Heroes shows a run switched from Hardcore as "Hardcore → Normal", and its dates are
    easier to read.
  - Smaller things: keyboard focus stays inside a result screen, the "Run #N begins!" screen works
    with the keyboard, the battle screen no longer redraws everything every second, an odd address
    like `#/game/toString` opens the title screen, and one sync goes out instead of four.

### Docs
- 2026-11-11: The user guide has a **Craving Crusher (game mode)** section (how to open it,
  attacks and heals, deadlines and the bet, hearts, Normal or Hardcore, power-ups, points, and
  that your log is never changed), and the splurge section explains **Planned treat** and **Time**.
  CLAUDE.md rule 11 now says the game is built and lists its rules; README and DEVELOPMENT.md say
  where the game lives and how to test it.

### Added
- 2026-11-11: **Game mode: the map, the results and the rest of Craving Crusher's screens.**
  - **Adventure map:** all 60 levels on one winding path through the six worlds, each world in its
    own colours and scenery. Beaten monsters have a check, the one you're fighting pulses with your
    little hero beside it and a flag with its HP and days left, and the ones ahead are greyed out
    with a padlock. Bosses live in castles. The bar at the top shows your hearts, score, "Level N /
    60" and whether the run is Normal or Hardcore; tap that badge to see what it means. On a
    Hardcore run it also offers **Switch to Normal**, which asks first because it can't be undone.
    **Jump to me** takes you back to your fight, and tapping a monster opens a card about it.
  - **A world up close:** tap a world's sign for its ten levels as big circles, with buttons for
    all six worlds.
  - **What just happened, full screen:** **Victory** (the knockout, the score counting up, what's
    next, and "Choose your deadline"), **Strike** (a heart cracks, rematch tips), **Knocked back**
    (Normal run, 0 hearts), **Defeated** (Hardcore run, 0 hearts, with your place in the Hall and
    **Start Run #N**) and a celebration for beating all 60. When several things happened while you
    were away they come one after another. Smaller news (a heart, a power-up) pops up at the top
    for a few seconds. On the battle screen you first see the knockout or the strike happen. With
    "reduce motion" turned on, nothing moves.
  - **Hall of Heroes:** your best run, then All time, This month, My runs and Hardcore, and five
    badges (First Blood, Flawless, Daredevil, World 1 Clear, Comeback Kid).
  - **How to crush:** every rule and number, taken straight from the game's own rules.
  - **Monster Book:** all 60 monsters by world, each with a short funny line about it. Beaten ones
    get a stamp, the current one shows its fight, and the ones ahead show their drawing and level.
    Tap one for its page.
  - The title screen and the battle screen now link to the map. The "coming in the next update"
    note is gone. The tracker looks and works exactly as before.
- 2026-11-11: **Game mode: Craving Crusher's first screens.** The initials menu has **Game mode**
  (with a gamepad) above Goals; in the game the same menu starts with **Back to tracker**. The game
  opens on its title screen: **Start a run** (or **Continue Run #N**), then pick **Normal** or
  **Hardcore**. The battle screen shows your hearts, run and score, the deadline ticking down to
  11:59 PM of its last day, the monster with its HP bar and its trick, a **So close!** line that
  says how many minutes or calories would finish it, your power-ups, the battle log, and two big
  buttons: **+ Activity (attack)** and **+ Splurge**. **Choose your fight** lets you bet on a
  shorter deadline (Bold ×1.5, Daredevil ×2) until your first hit lands. In the game, *Log
  activity* and *Log a splurge* are the same forms with the same boxes, in the game's colours, with
  a live panel on top: "This hits Fry Hydra for 66 · 26 short…", **FINISHING BLOW!**, or how much
  a splurge heals it (a planned treat heals half). After you log something the game catches up at
  once: a knockout opens the next fight and a note says what happened. The Monster Book, Hall of
  Heroes, How to crush and the map come in the next update. The tracker looks and works exactly as
  before. The game's fonts (Lilita One, Nunito) come with the app, like the goal note's handwriting.
- 2026-11-11: **Planned treat on a splurge.** *Log a splurge* has a **Planned treat** switch after
  Notes, for a treat you planned, like a birthday dinner. It is still a splurge everywhere in the
  tracker; the day shows a small *planned* tag on it. In game mode it heals the monster half.
  Splurges already logged are not planned. The database is upgraded (a copy is kept as
  `data/junk.db.before-v4`).
- 2026-11-11: **The game's engine (not on screen yet).** Craving Crusher's rules now work behind
  the scenes: all 60 monsters and their abilities, fights worked out from your log, deadlines,
  hearts, power-ups, Normal and Hardcore runs, and points. There is nothing to see or tap yet; the
  game screens come next.
- 2026-11-11: **A splurge can have a time.** *Log a splurge* has an optional **Time** under the Day:
  empty to start, **Now** fills in the time right now, **Clear** takes it off. Splurges with a time
  show it on the day, as before; nothing already logged changes.
- 2026-11-09: **How long takes hours too.** Type minutes (`90`) or hours and minutes with a
  colon (`1:30`); the line under the box shows what it will save (*= 1 h 30 min*). An hour or
  more shows as h:mm when you edit it or tap *Again?*. Still saved as minutes.
- 2026-11-09: **Activity.** Log a walk, a run, the gym — anything active. **+ Activity** sits
  between **+ Splurge** and **Weigh in** at the bottom of Home. *Log activity* asks only *What did
  you do?*; *Again?* brings back recent ones (with their minutes) and *Or pick one* has six quick
  picks (Walk, Run, Bike, Gym, Swim, Yoga — write your own six in Settings → You). How long and
  calories burned are optional; the Day works like a splurge's, with a time that starts at now.
  Log as many a day as you like. Home has a new **Active this week** card: days active of 7
  (from your week start), the minutes and calories burned this week, the last activity, and a dot
  a day. Active days get a green mark under the date on Home's 14 days and in the Calendar. A day
  shows its activities (Edit, Delete) and has **+ Splurge** / **+ Activity** buttons; the
  Splurges and Activity headings show the day's calories (eaten / burned) when any were filled in.
  Each person has their own. The database is upgraded (a copy is kept as
  `data/junk.db.before-v3`); nothing already logged changes.
- 2026-11-09: **Longer goals.** A goal can now say up to 300 characters (it was 120), with a
  counter under the box. The sticky note writes a short goal big and a longer one smaller — 36,
  31, 26, 22 or 19 px by length — so it always fits and still reads at arm's length.
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

### Fixed
- 2026-11-09: A splurge with calories that are not a whole number (12.5) is refused with
  "Calories are a whole number." instead of "Invalid input".
- 2026-10-26: **Code review of goals** (before the first push of it).
  - A goal's day 1 is now set only when the list changes (adding, moving, checking off, undo,
    removing — each sends the phone's day), never just by opening a page, so another website
    can no longer change it through the phone's browser.
  - The Goals page works out the line under the goal now itself, so it is right straight away
    after a move and when Home has not been opened yet.
  - *Done · N* counts every checked-off goal, not just the latest 100 shown.
  - Undo can no longer take the list past 50 open goals.
  - Moving a goal always moves it exactly one place.
  - A theme of your own can set all three goal-note colours, including its small text.
  - Checking off or moving a goal refreshes the page's two lists at once instead of one after
    the other.
  - 38 tests.

### Changed
- 2026-11-09: In the Calendar a weigh-in is now a small dot in the corner of the day (the mark
  under the date is activity, as on Home). The day sheet's summary no longer repeats the
  calories — they are beside the *Splurges* heading.
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
