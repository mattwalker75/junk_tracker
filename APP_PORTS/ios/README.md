# Craving Crusher for iPhone

```bash
./BUILD_APP.sh --check    # what's needed, and what to install for anything missing
./BUILD_APP.sh            # build it for the iPhone Simulator → BUILD/Simulator/CravingCrusher.app
./BUILD_APP.sh --run      # build it and open it in the iPhone Simulator on this Mac
./BUILD_APP.sh --open     # open the project in Xcode, to Run it on your iPhone
CC_TEAM_ID=<team> ./BUILD_APP.sh --device   # build for a real iPhone and put it on the one plugged in
```

At the end the script says where the app is and how to try it. See `../README.md` for how the app works.

**Needs:** a Mac with Xcode (from the App Store, opened once), the iPhone Simulator (Xcode → Settings →
Components), and Node.js 22.12+. For a real iPhone: your Apple ID in Xcode → Settings → Accounts (a free
one works; the app then runs for 7 days at a time) and Developer Mode on the iPhone.

| File | |
|---|---|
| `CravingCrusher.xcodeproj` | the Xcode project (opens in Xcode; *Build the page* runs first in every build) |
| `CravingCrusher/CravingCrusherApp.swift` | the app's start |
| `CravingCrusher/PhoneWebView.swift` | the screen: the page, its files (cc-app://local/…) and the log file |
| `CravingCrusher/Assets.xcassets` | the icon — `icon-1024.png` is written by `scripts/make_icons.mjs`, don't edit it |
| `CravingCrusher/web/` | the built page (made by the build, not committed) |
| `BUILD/` | what the builds make (not committed) |

- The app's id is `app.cravingcrusher.phone`. If Apple says it's taken when you pick your team, set another:
  `CC_BUNDLE_ID=com.yourname.cravingcrusher ./BUILD_APP.sh --device` (or change it in Xcode).
- Testing: the debug build can be inspected from Safari on the Mac (Develop menu → the Simulator or iPhone).
- If the Simulator shows a black screen after a change to the app's Swift start-up code, remove the app from
  the Simulator (or `xcrun simctl uninstall booted app.cravingcrusher.phone`) and run again: it remembers the
  old app's window.
- This Mac's Xcode (27.2, Nov 2026) came without the Simulator's window app: `--run` still runs the app on the
  pretend iPhone and saves `BUILD/Simulator/screenshot.png`, and says how to get the window.
