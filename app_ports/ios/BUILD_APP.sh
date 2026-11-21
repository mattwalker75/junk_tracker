#!/usr/bin/env bash
# Craving Crusher for iPhone — build it, and try it on this Mac or on an iPhone.
#
#   ./BUILD_APP.sh            build for the iPhone Simulator on this Mac      → BUILD/Simulator/CravingCrusher.app
#   ./BUILD_APP.sh --run      build it, then open it in the iPhone Simulator
#   ./BUILD_APP.sh --device   build for a real iPhone (needs CC_TEAM_ID)     → BUILD/iPhone/CravingCrusher.app
#                             and put it on the iPhone plugged into this Mac, if there is one
#   ./BUILD_APP.sh --open     build the page, then open the project in Xcode (Run it on your iPhone from there)
#   ./BUILD_APP.sh --check    only check that everything needed is installed
#   ./BUILD_APP.sh --clean    remove what the builds made (BUILD/ and the built page)
#
# Settings (optional):  CC_TEAM_ID=ABCDE12345   your Apple developer team (Xcode → Settings → Accounts)
#                       CC_BUNDLE_ID=…          the app's id (default app.cravingcrusher.phone); change it if Apple says it's taken
#                       CC_SIMULATOR="iPhone 17" which Simulator --run uses
#                       CC_DEVICE=<id>          which iPhone --device installs on (xcrun devicectl list devices)
#
# The app is the web app's page with its log kept on the phone (app_ports/README.md). Nothing here touches the
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

  if [[ -n "${CC_TEAM_ID:-}" ]]; then ok "for a real iPhone: Apple developer team $CC_TEAM_ID"
  else info "· for a real iPhone only: your Apple ID added in Xcode → Settings → Accounts (a free one works),"
       note "and its team id as CC_TEAM_ID (or pick the team in Xcode — see --open)"; fi
  return $missing
}

page() { "$REPO/app_ports/shared/build_page.sh" "$PAGE" "${1:-}"; }

version()  { node -p "require('$REPO/package.json').version"; }
buildnum() { git -C "$REPO" rev-list --count HEAD 2>/dev/null || echo 1; }

# xcodebuild into BUILD/DerivedData; the log goes to BUILD/xcodebuild.log
xcode() {
  local sdk="$1"; shift
  mkdir -p "$BUILD"
  info "Building the app with Xcode ($sdk)… (the details go to BUILD/xcodebuild.log)"
  if ! CC_PAGE_BUILT=1 xcodebuild -project "$PROJECT" -scheme CravingCrusher -configuration Release -sdk "$sdk" \
      -derivedDataPath "$BUILD/DerivedData" MARKETING_VERSION="$(version)" CURRENT_PROJECT_VERSION="$(buildnum)" \
      PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID" "$@" build >"$BUILD/xcodebuild.log" 2>&1; then
    grep -E "error:|BUILD FAILED" "$BUILD/xcodebuild.log" | head -n 15 >&2 || tail -n 25 "$BUILD/xcodebuild.log" >&2
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
  info "  3. ./BUILD_APP.sh --open, then in Xcode: click CravingCrusher (top left) → Signing & Capabilities →"
  info "     Team → your Apple ID (add it in Xcode → Settings → Accounts; a free one works)."
  info "  4. Pick your iPhone at the top of Xcode and press ▶ (Run)."
  info "  5. The first time: on the iPhone, Settings → General → VPN & Device Management → trust your Apple ID."
  info "  Or without Xcode's window: CC_TEAM_ID=<your team id> ./BUILD_APP.sh --device"
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
  -h|--help|help) sed -n '2,19p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;

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
    ok "Opened the project in Xcode. Pick the team (Signing & Capabilities), your iPhone at the top, then ▶."
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
    [[ -n "${CC_TEAM_ID:-}" ]] || die "A real iPhone needs your Apple developer team: CC_TEAM_ID=<team id> ./BUILD_APP.sh --device
      (Xcode → Settings → Accounts → your Apple ID → the team's id; or use ./BUILD_APP.sh --open and pick the team in Xcode)."
    bold "Building Craving Crusher for iPhone $(version) (a real iPhone, team $CC_TEAM_ID)"
    page --test
    xcode iphoneos DEVELOPMENT_TEAM="$CC_TEAM_ID" CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates
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
