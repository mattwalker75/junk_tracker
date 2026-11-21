# App ports — Craving Crusher as a phone app

This folder holds the versions of Craving Crusher made to install as a real app on a phone, one folder
per platform:

| Folder | For |
|---|---|
| `ios/` | iPhone (and iPad), built with Xcode, sold or shared through the App Store / TestFlight |
| `android/` | Android phones, built with Android Studio, shared through the Play Store or an APK |

Nothing is built here yet (Nov 21 2026). The web app in the rest of the repo is still the one that runs.

## What a port starts from

- **The name** is exactly **Craving Crusher** under the icon, as on the web app's home-screen link.
- **The icon** is one drawing, `Docs/icon/icon.svg` (Matt's pick, idea 9). `Docs/icon/icon-1024.png` is the
  App Store size; `Docs/icon/README.md` says how to make Android's adaptive-icon layers from the drawing.
- **What the app does** is the web app: the tracker (`Docs/USER_GUIDE.md`), the game Calorie Crusher
  (`Docs/GAME_MODE.md`, `Docs/game/ARCHITECTURE.md`) and the rules in `CLAUDE.md`. The game engine in
  `shared/game/` is plain TypeScript with no web parts, so a port written in JavaScript or TypeScript can
  use it as it is.

## Keep apart from the web app

- A port never changes the web app's files to suit itself; anything both need goes in `shared/`.
- Updating the web app stays stop → git pull → start: nothing in here is built or needed by `TRACKER.sh`.
- When a port gets real code, add its build folders (Xcode's `build/`, `DerivedData/`, Android's `.gradle/`,
  `build/`, `local.properties`, any `node_modules/`) to the repo's `.gitignore`, and never commit signing
  keys, keystores or provisioning profiles.
