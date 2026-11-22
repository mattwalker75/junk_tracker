# App ports — Craving Crusher as a phone app

Craving Crusher as an app you install on a phone, with **the log kept on the phone**: no server, no network,
nothing to sign in to. One folder per platform, each with its own `BUILD_APP.sh`:

| Folder | For | Build | The result |
|---|---|---|---|
| `ios/` | iPhone (and iPad) | `ios/BUILD_APP.sh` | `ios/BUILD/Simulator/CravingCrusher.app` (or `ios/BUILD/iPhone/…` with `--device`) |
| `android/` | Android phones | `android/BUILD_APP.sh` | `android/BUILD/CravingCrusher-<version>.apk` |
| `shared/` | what both apps run | — | — |

Each script checks what it needs first and says what to install (`--check`), builds, and at the end says
where the app is and how to try it — on this Mac (`--run`: the iPhone Simulator / the Android Emulator) or on a
phone. `--help` lists the choices. `BUILD/` folders are never committed.

## How it works

The app is **the web app's own page**, built into the app, shown full screen. The page still talks to "the
server" (`/api/…`), but in the app those requests are answered inside the page by **the server's own code** —
`server/src/log.ts`, `goals.ts`, `game.ts`, `users.ts`, unchanged — running on SQLite compiled for the page
(sql.js). After each change the whole database file is handed to the phone app, which keeps it:

- **iPhone:** `Application Support/CravingCrusher/junk.db` (iCloud backs it up with the phone)
- **Android:** the app's `files/junk.db` (Google backs it up with the phone)

The copy before the last change is kept beside it as `junk.db.prev`. The file is the same SQLite database as
the web app's `data/junk.db` (the same tables, from `server/src/migrations.ts`). How the log is kept safe
(`shared/src/open.ts`, tested in `shared/test/keeping.test.ts`):

- **A save that fails** (a full phone) is undone in the app at once: the page says it wasn't saved and shows
  only what the phone kept, so Try again can't log it twice.
- **A log the phone can't read** stops the app with the reason. Nothing is ever saved over it: a new, empty
  log never replaces one the phone failed to read.
- **A damaged log** is moved aside to `junk.db.damaged` and `junk.db.prev` is opened instead; the person is
  told once that the last thing they logged may be missing.
- **Updating the app** keeps the log: installing a new build over the old one (the same app id and signing)
  never touches the app's files. When a new version opens an older log it upgrades it (the same steps as the
  web app), keeps the older one for good as `junk.db.before-v<N>`, and saves the upgraded one at once.
- **Build numbers** come from the version (1.11.0 → 11100), so they only go up, on any Mac. Android refuses an
  update signed with another key (a release build after debug ones, or a build from another Mac): `BUILD_APP.sh`
  says so, and that uninstalling would erase the log. Build updates on the same Mac, in the same mode.
- **Your Apple team** for an iPhone is saved with `ios/BUILD_APP.sh --team <id>` in `ios/CravingCrusher/Local.xcconfig`,
  which git ignores (don't pick it in Xcode's Signing box: that writes it into the tracked project file).

| File | What it does |
|---|---|
| `shared/src/boot.ts` | the page's first script: answers `/api` requests in the app, saves after each change, then loads `web/src/main.tsx` |
| `shared/src/backend.ts` | the same routes as `server/src/app.ts`, on the server's own code |
| `shared/src/sqlite.ts` | the parts of better-sqlite3 the server's code uses, on sql.js |
| `shared/src/store.ts` | where the file is kept: the iPhone app, the Android app, or (in a desktop browser) IndexedDB |
| `shared/src/open.ts` | opening the log (backup, damaged file, upgrade copy) and undoing a change the phone failed to save |
| `shared/vite.config.ts`, `shared/build_page.sh` | build the page for the apps (the BUILD scripts run them) |
| `shared/test/` | the phone code's tests (`npx vitest run --config APP_PORTS/shared/vitest.config.ts`; the BUILD scripts run them) |
| `ios/CravingCrusher/*.swift` | the iPhone app: shows the page, serves its files, keeps the log file |
| `android/app/src/main/java/…/MainActivity.java` | the Android app: the same |

**What the phone app leaves out on purpose:** it is for one person, on their own phone or tablet, with no sign-in
of any kind (Matt, Nov 22 2026). So Settings hides *Users and sign-in* and *Network access* (`web/src/lib/phone.ts`),
there is never a sign-in screen or a *Switched to* strip, the Hall of Heroes lists only your own runs (no names, no
*My runs* tab), `backend.ts` refuses adding users, passwords and Switch to, and About says where the log is. The look
(Appearance) is kept in the database, as there is no config.json.

## Keep apart from the web app

- A port never changes how the web app works. What both need is the web app's own code used as it is; the
  page only knows it is in the app through `PHONE_APP`.
- Updating the web app stays stop → git pull → start: `TRACKER.sh` never builds or needs anything here.
- When the server's routes change (`server/src/app.ts`), change `shared/src/backend.ts` the same way — a test
  fails when a call in `web/src/lib/api.ts` has no answer in the app.
- The icon comes from `Docs/icon/icon.svg`: `node scripts/make_icons.mjs` also writes the iPhone app's icon and
  the Android app's launcher picture. The name under it is exactly **Craving Crusher**.
- Never commit signing keys, keystores or provisioning profiles (`.gitignore` refuses the usual ones).

## Not yet

- **Moving a log between the phone and the web app** (an export / import). The file is the same kind, so it
  can be added later; today the phone's log and the server's log are separate.
- **The stores:** the App Store needs a paid Apple Developer account (99 USD a year) and Play needs a Google
  Play developer account (25 USD once). The scripts make the builds the stores take (`ios`: Xcode's Archive;
  `android`: `--release`).
