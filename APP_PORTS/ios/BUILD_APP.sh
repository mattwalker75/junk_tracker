#!/usr/bin/env bash
# Craving Crusher for iPhone — build it, and try it on this Mac or on an iPhone.
#
#   ./BUILD_APP.sh            build for the iPhone Simulator on this Mac      → BUILD/Simulator/CravingCrusher.app
#   ./BUILD_APP.sh --run      build it, then open it in the iPhone Simulator
#   ./BUILD_APP.sh --team ABCDE12345   save your Apple developer team once (in CravingCrusher/Local.xcconfig, which git ignores)
#   ./BUILD_APP.sh --health off|on     build without Apple Health (if Apple won't give your team HealthKit), or with it again
#   ./BUILD_APP.sh --device   build for a real iPhone (needs your team)      → BUILD/iPhone/CravingCrusher.app
#                             and put it on the iPhone plugged into this Mac, if there is one
#   ./BUILD_APP.sh --open     build the page, then open the project in Xcode (Run it on your iPhone from there)
#   ./BUILD_APP.sh --check    only check that everything needed is installed
#   ./BUILD_APP.sh --clean    remove what the builds made (BUILD/ and the built page)
#
# Settings (optional):  CC_TEAM_ID=ABCDE12345   your Apple developer team for this run (or save it with --team)
#                       CC_BUNDLE_ID=…          the app's id (default app.cravingcrusher.phone); change it if Apple says it's taken
#                       CC_SIMULATOR="iPhone 17" which Simulator --run uses
#                       CC_DEVICE=<id>          which iPhone --device installs on (xcrun devicectl list devices)
#
# The app is the web app's page with its log kept on the phone (APP_PORTS/README.md). Nothing here touches the
# web app or its data.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
BUILD="$HERE/BUILD"
PAGE="$HERE/CravingCrusher/web"
PROJECT="$HERE/CravingCrusher.xcodeproj"
BUNDLE_ID="${CC_BUNDLE_ID:-app.cravingcrusher.phone}"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }
note() { printf '      %s\n' "$*"; }
info() { printf '  %s\n' "$*"; }
die()  { printf '\n  \033[31m✗\033[0m %s\n\n' "$*" >&2; exit 1; }

# ------------------------------------------------------------------ what's needed
# Prints each requirement with ✓ or ✗ and, for a ✗, what to install. Returns 1 if anything is missing.
requirements() {
  local missing=0
  bold "What building the iPhone app needs"
  if [[ "$(uname -s)" == Darwin ]]; then ok "a Mac (macOS $(sw_vers -productVersion))"; else bad "a Mac — iPhone apps are only built on macOS"; return 1; fi

  local dev; dev="$(xcode-select -p 2>/dev/null || true)"
  if [[ "$dev" == *Xcode*.app/Contents/Developer ]] && xcodebuild -version >/dev/null 2>&1; then
    ok "Xcode ($(xcodebuild -version | head -n 1 | sed 's/Xcode //'))"
  else
    bad "Xcode, the full app (not only the Command Line Tools)"
    note "Install it from the Mac App Store (free, about 10 GB), open it once, then run:"
    note "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
    missing=1
  fi

  if [[ $missing == 0 ]]; then
    if xcodebuild -checkFirstLaunchStatus >/dev/null 2>&1; then ok "Xcode is set up (its first-launch parts are installed)"
    else bad "Xcode's first-launch parts"; note "Open Xcode once and let it finish, or run: sudo xcodebuild -runFirstLaunch"; missing=1; fi
    if xcodebuild -license check >/dev/null 2>&1; then ok "Xcode's license is accepted"
    else bad "Xcode's license"; note "Run: sudo xcodebuild -license accept"; missing=1; fi
    local rt; rt="$(xcrun simctl list runtimes 2>/dev/null | grep -E '^iOS [0-9]' | tail -n 1 | sed 's/ (.*//' || true)"
    if [[ -n "$rt" ]]; then ok "the iPhone Simulator ($rt)"
    else bad "the iPhone Simulator (an iOS runtime)"; note "Xcode → Settings → Components → iOS → Get, or run: xcodebuild -downloadPlatform iOS"; missing=1; fi
  fi

  export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
  if command -v node >/dev/null 2>&1 && node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=12)?0:1)'; then
    ok "Node.js $(node -v) (builds the page)"
  else
    bad "Node.js 22.12 or newer (builds the page)"; note "Install it from https://nodejs.org or run: brew install node"; missing=1
  fi

  if [[ -n "$(team)" ]]; then ok "for a real iPhone: Apple developer team $(team)"
  else info "· for a real iPhone only: your Apple ID added in Xcode → Settings → Accounts (a free one works),"
       note "and its team id saved once: ./BUILD_APP.sh --team <id>"; fi
  return $missing
}

page() { "$REPO/APP_PORTS/shared/build_page.sh" "$PAGE" "${1:-}"; versions; }

# your team: CC_TEAM_ID for this run, else the one saved with --team (Local.xcconfig, untracked — never the project file)
LOCAL_XC="$HERE/CravingCrusher/Local.xcconfig"
team() { if [[ -n "${CC_TEAM_ID:-}" ]]; then echo "$CC_TEAM_ID"; elif [[ -f "$LOCAL_XC" ]]; then sed -nE 's/^DEVELOPMENT_TEAM *= *([A-Z0-9]+).*/\1/p' "$LOCAL_XC" | head -n 1; fi; }
saved_team() { [[ -f "$LOCAL_XC" ]] && sed -nE 's/^DEVELOPMENT_TEAM *= *([A-Z0-9]+).*/\1/p' "$LOCAL_XC" | head -n 1 || true; }
health_off() { [[ -f "$LOCAL_XC" ]] && grep -q '^CC_HEALTH_FLAG *= *CC_NO_HEALTH' "$LOCAL_XC"; }
# Local.xcconfig holds your team and whether Apple Health is left out — both yours, never in git
write_local() { # <team> <off|on>
  { echo "// yours, written by ./BUILD_APP.sh (--team, --health) — not in git"
    [[ -n "$1" ]] && echo "DEVELOPMENT_TEAM = $1"
    if [[ "$2" == off ]]; then echo "CODE_SIGN_ENTITLEMENTS ="; echo "CC_HEALTH_FLAG = CC_NO_HEALTH"; fi
  } >"$LOCAL_XC"
}
# the version for Xcode's own builds too (▶ in Xcode), in the untracked Version.xcconfig
versions() { printf '// written by BUILD_APP.sh — not in git\nMARKETING_VERSION = %s\nCURRENT_PROJECT_VERSION = %s\n' "$(version)" "$(buildnum)" >"$HERE/CravingCrusher/Version.xcconfig"; }

version()  { node -p "require('$REPO/package.json').version"; }
# the build number comes from the version (1.11.0 → 11100), so it only ever goes up and is the same on any
# Mac or clone (it was the git commit count, which a fresh or shallow clone makes lower: Android then refuses the update)
buildnum() { node -p "const [a, b, c] = require('$REPO/package.json').version.split('.').map(Number); a * 10000 + b * 100 + c"; }

# xcodebuild into BUILD/DerivedData; the log goes to BUILD/xcodebuild.log
xcode() {
  local sdk="$1"; shift
  mkdir -p "$BUILD"
  info "Building the app with Xcode ($sdk)… (the details go to BUILD/xcodebuild.log)"
  if ! CC_PAGE_BUILT=1 xcodebuild -project "$PROJECT" -scheme CravingCrusher -configuration Release -sdk "$sdk" \
      -derivedDataPath "$BUILD/DerivedData" MARKETING_VERSION="$(version)" CURRENT_PROJECT_VERSION="$(buildnum)" \
      PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID" "$@" build >"$BUILD/xcodebuild.log" 2>&1; then
    grep -E "error:|BUILD FAILED" "$BUILD/xcodebuild.log" | head -n 15 >&2 || tail -n 25 "$BUILD/xcodebuild.log" >&2
    if grep -qiE "healthkit" "$BUILD/xcodebuild.log"; then
      bad "Apple would not sign the app with Apple Health for this team (a free Apple ID may not get HealthKit)."
      note "Build it without Apple Health: ./BUILD_APP.sh --health off, then this again (Settings → You says so in the app)."
    fi
    die "Xcode could not build the app (above; all of it is in $BUILD/xcodebuild.log)."
  fi
}

copy_app() { # <sdk folder name> <BUILD subfolder>
  local from="$BUILD/DerivedData/Build/Products/Release-$1/CravingCrusher.app"
  [[ -d "$from" ]] || die "Xcode finished but the app is not at $from."
  mkdir -p "$BUILD/$2"
  rm -rf "$BUILD/$2/CravingCrusher.app"
  ditto "$from" "$BUILD/$2/CravingCrusher.app"
}

simulator_id() {
  xcrun simctl list devices available -j | CC_SIMULATOR="${CC_SIMULATOR:-}" node -e '
    const all = Object.entries(JSON.parse(require("fs").readFileSync(0, "utf8")).devices)
      .filter(([rt]) => rt.includes("iOS")).flatMap(([, d]) => d).filter((d) => d.isAvailable !== false);
    const want = process.env.CC_SIMULATOR;
    const pick = (want && all.find((d) => d.name === want)) || all.find((d) => d.name === "iPhone 17")
      || all.find((d) => /^iPhone/.test(d.name));
    if (pick) console.log(pick.udid);'
}

callout_simulator() {
  local app="$BUILD/Simulator/CravingCrusher.app"
  echo
  bold "Craving Crusher for iPhone $(version) is built."
  echo
  info "The app (for the iPhone Simulator on a Mac):"
  info "  $app"
  echo
  bold "Try it on this Mac"
  info "  ./BUILD_APP.sh --run   opens it in the iPhone Simulator (Xcode's pretend iPhone)."
  info "  Or open the Simulator yourself (Xcode → Open Developer Tool → Simulator) and drag the .app onto it."
  info "  Its log is kept inside the Simulator, apart from your real one."
  echo
  bold "Try it on your iPhone"
  info "  The Simulator build only runs in the Simulator. For your iPhone:"
  info "  1. Plug the iPhone into this Mac, unlock it and tap Trust."
  info "  2. On the iPhone: Settings → Privacy & Security → Developer Mode → On (it restarts)."
  info "  3. Once: ./BUILD_APP.sh --team <your team id>. Find the id in Xcode → Settings → Accounts → your Apple ID"
  info "     (add it there first; a free one works). It is saved where git doesn't look, so pulls stay clean."
  info "  4. ./BUILD_APP.sh --device puts it on the iPhone plugged in. Or ./BUILD_APP.sh --open, pick the iPhone"
  info "     at the top of Xcode and press ▶. Don't pick the Team in Xcode's Signing box: that writes it into the project."
  info "  5. The first time: on the iPhone, Settings → General → VPN & Device Management → trust your Apple ID."
  info "  Updating: build and install again the same way. The log on the iPhone stays; an older log is upgraded"
  info "  and kept beside it as junk.db.before-v<N>."
  info "  With a free Apple ID the app runs for 7 days, then press Run again (your log stays)."
  info "  A paid Apple Developer account (99 USD a year) is needed for TestFlight and the App Store."
  echo
  bold "As an app on this Mac"
  info "  Apple-silicon Macs run iPhone apps: in Xcode pick \"My Mac (Designed for iPad)\" and press ▶"
  info "  (it needs your Apple ID's team, as for an iPhone)."
  echo
}

# ------------------------------------------------------------------ the commands
cmd="${1:-build}"
case "$cmd" in
  -h|--help|help) sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;

  --page-for-xcode)  # the "Build the page" step inside Xcode (Run in Xcode builds the page too)
    if [[ "${CC_PAGE_BUILT:-}" == 1 ]]; then exit 0; fi
    page; exit 0 ;;

  --check) requirements && { echo; ok "Everything is ready: ./BUILD_APP.sh builds the app."; echo; } || { echo; die "Install what is marked ✗, then run ./BUILD_APP.sh --check again."; } ;;

  --clean)
    rm -rf "$HERE/BUILD" "$HERE/CravingCrusher/web"
    ok "Removed BUILD/ and the built page."; exit 0 ;;

  --open)
    requirements >/dev/null || { requirements || true; die "Install what is marked ✗ first."; }
    page --test
    open "$PROJECT"
    if [[ -n "$(team)" ]]; then ok "Opened the project in Xcode (team $(team)). Pick your iPhone at the top, then ▶."
    else ok "Opened the project in Xcode. For an iPhone, save your team first: ./BUILD_APP.sh --team <id>, then ▶ in Xcode."; fi
    exit 0 ;;

  --health)
    case "${2:-}" in
      off) write_local "$(saved_team)" off; ok "Apple Health is left out of the next builds (CravingCrusher/Local.xcconfig). ./BUILD_APP.sh --health on puts it back." ;;
      on)  write_local "$(saved_team)" on;  ok "Apple Health is back in the next builds." ;;
      *)   die "Say --health off (build without Apple Health) or --health on." ;;
    esac
    exit 0 ;;

  --team)
    id="${2:-}"
    [[ "$id" =~ ^[A-Z0-9]{10}$ ]] || die "Give your 10-character team id: ./BUILD_APP.sh --team ABCDE12345 (Xcode → Settings → Accounts → your Apple ID)."
    write_local "$id" "$(health_off && echo off || echo on)"
    ok "Saved team $id in CravingCrusher/Local.xcconfig (git ignores it). ./BUILD_APP.sh --device or --open uses it."
    exit 0 ;;

  build|--build|--run)
    requirements >/dev/null || { requirements || true; die "Install what is marked ✗, then run ./BUILD_APP.sh again."; }
    bold "Building Craving Crusher for iPhone $(version) (iPhone Simulator)"
    page --test
    xcode iphonesimulator
    copy_app iphonesimulator Simulator
    ok "Built."
    if [[ "$cmd" != --run ]]; then callout_simulator; exit 0; fi

    udid="$(simulator_id)"
    [[ -n "$udid" ]] || die "No iPhone Simulator is set up. Add one in Xcode → Window → Devices and Simulators → Simulators → +."
    info "Starting the iPhone Simulator…"
    xcrun simctl boot "$udid" 2>/dev/null || true
    # the Simulator's window is its own app, inside Xcode (some Xcode installs lack it: the pretend iPhone
    # still runs, only unseen)
    sim_app="$(mdfind "kMDItemCFBundleIdentifier == 'com.apple.iphonesimulator'" 2>/dev/null | head -n 1)"
    [[ -n "$sim_app" ]] || for c in "$(xcode-select -p)/Applications/Simulator.app" /Applications/Xcode.app/Contents/Developer/Applications/Simulator.app; do
      [[ -d "$c" ]] && { sim_app="$c"; break; }
    done
    [[ -n "$sim_app" ]] && open "$sim_app" --args -CurrentDeviceUDID "$udid"
    xcrun simctl bootstatus "$udid" -b >/dev/null
    xcrun simctl install "$udid" "$BUILD/Simulator/CravingCrusher.app"
    xcrun simctl launch "$udid" "$BUNDLE_ID" >/dev/null
    sleep 4
    xcrun simctl io "$udid" screenshot "$BUILD/Simulator/screenshot.png" >/dev/null 2>&1 || true
    if [[ -n "$sim_app" ]]; then
      ok "Craving Crusher is open in the Simulator. Its icon is on the Simulator's home screen too."
    else
      ok "Craving Crusher is running in the iPhone Simulator — but this Mac has no Simulator window to show it."
      note "A screenshot of it: $BUILD/Simulator/screenshot.png"
      note "To see and use it: in Xcode, Xcode menu → Open Developer Tool → Simulator. If that isn't there,"
      note "reinstall Xcode from the App Store (the Simulator app comes with it)."
    fi
    callout_simulator ;;

  --device)
    requirements >/dev/null || { requirements || true; die "Install what is marked ✗, then run ./BUILD_APP.sh --device again."; }
    [[ -n "$(team)" ]] || die "A real iPhone needs your Apple developer team. Save it once: ./BUILD_APP.sh --team <team id>
      (Xcode → Settings → Accounts → your Apple ID → the team's id)."
    bold "Building Craving Crusher for iPhone $(version) (a real iPhone, team $(team))"
    page --test
    xcode iphoneos DEVELOPMENT_TEAM="$(team)" CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates
    copy_app iphoneos iPhone
    ok "Built: $BUILD/iPhone/CravingCrusher.app"
    device="${CC_DEVICE:-}"
    if [[ -z "$device" ]]; then
      list="$(mktemp -t cc-devices)"
      if xcrun devicectl list devices --json-output "$list" >/dev/null 2>&1; then
        device="$(node -e '
          const d = (JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).result?.devices || [])
            .filter((x) => x.hardwareProperties?.platform === "iOS" && x.connectionProperties?.tunnelState !== "unavailable");
          if (d.length === 1) console.log(d[0].identifier);' "$list")"
      fi
      rm -f "$list"
    fi
    if [[ -n "$device" ]]; then
      info "Putting it on the iPhone…"
      xcrun devicectl device install app --device "$device" "$BUILD/iPhone/CravingCrusher.app" >/dev/null \
        && ok "Craving Crusher is on the iPhone. The first time, trust your Apple ID on the iPhone: Settings → General → VPN & Device Management." \
        || die "The iPhone would not take it. Is it unlocked, with Developer Mode on? (xcrun devicectl list devices shows what this Mac sees.)"
    else
      info "No single iPhone is plugged in (or several are): set CC_DEVICE=<id> from 'xcrun devicectl list devices',"
      info "or run it from Xcode (./BUILD_APP.sh --open → pick the iPhone → ▶)."
    fi
    echo ;;

  *) die "Unknown choice: $cmd (./BUILD_APP.sh --help lists them)." ;;
esac
