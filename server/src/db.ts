/**
 * The SQLite database: every person, their splurges, their weigh-ins and their own settings.
 *
 * The app creates the file and its tables on first start and upgrades them itself: SQLite's
 * `user_version` says which step a file is at, and each step in MIGRATIONS runs once, in a
 * transaction. Add a step at the end — never edit one that has shipped.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const MIGRATIONS: string[] = [
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
  for (let v = at; v < SCHEMA_VERSION; v++) {
    db.transaction(() => { db.exec(MIGRATIONS[v]); db.pragma(`user_version = ${v + 1}`); })();
  }
  try { fs.chmodSync(file, 0o600); } catch {}
  return db;
}
