#!/usr/bin/env bash
#
# TRACKER.sh — run Junk Tracker.
#
# Usage:  ./TRACKER.sh [options…]     options run in the order given, e.g.  ./TRACKER.sh -x -s
#
#   -s, --start     Start in the background and open it in your browser. Builds the
#                   app first if it has not been built (or the code changed). Does
#                   nothing if it is already running.
#   -x, --stop      Stop the background server.
#   -r, --restart   Stop, then start (needed after changing a setting marked "after a
#                   restart": network access, the port, how long a sign-in lasts).
#   -i, --status    Is it running? Prints the address and process id.
#   -l, --logs      Follow the server log (Ctrl-C to leave).
#   -f, --fg        Run in the foreground instead (Ctrl-C to stop).
#   -c, --check     Check that everything it needs is in place, and exit.
#   -t, --test      Run the tests.
#   -d, --dev       Developer mode: live-reloading page at http://localhost:5173 (Ctrl-C to stop).
#   -h, --help      This help.
#
# Bare words work too:  ./TRACKER.sh start | stop | restart | status | logs | fg | check | test | dev | help
#
# Examples:
#   ./TRACKER.sh                start it (same as --start)
#   ./TRACKER.sh --status       is it running, and where?
#   ./TRACKER.sh -r             restart after turning on network access in Settings
#   ./TRACKER.sh --logs         watch what the server is doing
#
# Settings live in config.json next to this script (Settings in the app edits the same file).
# Everyone's log is one SQLite file, data/junk.db by default.
# First-time setup on a new computer:  ./INSTALL_APP.sh
# Set JT_NO_OPEN=1 to start without opening the browser.
#
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; cd "$HERE"
mkdir -p "$HERE/data"; PIDFILE="$HERE/data/tracker.pid"; LOG="$HERE/data/tracker.log"
if [[ -t 1 ]]; then C_RESET=$'\033[0m'; C_RED=$'\033[0;31m'; C_GRN=$'\033[0;32m'; C_YEL=$'\033[0;33m'; C_BLU=$'\033[0;34m'; else C_RESET=''; C_RED=''; C_GRN=''; C_YEL=''; C_BLU=''; fi
info() { echo "${C_BLU}==>${C_RESET} $*"; }; ok() { echo "${C_GRN}OK ${C_RESET} $*"; }; warn() { echo "${C_YEL}!! ${C_RESET} $*"; }; err() { echo "${C_RED}ERROR${C_RESET} $*" >&2; }
usage() { awk 'NR>=3 { if (/^#/) { sub(/^# ?/, ""); print } else { exit } }' "${BASH_SOURCE[0]}"; }

# The config file this copy uses, handed to the server explicitly so a copy of this folder never runs on another copy's data.
CONFIG="${JT_CONFIG:-$HERE/config.json}"; export JT_CONFIG="$CONFIG"
cfg() { node -e "try{const c=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const v=process.argv[2].split('.').reduce((a,k)=>a&&a[k],c);console.log(v===undefined?process.argv[3]:v)}catch{console.log(process.argv[3])}" "$CONFIG" "$1" "$2" 2>/dev/null || echo "$2"; }
port() { cfg server.port 8420; }
url() { echo "http://localhost:$(port)"; }
ENTRY="dist/node/server/src/index.js"
# "is Junk Tracker answering?" — the health route says which app it is, so another program on the port is not mistaken for it
answering() { curl -fsS --max-time 2 "$(url)/api/health" 2>/dev/null | grep -q '"app":"junk-tracker"'; }
# The copy this script knows about: its process must be alive AND be Junk Tracker. After a restart of
# the computer the number in the pid file can belong to some other program — never touch that.
running() {
  [[ -f "$PIDFILE" ]] || return 1
  local pid; pid="$(cat "$PIDFILE" 2>/dev/null)"
  [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null && ps -p "$pid" -o command= 2>/dev/null | grep -qF "$ENTRY" && return 0
  rm -f "$PIDFILE"; return 1
}
# A copy started some other way (`npm start`): the process listening on the port, only when it really is Junk Tracker.
found_pid() {
  answering || return 1
  local pid; pid="$(lsof -nP -t -iTCP:"$(port)" -sTCP:LISTEN 2>/dev/null | head -n 1)"
  [[ "$pid" =~ ^[0-9]+$ ]] && ps -p "$pid" -o command= 2>/dev/null | grep -qF "$ENTRY" && echo "$pid"
}
moved_note() { echo "it is not answering at $(url). If the port was changed in Settings, restart to apply it: ./TRACKER.sh --restart"; }
node_ok() { command -v node >/dev/null 2>&1 && [[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ]]; }

# Build when there is no build yet, or when any source file is newer than the last build.
needs_build() {
  [[ -f "$ENTRY" && -f dist/web/index.html && -f dist/.built ]] || return 0
  [[ -n "$(find web/src web/index.html web/public server/src shared package.json -newer dist/.built -print -quit 2>/dev/null)" ]]
}
build() {
  info "Building Junk Tracker…"
  if npm run build >"$HERE/data/build.log" 2>&1; then touch dist/.built; ok "Built."; else err "The build failed — see data/build.log"; tail -n 25 "$HERE/data/build.log"; return 1; fi
}
prereqs() {
  node_ok || { err "Node.js 22 or newer is needed. Run ./INSTALL_APP.sh"; return 1; }
  [[ -d node_modules/express && -d node_modules/better-sqlite3 ]] || { err "The app's packages are not installed. Run ./INSTALL_APP.sh"; return 1; }
  [[ -f "$CONFIG" ]] || { info "No config.json yet — creating it from config.example.json"; cp config.example.json "$CONFIG" && chmod 600 "$CONFIG"; }
  if needs_build; then build || return 1; fi
}

cmd_check() {
  local rc=0
  if node_ok; then ok "Node.js $(node -v)"; else err "Node.js 22+ is required — run ./INSTALL_APP.sh"; rc=1; fi
  if [[ -d node_modules/express && -d node_modules/better-sqlite3 ]]; then ok "Packages installed"; else err "Packages not installed — run ./INSTALL_APP.sh"; rc=1; fi
  if [[ -f dist/web/index.html && -f "$ENTRY" ]]; then needs_build && warn "Built, but the code changed since — the next start rebuilds it" || ok "Built"; else warn "Not built yet — the next start builds it"; fi
  if [[ -f "$CONFIG" ]]; then ok "config.json present (port $(port), network access $(cfg server.allowNetwork false), sign-in $(cfg security.loginEnabled false))"; else warn "config.json will be created from config.example.json on first start"; fi
  local db; db="$(cfg database.path ./data/junk.db)"
  [[ "$db" = /* ]] || db="$(dirname "$CONFIG")/${db#./}"   # relative paths are from the config file's folder, as the server reads them
  if [[ -f "$db" ]]; then ok "Database $db ($(du -h "$db" | cut -f1))"; else info "Database $db will be created on first start"; fi
  if running; then ok "Junk Tracker is running — $(url)"; elif answering; then ok "Junk Tracker is running — $(url)   (not started by this script)"; else info "Junk Tracker is not running"; fi
  return $rc
}
cmd_start() {
  if running; then ok "Already running (pid $(cat "$PIDFILE")) — $(url)"; return 0; fi
  prereqs || return 1
  if answering; then ok "Junk Tracker is already running at $(url) (not started by this script)."; return 0; fi
  nohup node "$ENTRY" >> "$LOG" 2>&1 & echo $! > "$PIDFILE"
  for _ in $(seq 1 40); do answering && break; kill -0 "$(cat "$PIDFILE")" 2>/dev/null || break; sleep 0.25; done
  if answering; then
    ok "Junk Tracker is running — $(url)   (log: data/tracker.log)"
    [[ "$(cfg server.allowNetwork false)" == "true" ]] && info "Other devices: Settings → Network access lists the addresses."
    [[ -z "${JT_NO_OPEN:-}" ]] && command -v open >/dev/null 2>&1 && open "$(url)"
  else
    err "It did not start — the end of data/tracker.log:"; tail -n 20 "$LOG"
    kill "$(cat "$PIDFILE")" 2>/dev/null; rm -f "$PIDFILE"; return 1
  fi
}
cmd_stop() {
  local pid=""
  if running; then pid="$(cat "$PIDFILE")"; else pid="$(found_pid)"; fi
  if [[ -n "$pid" ]]; then
    kill "$pid"
    for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
    rm -f "$PIDFILE"; ok "Stopped."
  else rm -f "$PIDFILE"; info "Not running."; fi
}
cmd_status() {
  if running; then if answering; then ok "Running (pid $(cat "$PIDFILE")) — $(url)"; else warn "Running (pid $(cat "$PIDFILE")) — but $(moved_note)"; fi
  elif answering; then ok "Running — $(url)   (not started by this script)"
  else info "Not running."; fi
}
cmd_logs() { touch "$LOG"; tail -n 60 -f "$LOG"; }
cmd_fg() {
  running && { err "Already running (pid $(cat "$PIDFILE")); stop it first: ./TRACKER.sh -x"; return 1; }
  prereqs || return 1
  answering && { err "Junk Tracker is already running at $(url); stop it first: ./TRACKER.sh -x"; return 1; }
  # node takes over this very process, so --status, --stop and --restart know about it too
  echo $$ > "$PIDFILE"
  exec node "$ENTRY"
}
cmd_test() { npx vitest run; }
cmd_dev() {
  running && { err "Stop the background server first: ./TRACKER.sh -x"; return 1; }
  node_ok && [[ -d node_modules/vite ]] || { err "Run ./INSTALL_APP.sh first."; return 1; }
  [[ -f "$CONFIG" ]] || { cp config.example.json "$CONFIG" && chmod 600 "$CONFIG"; }
  info "Developer mode — open http://localhost:5173 (the page reloads as you edit; Ctrl-C stops both)"
  exec npm run dev
}

[[ $# -eq 0 ]] && set -- --start
rc=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -s|--start|start)     cmd_start   || rc=$? ;;
    -x|--stop|stop)       cmd_stop    || rc=$? ;;
    -r|--restart|restart) cmd_stop; sleep 0.5; cmd_start || rc=$? ;;
    -i|--status|status)   cmd_status  || rc=$? ;;
    -l|--logs|logs)       cmd_logs    || rc=$? ;;
    -f|--fg|fg)           cmd_fg      || rc=$? ;;
    -c|--check|check)     cmd_check   || rc=$? ;;
    -t|--test|test)       cmd_test    || rc=$? ;;
    -d|--dev|dev)         cmd_dev     || rc=$? ;;
    -h|--help|help)       usage; exit 0 ;;
    *) err "Unknown option: $1"; echo; usage; exit 2 ;;
  esac
  shift
done
exit $rc
