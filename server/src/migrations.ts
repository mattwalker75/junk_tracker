/**
 * The database's tables, as the steps that build them. Kept apart from db.ts (which opens the file with
 * better-sqlite3) so the phone apps (APP_PORTS/) build the very same tables. Add a step at the end —
 * never edit one that has shipped.
 */
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
  // 4 — Calorie Crusher (Nov 11 2026): a planned treat on a splurge, and each person's game runs,
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
  // 6 — extra lives and Monster toughness (Nov 15 2026): the lives a run holds, and the HP
  // multiplier each fight started with (the setting changes only fights started after it)
  `
  ALTER TABLE game_runs ADD COLUMN lives INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE game_fights ADD COLUMN hp_mult REAL NOT NULL DEFAULT 1;
  `,
  // 7 — Calorie Crusher grows to 120 levels (Nov 22 2026): a fight's level may now be 1 to 120 (it was
  // 1 to 60). SQLite can't change a CHECK, so game_fights is built again. Each step runs in a
  // transaction with foreign keys on (they can't be switched off there), and dropping the old table
  // deletes the events that point at it — so the events are copied aside first and put back after;
  // game_events' "REFERENCES game_fights" then points at the new table, which takes the old name.
  `
  CREATE TEMP TABLE game_events_keep AS SELECT id, run_id, fight_id, day, at, kind, data_json, seq FROM game_events;
  CREATE TABLE game_fights_v7 (
    id            TEXT PRIMARY KEY,
    run_id        TEXT NOT NULL REFERENCES game_runs(id) ON DELETE CASCADE,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level         INTEGER NOT NULL CHECK (level BETWEEN 1 AND 120),
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
    seq           INTEGER NOT NULL,
    hp_mult       REAL NOT NULL DEFAULT 1
  );
  INSERT INTO game_fights_v7 (id, run_id, user_id, level, attempt, started_on, started_after, deadline_on, bet, status, ended_on, damage, heals, points, flawless, bet_locked, seq, hp_mult)
    SELECT id, run_id, user_id, level, attempt, started_on, started_after, deadline_on, bet, status, ended_on, damage, heals, points, flawless, bet_locked, seq, hp_mult FROM game_fights;
  DROP TABLE game_fights;
  ALTER TABLE game_fights_v7 RENAME TO game_fights;
  CREATE INDEX game_fights_run ON game_fights (run_id, seq);
  DELETE FROM game_events;
  INSERT INTO game_events (id, run_id, fight_id, day, at, kind, data_json, seq)
    SELECT id, run_id, fight_id, day, at, kind, data_json, seq FROM game_events_keep;
  DROP TABLE game_events_keep;
  `,
  // 8 — workouts from the phone's health app (Nov 22 2026): an activity says where it came from ("" by hand,
  // "apple-health", "health-connect") and the health app's id for it; health_imports remembers every workout
  // the phone has seen — brought in or skipped as one logged by hand — so a deleted one never comes back.
  `
  ALTER TABLE activities ADD COLUMN source TEXT NOT NULL DEFAULT '';
  ALTER TABLE activities ADD COLUMN source_id TEXT;
  CREATE TABLE health_imports (
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source      TEXT NOT NULL,
    source_id   TEXT NOT NULL,
    seen_at     TEXT NOT NULL,
    activity_id TEXT,
    skipped     TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (user_id, source, source_id)
  );
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;
