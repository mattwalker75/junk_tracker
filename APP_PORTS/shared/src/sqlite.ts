/**
 * The few parts of better-sqlite3 that the server's code uses (prepare → get / all / run, transaction,
 * pragma, exec), on top of sql.js — SQLite compiled to WebAssembly, running inside the page. With it the
 * phone apps run the server's own log, goals and game code (server/src/log.ts, goals.ts, game.ts,
 * users.ts) unchanged, on a database kept on the phone.
 */
import type { BindParams, Database as SqlJsDatabase, SqlJsStatic, SqlValue } from "sql.js";

type Param = SqlValue | boolean | bigint | undefined;

function value(v: Param): SqlValue {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "bigint") return Number(v);
  return v;
}

/** better-sqlite3 takes `run(a, b)`, `run([a, b])` or `run({ id })` for `@id`; sql.js wants an array or `{ "@id": … }` */
function bindings(args: unknown[]): BindParams {
  if (args.length === 1 && args[0] && typeof args[0] === "object" && !Array.isArray(args[0]) && !(args[0] instanceof Uint8Array)) {
    const out: Record<string, SqlValue> = {};
    for (const [k, v] of Object.entries(args[0] as Record<string, Param>)) {
      const sv = value(v);
      out[`@${k}`] = sv; out[`:${k}`] = sv; out[`$${k}`] = sv;
    }
    return out;
  }
  return args.flat().map((v) => value(v as Param));
}

/** A SQLite error, with the code better-sqlite3 would give (the error handler looks for SQLITE_CONSTRAINT_UNIQUE). */
export class SqliteError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}
function wrap(e: unknown): never {
  const msg = (e as Error)?.message ?? String(e);
  if (/UNIQUE constraint failed/i.test(msg)) throw new SqliteError(msg, "SQLITE_CONSTRAINT_UNIQUE");
  if (/constraint failed/i.test(msg)) throw new SqliteError(msg, "SQLITE_CONSTRAINT");
  throw e;
}

export class Statement {
  constructor(private readonly owner: Database, private readonly sql: string) {}
  private withStmt<T>(args: unknown[], fn: (s: ReturnType<SqlJsDatabase["prepare"]>) => T): T {
    const s = this.owner.raw.prepare(this.sql);
    try { s.bind(bindings(args)); return fn(s); } catch (e) { return wrap(e); } finally { s.free(); }
  }
  get(...args: unknown[]): Record<string, SqlValue> | undefined {
    return this.withStmt(args, (s) => (s.step() ? s.getAsObject() : undefined));
  }
  all(...args: unknown[]): Record<string, SqlValue>[] {
    return this.withStmt(args, (s) => { const rows = []; while (s.step()) rows.push(s.getAsObject()); return rows; });
  }
  run(...args: unknown[]): { changes: number; lastInsertRowid: number } {
    return this.withStmt(args, (s) => {
      while (s.step()) { /* a statement that returns rows: run it to the end */ }
      const changes = this.owner.raw.getRowsModified();
      const id = this.owner.raw.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0];
      return { changes, lastInsertRowid: Number(id ?? 0) };
    });
  }
}

export class Database {
  raw: SqlJsDatabase;
  private depth = 0;

  constructor(private readonly SQL: SqlJsStatic, bytes?: Uint8Array | null) {
    this.raw = new SQL.Database(bytes && bytes.length ? bytes : undefined);
    this.connectionSettings();
  }

  /** what every new connection needs (sql.js opens a fresh one each time the file is copied out) */
  private connectionSettings(): void {
    this.raw.run("PRAGMA foreign_keys = ON");
  }

  prepare(sql: string): Statement { return new Statement(this, sql); }

  exec(sql: string): this {
    try { this.raw.exec(sql); } catch (e) { wrap(e); }
    return this;
  }

  /** `pragma("user_version", { simple: true })` reads one value; `pragma("user_version = 3")` sets one */
  pragma(text: string, opts: { simple?: boolean } = {}): unknown {
    const res = this.raw.exec(`PRAGMA ${text}`);
    if (opts.simple) return res[0]?.values[0]?.[0];
    const r = res[0];
    return r ? r.values.map((row) => Object.fromEntries(r.columns.map((c, i) => [c, row[i]]))) : [];
  }

  /** like better-sqlite3: all or nothing; one inside another becomes a savepoint */
  transaction<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
    return (...args: A): R => {
      const outer = this.depth === 0;
      const sp = `sp${this.depth}`;
      this.raw.run(outer ? "BEGIN" : `SAVEPOINT ${sp}`);
      this.depth++;
      try {
        const out = fn(...args);
        this.depth--;
        this.raw.run(outer ? "COMMIT" : `RELEASE ${sp}`);
        return out;
      } catch (e) {
        this.depth--;
        if (outer) this.raw.run("ROLLBACK"); else { this.raw.run(`ROLLBACK TO ${sp}`); this.raw.run(`RELEASE ${sp}`); }
        throw e;
      }
    };
  }

  /** every change since the file was opened (to know whether a request changed anything) */
  totalChanges(): number {
    return Number(this.raw.exec("SELECT total_changes()")[0]?.values[0]?.[0] ?? 0);
  }

  /** the whole database file, to keep on the phone */
  file(): Uint8Array {
    const bytes = this.raw.export();
    // sql.js reopens the database to copy it out, which drops the connection's settings
    this.connectionSettings();
    return bytes;
  }

  /**
   * Put the whole database back as these bytes (a change the phone failed to save is undone, so what the
   * page shows is always what the phone keeps). Statements prepare on each use, so nothing else holds the old one.
   */
  restore(bytes: Uint8Array): void {
    this.raw.close();
    this.raw = new this.SQL.Database(bytes);
    this.depth = 0;
    this.connectionSettings();
  }

  close(): void { this.raw.close(); }
}
