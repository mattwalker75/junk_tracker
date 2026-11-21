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
import { MIGRATIONS, SCHEMA_VERSION } from "./migrations.js";

/** exported for the upgrade tests, which build an older file step by step */
export { MIGRATIONS, SCHEMA_VERSION };

export function openDatabase(file: string): Database.Database {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  const at = db.pragma("user_version", { simple: true }) as number;
  if (at > SCHEMA_VERSION) {
    db.close();
    throw new Error(`${file} was made by a newer Craving Crusher (database version ${at}; this copy knows ${SCHEMA_VERSION}). Update the app.`);
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
