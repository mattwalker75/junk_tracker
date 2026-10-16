#!/usr/bin/env bash
#
# INSTALL_APP.sh — set up Junk Tracker on this computer.
#
# What it needs:
#   REQUIRED  Node.js 22.12 or newer (npm comes with it) — installed with Homebrew if missing.
#   REQUIRED  The app's packages (npm install), including better-sqlite3, which keeps the
#             database. Nothing else: the database is one SQLite file the app creates itself.
#   OPTIONAL  Homebrew — the easiest way to install Node.js on a Mac (https://brew.sh).
#
# Usage:  ./INSTALL_APP.sh [options…]
#
#   (no options)    Check/install Node.js, install the app's packages, build it,
#                   create config.json from config.example.json, run the tests.
#   -k, --skip-tests  Don't run the tests (quicker after pulling new code).
#   -y, --yes       Don't ask before installing Node.js with Homebrew.
#   -c, --check     Only report what is installed or missing; change nothing.
#   -h, --help      This help.
#
# Examples:
#   ./INSTALL_APP.sh              the usual install
#   ./INSTALL_APP.sh --check      just tell me what is missing
#   ./INSTALL_APP.sh -k           after a git pull: packages + build, no tests
#
# Safe to run again at any time — for example after pulling new code (it rebuilds).
# Then:  ./TRACKER.sh --start
#
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; cd "$HERE"
if [[ -t 1 ]]; then C_RESET=$'\033[0m'; C_RED=$'\033[0;31m'; C_GRN=$'\033[0;32m'; C_YEL=$'\033[0;33m'; C_BLU=$'\033[0;34m'; else C_RESET=''; C_RED=''; C_GRN=''; C_YEL=''; C_BLU=''; fi
info() { echo "${C_BLU}==>${C_RESET} $*"; }; ok() { echo "${C_GRN}OK ${C_RESET} $*"; }; warn() { echo "${C_YEL}!! ${C_RESET} $*"; }; err() { echo "${C_RED}ERROR${C_RESET} $*" >&2; }
usage() { awk 'NR>=3 { if (/^#/) { sub(/^# ?/, ""); print } else { exit } }' "${BASH_SOURCE[0]}"; }

YES=0; CHECK_ONLY=0; TESTS=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    -k|--skip-tests) TESTS=0 ;;
    -y|--yes)   YES=1 ;;
    -c|--check) CHECK_ONLY=1 ;;
    -h|--help)  usage; exit 0 ;;
    *) err "Unknown option: $1"; echo; usage; exit 2 ;;
  esac; shift
done
confirm() { [[ $YES -eq 1 ]] && return 0; read -r -p "$1 [y/N] " a; [[ "$a" == y || "$a" == Y ]]; }
have() { command -v "$1" >/dev/null 2>&1; }
# 22.12 or newer: the page builder (Vite) needs at least that
node_new_enough() { node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=12)?0:1)' 2>/dev/null; }

echo "Junk Tracker — install"; echo
# ---- Node.js
if have node && node_new_enough; then ok "Node.js $(node -v)"
else
  if have node; then warn "Node.js $(node -v) is too old — 22.12 or newer is needed"; else warn "Node.js is not installed"; fi
  if [[ $CHECK_ONLY -eq 1 ]]; then :
  elif ! have brew; then err "Install Node.js 22.12 or newer. The easy way on a Mac is Homebrew (https://brew.sh), then: brew install node"; exit 1
  elif confirm "Install Node.js with Homebrew (brew install node)?"; then brew install node || { err "Node.js did not install."; exit 1; }
    hash -r
    # another, older Node (nvm, say) can come first on PATH — check the one that will actually run
    if node_new_enough; then ok "Node.js $(node -v)"; else err "Node.js $(node -v 2>/dev/null) is still the one found first on your PATH. Make the new one ($(brew --prefix)/bin/node) come first, then run this again."; exit 1; fi
  else err "Node.js 22.12 or newer is needed."; exit 1; fi
fi

if [[ $CHECK_ONLY -eq 1 ]]; then
  [[ -d node_modules/express && -d node_modules/better-sqlite3 ]] && ok "Packages installed" || warn "Packages not installed"
  [[ -f dist/web/index.html ]] && ok "App built" || warn "App not built"
  [[ -f config.json ]] && ok "config.json present" || warn "config.json not created yet"
  exit 0
fi

# ---- packages + build
info "Installing the app's packages…"
mkdir -p data
if [[ -f package-lock.json ]]; then npm ci --no-audit --no-fund >data/install.log 2>&1 || npm install --no-audit --no-fund >>data/install.log 2>&1; else npm install --no-audit --no-fund >data/install.log 2>&1; fi
node -e "for (const m of ['express','better-sqlite3','bcryptjs','vite','react']) require.resolve(m); new (require('better-sqlite3'))(':memory:').close()" 2>/dev/null \
  && ok "Packages installed" || { err "A package failed to install — see data/install.log (or run npm install to see why)."; exit 1; }
info "Building…"
if npm run build > data/build.log 2>&1; then touch dist/.built; ok "Built"; else err "The build failed — see data/build.log"; tail -n 25 data/build.log; exit 1; fi
# ---- config.json
if [[ -f config.json ]]; then ok "config.json present"
else cp config.example.json config.json && chmod 600 config.json && ok "config.json created from config.example.json"; fi
# ---- tests
if [[ $TESTS -eq 1 ]]; then
  info "Running the tests…"
  if npx vitest run >data/test.log 2>&1; then ok "Tests pass"; else warn "Some tests failed — see data/test.log (or ./TRACKER.sh --test)"; fi
fi

echo
# a running copy keeps its old code until restarted
if curl -fsS --max-time 2 "http://localhost:$(node -e "try{console.log(require('./config.json').server.port||8420)}catch{console.log(8420)}")/api/health" 2>/dev/null | grep -q '"app":"junk-tracker"'; then
  warn "Junk Tracker is running with the old version. Restart it to use the new one:  ./TRACKER.sh --restart"; exit 0
fi
echo "Next:  ./TRACKER.sh --start      (opens http://localhost:$(node -e "try{console.log(require('./config.json').server.port||8420)}catch{console.log(8420)}"))"
exit 0
