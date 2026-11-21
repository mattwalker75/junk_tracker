#!/usr/bin/env bash
# Builds the page the phone apps carry (the web app's page + the log kept on the phone) into a folder.
# Used by ios/BUILD_APP.sh and android/BUILD_APP.sh; you don't need to run it yourself.
#
#   app_ports/shared/build_page.sh <folder> [--test]
#
# --test also runs the phone code's tests first (app_ports/shared/test/).
set -euo pipefail

OUT="${1:?Say which folder to build the page into.}"
TEST="${2:-}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"

say()  { printf '  %s\n' "$*"; }
fail() { printf '\n  ✗ %s\n\n' "$*" >&2; exit 1; }

# the build empties the folder first: only ever the apps' own page folders
case "$OUT" in
  "$REPO/app_ports/ios/CravingCrusher/web" | "$REPO/app_ports/android/app/src/main/assets/web") ;;
  *) fail "build_page.sh only builds into the apps' page folders (ios/CravingCrusher/web, android/app/src/main/assets/web), not $OUT." ;;
esac

# Xcode runs build scripts with a bare PATH: look where Node is usually installed too
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin"
if ! command -v node >/dev/null 2>&1 && [[ -d "$HOME/.nvm/versions/node" ]]; then
  newest="$(ls -1 "$HOME/.nvm/versions/node" | sort -V | tail -n 1)"
  [[ -n "$newest" ]] && export PATH="$HOME/.nvm/versions/node/$newest/bin:$PATH"
fi
command -v node >/dev/null 2>&1 || fail "Node.js is needed to build the page (22.12 or newer). Install it from https://nodejs.org or with: brew install node"
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=12)?0:1)' \
  || fail "Node.js $(node -v) is too old — 22.12 or newer is needed. Update it from https://nodejs.org or with: brew upgrade node"

cd "$REPO"
# the web app's own packages (React, Vite, …): the same ones ./TRACKER.sh installs
if [[ ! -x node_modules/.bin/vite ]]; then
  say "Installing the web app's packages (a minute or so)…"
  npm ci --no-audit --no-fund >/dev/null || fail "Installing the web app's packages failed. Run 'npm ci' in $REPO to see why."
fi
# the phone page's one extra package (sql.js, SQLite for the page)
if [[ ! -f app_ports/shared/node_modules/sql.js/package.json || app_ports/shared/package-lock.json -nt app_ports/shared/node_modules/.package-lock.json ]]; then
  say "Installing the phone page's package (sql.js)…"
  npm ci --prefix app_ports/shared --no-audit --no-fund >/dev/null || fail "Installing sql.js failed. Run 'npm ci --prefix app_ports/shared' in $REPO to see why."
fi

if [[ "$TEST" == "--test" ]]; then
  say "Testing the phone code…"
  log="$(mktemp -t cc-phone-tests)"
  node_modules/.bin/vitest run --config app_ports/shared/vitest.config.ts >"$log" 2>&1 \
    || { cat "$log" >&2; rm -f "$log"; fail "The phone code's tests failed (above)."; }
  rm -f "$log"
fi

say "Building the page…"
CC_PHONE_OUT="$OUT" node_modules/.bin/vite build --config app_ports/shared/vite.config.ts >/dev/null \
  || fail "Building the page failed. Run: CC_PHONE_OUT=/tmp/cc node_modules/.bin/vite build --config app_ports/shared/vite.config.ts"
[[ -f "$OUT/index.html" ]] || fail "The page was built, but $OUT/index.html is missing."
