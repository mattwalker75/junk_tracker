#!/usr/bin/env bash
# Craving Crusher for Android — build it, and try it on this Mac or on an Android phone.
#
#   ./BUILD_APP.sh                 build the app                         → BUILD/CravingCrusher-<version>.apk
#   ./BUILD_APP.sh --run           build it, then open it in the Android Emulator (a pretend phone on this Mac)
#   ./BUILD_APP.sh --install       build it, then put it on the Android phone plugged into this Mac (USB debugging on)
#   ./BUILD_APP.sh --release       a build for the Play Store, signed with your key  → BUILD/…-release.apk and .aab
#   ./BUILD_APP.sh --check         only check that everything needed is installed
#   ./BUILD_APP.sh --install-tools install what's missing with Homebrew (Java 21, Android's tools, the emulator)
#   ./BUILD_APP.sh --clean         remove what the builds made (BUILD/, Gradle's build folders, the built page)
#
# Settings (optional):  CC_APP_ID=…   the app's id (default app.cravingcrusher.phone)
#                       CC_KEYSTORE, CC_KEYSTORE_PASSWORD, CC_KEY_ALIAS, CC_KEY_PASSWORD   your signing key, for --release
#                       JAVA_HOME / ANDROID_HOME   where Java and the Android SDK are, if not found by themselves
#                       CC_HEALTH_TEST=1   a test build that may also write a test workout to Health Connect (the emulator only)
#
# The app is the web app's page with its log kept on the phone (APP_PORTS/README.md). Nothing here touches the
# web app or its data.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
BUILD="$HERE/BUILD"
PAGE="$HERE/app/src/main/assets/web"
APP_ID="${CC_APP_ID:-app.cravingcrusher.phone}"
API=36                                        # the Android version the app is built for (Android 16)
IMAGE="system-images;android-$API;google_apis;arm64-v8a"
AVD="CravingCrusher_Phone"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }
note() { printf '      %s\n' "$*"; }
info() { printf '  %s\n' "$*"; }
die()  { printf '\n  \033[31m✗\033[0m %s\n\n' "$*" >&2; exit 1; }

export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"

# ------------------------------------------------------------------ finding the tools
java_major() { "$1/bin/java" -version 2>&1 | head -n 1 | sed -E 's/.*version "([0-9]+).*/\1/'; }
find_java() {   # a JDK 17–25 (Gradle runs on these); 21 first
  local c
  for c in "${JAVA_HOME:-}" \
           /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home /usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
           "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
           "$(/usr/libexec/java_home -v 21 2>/dev/null || true)" "$(/usr/libexec/java_home -v 17 2>/dev/null || true)" \
           /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home; do
    [[ -n "$c" && -x "$c/bin/java" ]] || continue
    local m; m="$(java_major "$c")"
    [[ "$m" =~ ^[0-9]+$ ]] && (( m >= 17 && m <= 25 )) && { echo "$c"; return 0; }
  done
  return 1
}
find_sdk() {
  local c
  for c in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Library/Android/sdk" /opt/homebrew/share/android-commandlinetools /usr/local/share/android-commandlinetools; do
    [[ -n "$c" && -d "$c/platforms" || -n "$c" && -d "$c/cmdline-tools" ]] && { echo "$c"; return 0; }
  done
  return 1
}
sdkmanager_in() { local s="$1"; for c in "$s/cmdline-tools/latest/bin/sdkmanager" "$s"/cmdline-tools/*/bin/sdkmanager; do [[ -x "$c" ]] && { echo "$c"; return 0; }; done; return 1; }

# ------------------------------------------------------------------ what's needed
# Prints each requirement with ✓ or ✗ and, for a ✗, what to install. Returns 1 if anything needed to build is missing.
requirements() {
  local missing=0 sdk="" j=""
  bold "What building the Android app needs"

  if j="$(find_java)"; then ok "Java $(java_major "$j") (a JDK, 17 to 25): $j"
  else
    bad "Java 17 to 25 (a JDK — Gradle, Android's build tool, runs on it)"
    note "Install: brew install openjdk@21   (or Android Studio, which brings its own)"
    missing=1
  fi

  if sdk="$(find_sdk)"; then
    ok "the Android SDK: $sdk"
    if [[ -d "$sdk/platforms/android-$API" ]]; then ok "Android $API (the platform the app builds against)"
    else bad "the Android $API platform"; note "Install: $(sdkmanager_in "$sdk" 2>/dev/null || echo sdkmanager) --install \"platforms;android-$API\""; missing=1; fi
    if ls "$sdk/build-tools" >/dev/null 2>&1 && [[ -n "$(ls "$sdk/build-tools" 2>/dev/null)" ]]; then ok "the build tools ($(ls "$sdk/build-tools" | sort -V | tail -n 1))"
    else bad "the Android build tools"; note "Install: sdkmanager --install \"build-tools;36.1.0\""; missing=1; fi
    if [[ -f "$sdk/licenses/android-sdk-license" ]]; then ok "Android's licences are accepted"
    else bad "Android's licences"; note "Accept them: yes | $(sdkmanager_in "$sdk" 2>/dev/null || echo sdkmanager) --licenses"; missing=1; fi
    if [[ -x "$sdk/platform-tools/adb" ]]; then ok "adb (puts the app on a phone or the emulator)"
    else info "· for --run / --install: adb — sdkmanager --install \"platform-tools\""; fi
    if [[ -x "$sdk/emulator/emulator" && -d "$sdk/system-images/android-$API/google_apis/arm64-v8a" ]]; then ok "the Android Emulator, with an Android $API phone image (for --run)"
    else info "· for --run only: the emulator — sdkmanager --install \"emulator\" \"$IMAGE\""; fi
  else
    bad "the Android SDK (Android's build tools)"
    note "Easiest: install Android Studio (https://developer.android.com/studio), open it once and finish its"
    note "setup — it brings Java, the SDK and the emulator. Or with Homebrew: ./BUILD_APP.sh --install-tools"
    missing=1
  fi

  if command -v node >/dev/null 2>&1 && node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=12)?0:1)'; then
    ok "Node.js $(node -v) (builds the page)"
  else
    bad "Node.js 22.12 or newer (builds the page)"; note "Install it from https://nodejs.org or run: brew install node"; missing=1
  fi
  return $missing
}

install_tools() {
  command -v brew >/dev/null 2>&1 || die "Homebrew is needed for --install-tools (https://brew.sh). Or install Android Studio instead: https://developer.android.com/studio"
  bold "Installing Android's tools with Homebrew (a few GB; it takes a while)"
  find_java >/dev/null || { info "Java 21…"; brew install openjdk@21; }
  local sdk; sdk="$(find_sdk || true)"
  if [[ -z "$sdk" ]] || ! sdkmanager_in "$sdk" >/dev/null; then info "Android's command-line tools…"; brew install --cask android-commandlinetools; sdk="$(find_sdk)"; fi
  local sm; sm="$(sdkmanager_in "$sdk")"
  export JAVA_HOME; JAVA_HOME="$(find_java)"
  info "Accepting Android's licences…"; yes | "$sm" --licenses >/dev/null 2>&1 || true
  info "The platform, build tools, adb, the emulator and a phone image…"
  "$sm" --install "platform-tools" "platforms;android-$API" "build-tools;36.1.0" "emulator" "$IMAGE" >/dev/null
  ok "Installed."
}

page() { "$REPO/APP_PORTS/shared/build_page.sh" "$PAGE" --test; }
version()  { node -p "require('$REPO/package.json').version"; }
# the build number comes from the version (1.11.0 → 11100), so it only ever goes up and is the same on any
# Mac or clone (it was the git commit count, which a fresh or shallow clone makes lower: Android then refuses the update)
buildnum() { node -p "const [a, b, c] = require('$REPO/package.json').version.split('.').map(Number); a * 10000 + b * 100 + c"; }

gradle() {
  export JAVA_HOME ANDROID_HOME
  JAVA_HOME="$(find_java)"; ANDROID_HOME="$(find_sdk)"
  mkdir -p "$BUILD"
  info "Building the app with Gradle… (the first time it downloads Gradle and Android's build plugin; the details go to BUILD/gradle.log)"
  if ! (cd "$HERE" && ./gradlew --no-daemon -q "$@" -PccVersion="$(version)" -PccVersionCode="$(buildnum)" -PccAppId="$APP_ID" ${CC_HEALTH_TEST:+-PccHealthTest=1}) >"$BUILD/gradle.log" 2>&1; then
    grep -E "error:|FAILURE|What went wrong" -A3 "$BUILD/gradle.log" | head -n 25 >&2 || tail -n 25 "$BUILD/gradle.log" >&2
    die "Gradle could not build the app (above; all of it is in $BUILD/gradle.log)."
  fi
}

adb_() { "$(find_sdk)/platform-tools/adb" "$@"; }

callout() {
  local apk="$1"
  echo
  bold "Craving Crusher for Android $(version) is built."
  echo
  info "The app:"
  info "  $apk"
  echo
  bold "Try it on this Mac"
  info "  ./BUILD_APP.sh --run   opens it in the Android Emulator (a pretend Android phone)."
  info "  Or, with Android Studio: Device Manager → start a phone → drag the .apk onto it."
  info "  Its log is kept inside the emulator, apart from your real one."
  echo
  bold "Try it on your Android phone"
  info "  With a cable:"
  info "  1. On the phone: Settings → About phone → tap Build number 7 times (this turns on Developer options)."
  info "  2. Settings → System → Developer options → USB debugging → On."
  info "  3. Plug the phone into this Mac, tap Allow on the phone, then: ./BUILD_APP.sh --install"
  info "  Without a cable: send the .apk to the phone (Google Drive, email, Quick Share), open it there,"
  info "  allow \"Install unknown apps\" for the app you opened it with, then tap Install."
  info "  This build is for trying it out. For the Play Store: ./BUILD_APP.sh --release with your own signing key"
  info "  (and a Google Play developer account, a one-time 25 USD)."
  echo
}

ensure_avd() {
  local sdk avdm; sdk="$(find_sdk)"
  avdm="$(dirname "$(sdkmanager_in "$sdk")")/avdmanager"
  [[ -x "$sdk/emulator/emulator" && -d "$sdk/system-images/android-$API/google_apis/arm64-v8a" ]] \
    || die "The emulator or its phone image is missing: $(sdkmanager_in "$sdk") --install \"emulator\" \"$IMAGE\" (or ./BUILD_APP.sh --install-tools)."
  if ! "$sdk/emulator/emulator" -list-avds 2>/dev/null | grep -qx "$AVD"; then
    info "Making a pretend phone for the emulator ($AVD)…"
    local dev=""; "$avdm" list device -c 2>/dev/null | grep -qx "pixel_8" && dev="--device pixel_8"
    # (avdmanager may grumble about a devices.xml in the image; the phone is made anyway, which is checked)
    echo no | "$avdm" create avd --name "$AVD" --package "$IMAGE" $dev >/dev/null 2>&1 || true
    "$sdk/emulator/emulator" -list-avds 2>/dev/null | grep -qx "$AVD" || die "Could not make the pretend phone. Make one in Android Studio (Device Manager), named $AVD."
  fi
}

boot_emulator() {
  local sdk; sdk="$(find_sdk)"
  if ! adb_ devices | grep -q "^emulator-"; then
    info "Starting the Android Emulator (the first start takes a minute)…"
    local window=(); [[ "${CC_NO_WINDOW:-}" == 1 ]] && window=(-no-window -no-audio)
    nohup "$sdk/emulator/emulator" -avd "$AVD" -no-snapshot-save "${window[@]}" >"$BUILD/emulator.log" 2>&1 &
  fi
  adb_ wait-for-device
  local i
  for i in $(seq 1 120); do
    [[ "$(adb_ -e shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == 1 ]] && return 0
    sleep 2
  done
  die "The emulator did not finish starting (see $BUILD/emulator.log)."
}

# ------------------------------------------------------------------ the commands
cmd="${1:-build}"
# Put the app on a phone or the emulator as an UPDATE (the log stays). When Android refuses it, say why in plain
# words: an app signed with another key (a release build, or one built on another Mac) or a newer one is already
# there, and uninstalling it would erase its log.
install_on() {
  local out
  out="$(adb_ "$1" "$2" install -r "$3" 2>&1)" && return 0
  case "$out" in
    *INSTALL_FAILED_UPDATE_INCOMPATIBLE*|*signatures\ do\ not\ match*)
      bad "This phone already has Craving Crusher signed with a different key (a release build, or one built on another Mac), so Android won't update it."
      info "  Build it on the Mac (and in the mode, debug or --release) the phone's copy came from, and it updates with the log kept."
      info "  Uninstalling it first would let this one in, but it ERASES the log on the phone. Don't, unless that log doesn't matter." ;;
    *INSTALL_FAILED_VERSION_DOWNGRADE*)
      bad "The phone has a newer Craving Crusher than this one ($(version)). Android won't go back to an older version."
      info "  git pull to get the newer code, build again, and it updates with the log kept." ;;
    *)
      bad "The phone would not take it. Is it unlocked, and did you tap Allow?"
      info "  What Android said: $(echo "$out" | tail -n 1)" ;;
  esac
  return 1
}

case "$cmd" in
  -h|--help|help) sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;

  --check) requirements && { echo; ok "Everything is ready: ./BUILD_APP.sh builds the app."; echo; } || { echo; die "Install what is marked ✗ (or run ./BUILD_APP.sh --install-tools), then run ./BUILD_APP.sh --check again."; } ;;

  --install-tools) install_tools; echo; requirements || true; echo ;;

  --clean)
    rm -rf "$HERE/BUILD" "$HERE/build" "$HERE/app/build" "$HERE/.gradle" "$PAGE"
    ok "Removed BUILD/, Gradle's build folders and the built page."; exit 0 ;;

  build|--build|--run|--install)
    requirements >/dev/null || { requirements || true; die "Install what is marked ✗ (or run ./BUILD_APP.sh --install-tools), then run ./BUILD_APP.sh again."; }
    bold "Building Craving Crusher for Android $(version)"
    page
    gradle :app:assembleDebug
    apk="$BUILD/CravingCrusher-$(version).apk"
    cp "$HERE/app/build/outputs/apk/debug/app-debug.apk" "$apk"
    ok "Built."
    case "$cmd" in
      --run)
        ensure_avd; boot_emulator
        info "Putting it on the emulator…"
        install_on -e "$apk" || exit 1
        adb_ -e shell am start -n "$APP_ID/app.cravingcrusher.phone.MainActivity" >/dev/null
        ok "Craving Crusher is open in the emulator. Its icon is in the emulator's apps too." ;;
      --install)
        phones="$(adb_ devices | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ {print $1}')"
        [[ -n "$phones" ]] || die "No Android phone is plugged in with USB debugging on (adb devices lists none). The steps are below; or send the .apk to the phone. $(callout "$apk")"
        [[ "$(echo "$phones" | wc -l | tr -d ' ')" == 1 ]] || die "Several phones are plugged in. Unplug all but one."
        info "Putting it on the phone…"
        install_on -s "$phones" "$apk" || exit 1
        adb_ -s "$phones" shell am start -n "$APP_ID/app.cravingcrusher.phone.MainActivity" >/dev/null
        ok "Craving Crusher is on the phone and open." ;;
    esac
    callout "$apk" ;;

  --release)
    requirements >/dev/null || { requirements || true; die "Install what is marked ✗ first."; }
    [[ -n "${CC_KEYSTORE:-}" && -f "${CC_KEYSTORE:-}" && -n "${CC_KEYSTORE_PASSWORD:-}" && -n "${CC_KEY_ALIAS:-}" ]] || die "A release build is signed with your own key. Set CC_KEYSTORE (the .jks file), CC_KEYSTORE_PASSWORD and CC_KEY_ALIAS
      (and CC_KEY_PASSWORD if the key's password differs). To make a key once, and keep it safe outside the repo:
        keytool -genkeypair -v -keystore ~/craving-crusher.jks -alias craving-crusher -keyalg RSA -keysize 4096 -validity 10000
      Lose it and the Play Store version can never be updated."
    bold "Building Craving Crusher for Android $(version) — release, signed with $CC_KEY_ALIAS"
    page
    gradle :app:assembleRelease :app:bundleRelease
    cp "$HERE/app/build/outputs/apk/release/app-release.apk" "$BUILD/CravingCrusher-$(version)-release.apk"
    cp "$HERE/app/build/outputs/bundle/release/app-release.aab" "$BUILD/CravingCrusher-$(version)-release.aab"
    ok "Built:"
    info "  $BUILD/CravingCrusher-$(version)-release.aab   ← upload this one to the Play Console"
    info "  $BUILD/CravingCrusher-$(version)-release.apk   ← the same app to install directly"
    echo ;;

  *) die "Unknown choice: $cmd (./BUILD_APP.sh --help lists them)." ;;
esac
