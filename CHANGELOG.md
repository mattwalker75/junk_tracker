# Changelog

All notable changes to Junk Tracker (Keep a Changelog style; dates are when the change was made).

## [Unreleased]

## [1.1.0] — 2026-11-14
Craving Crusher: splurging at full HP now costs something, and a run can start by itself each day.

### Added
- 2026-11-14: **Bonus HP.** A splurge when the monster is already at full HP is no longer free:
  what doesn't fit goes on as **bonus HP**, a violet bar laid over its HP bar, up to **20% of its
  max HP** (20 for Crumbs). Workouts knock the bonus off first, and "So close!", the map, the
  Monster Book and the live panels count it in the HP left. The size buttons show "+20 bonus", or
  "maxed out" once the bonus bar is full. How to crush explains it.
- 2026-11-14: **Keep the monsters coming** (Settings → You, off unless you turn it on). The first
  time you open game mode each day, if your last run is over (or you never started one), a new run
  starts by itself with Crumbs, in the same mode as your last one, and a note at the top says so.
  When a run ends you still see how it went first; the new one starts the next day. (Inside a run
  the next monster already started by itself the moment you beat one.)

### Changed
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
