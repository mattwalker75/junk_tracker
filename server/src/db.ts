/**
 * The SQLite database: every person, their splurges, activities, weigh-ins, goals and their own settings.
 *
 * The app creates the file and its tables on first start and upgrades them itself: SQLite's
 * `user_version` says which step a file is at, and each step in MIGRATIONS runs once, in a
 * transaction. Add a step at the end — never edit one that has shipped. Before upgrading a file that
 * already has data, a copy is saved beside it as `<file>.before-v<new version>`.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/** exported for the upgrade tests, which build an older file step by step */
export const MIGRATIONS: readonly string[] = [
  // 1 — the first version
  `
  CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    settings_json TEXT NOT NULL DEFAULT '{}',
    created_at    TEXT NOT NULL,
    last_used_at  TEXT
  );
  CREATE TABLE splurges (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    what       TEXT NOT NULL,
    size       TEXT NOT NULL CHECK (size IN ('snack', 'meal', 'feast')),
    place      TEXT NOT NULL DEFAULT '',
    calories   INTEGER,
    day        TEXT NOT NULL,
    time       TEXT NOT NULL DEFAULT '',
    notes      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX splurges_user_day ON splurges (user_id, day DESC, time DESC);
  CREATE TABLE weigh_ins (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day        TEXT NOT NULL,
    pounds     REAL NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, day)
  );
  `,
  // 2 — goals (Oct 26 2026): each person's list; the first open one is on Home
  `
  CREATE TABLE goals (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text       TEXT NOT NULL,
    days       INTEGER CHECK (days IN (7, 14, 30)),
    position   REAL NOT NULL,
    started_on TEXT,
    done_on    TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX goals_user ON goals (user_id, done_on, position);
  `,
  // 3 — activity (Nov 9 2026): walks, runs, the gym; only the name is needed
  `
  CREATE TABLE activities (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    what       TEXT NOT NULL,
    minutes    INTEGER,
    calories   INTEGER,
    day        TEXT NOT NULL,
    time       TEXT NOT NULL DEFAULT '',
    notes      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX activities_user_day ON activities (user_id, day DESC, time DESC);
  `,
  // 4 — Craving Crusher (Nov 11 2026): a planned treat on a splurge, and each person's game runs,
  // their fights and what happened in them (Docs/game/ARCHITECTURE.md)
  `
  ALTER TABLE splurges ADD COLUMN planned INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE game_runs (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    number              INTEGER NOT NULL,
    mode                TEXT NOT NULL CHECK (mode IN ('normal', 'hardcore')),
    started_at          TEXT NOT NULL,
    started_on          TEXT NOT NULL,
    ended_on            TEXT,
    end_reason          TEXT CHECK (end_reason IN ('defeated', 'finished', 'abandoned')),
    hearts              INTEGER NOT NULL DEFAULT 3,
    shields             INTEGER NOT NULL DEFAULT 0,
    potions             INTEGER NOT NULL DEFAULT 0,
    winds               INTEGER NOT NULL DEFAULT 0,
    shield_armed        INTEGER NOT NULL DEFAULT 0,
    knockbacks          INTEGER NOT NULL DEFAULT 0,
    hardcore_dropped_on TEXT,
    log_points          INTEGER NOT NULL DEFAULT 0,
    score               INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, number)
  );
  CREATE TABLE game_fights (
    id            TEXT PRIMARY KEY,
    run_id        TEXT NOT NULL REFERENCES game_runs(id) ON DELETE CASCADE,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level         INTEGER NOT NULL CHECK (level BETWEEN 1 AND 60),
    attempt       INTEGER NOT NULL,
    started_on    TEXT NOT NULL,
    started_after TEXT,
    deadline_on   TEXT NOT NULL,
    bet           REAL NOT NULL DEFAULT 1 CHECK (bet IN (1, 1.5, 2)),
    status        TEXT NOT NULL CHECK (status IN ('open', 'won', 'struck')),
    ended_on      TEXT,
    damage        INTEGER NOT NULL DEFAULT 0,
    heals         INTEGER NOT NULL DEFAULT 0,
    points        INTEGER NOT NULL DEFAULT 0,
    flawless      INTEGER NOT NULL DEFAULT 0,
    bet_locked    INTEGER NOT NULL DEFAULT 0,
    seq           INTEGER NOT NULL
  );
  CREATE INDEX game_fights_run ON game_fights (run_id, seq);
  CREATE TABLE game_events (
    id        TEXT PRIMARY KEY,
    run_id    TEXT NOT NULL REFERENCES game_runs(id) ON DELETE CASCADE,
    fight_id  TEXT REFERENCES game_fights(id) ON DELETE CASCADE,
    day       TEXT NOT NULL,
    at        TEXT NOT NULL,
    kind      TEXT NOT NULL,
    data_json TEXT NOT NULL DEFAULT '{}',
    seq       INTEGER NOT NULL
  );
  CREATE INDEX game_events_run ON game_events (run_id, seq);
  `,
  // 5 — Keep the monsters coming (Nov 14 2026): the phone day game mode last checked for a run to
  // start by itself, so it happens once a day per person, whichever phone opens the game
  `
  ALTER TABLE users ADD COLUMN game_checked_on TEXT;
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export function openDatabase(file: string): Database.Database {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  const at = db.pragma("user_version", { simple: true }) as number;
  if (at > SCHEMA_VERSION) {
    db.close();
    throw new Error(`${file} was made by a newer Junk Tracker (database version ${at}; this copy knows ${SCHEMA_VERSION}). Update the app.`);
  }
  // an upgrade (after a git pull, say) first keeps a copy of the file as it was, so going back to the
  // older app — which refuses a newer database — never strands anyone's log
  if (at > 0 && at < SCHEMA_VERSION) {
    const copy = `${file}.before-v${SCHEMA_VERSION}`;
    if (!fs.existsSync(copy)) {
      db.exec(`VACUUM INTO '${copy.replaceAll("'", "''")}'`);
      try { fs.chmodSync(copy, 0o600); } catch {}
    }
  }
  for (let v = at; v < SCHEMA_VERSION; v++) {
    db.transaction(() => { db.exec(MIGRATIONS[v]); db.pragma(`user_version = ${v + 1}`); })();
  }
  try { fs.chmodSync(file, 0o600); } catch {}
  return db;
}
