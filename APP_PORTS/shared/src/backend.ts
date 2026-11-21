/**
 * Craving Crusher's server, inside the phone app: the same /api routes as server/src/app.ts, answered by
 * the server's own code (Log, Goals, Game, Users) on a SQLite database kept on the phone. The page is the
 * web app's page, unchanged — boot.ts sends its /api requests here instead of over the network.
 *
 * What differs from the server, on purpose:
 *  - one person, no sign-in: Users and sign-in, other users, passwords and Switch to are refused (Settings
 *    hides them in the phone app);
 *  - no network settings: there is no network (Settings hides them too);
 *  - the look (Appearance) is kept in the database, in a `phone_app` table, as config.json is not there.
 *
 * Keep the routes in step with app.ts: test/backend.test.ts checks that every call in web/src/lib/api.ts is
 * answered here.
 */
import type { Request } from "express";
import type { SqlJsStatic } from "sql.js";
import type { CustomTheme } from "../../../shared/types";
import type { Config } from "../../../server/src/config";
import { Game } from "../../../server/src/game";
import { Goals } from "../../../server/src/goals";
import { Log } from "../../../server/src/log";
import { MIGRATIONS, SCHEMA_VERSION } from "../../../server/src/migrations";
import { settingsSchema, userSettingsSchema } from "../../../server/src/settingsSchemas";
import { Users } from "../../../server/src/users";
import { parse, UserError } from "../../../server/src/util";
import { Database } from "./sqlite";

export interface Answer { status: number; body: unknown }
type Ctx = { params: Record<string, string>; query: Record<string, string>; body: Record<string, unknown> };

const ONE_PERSON = "On this phone Craving Crusher keeps one person's log, so there are no other users or passwords.";

interface Appearance { theme: string; customThemes: CustomTheme[] }

export class Backend {
  readonly db: Database;
  private readonly users: Users;
  private readonly log: Log;
  private readonly goals: Goals;
  private readonly game: Game;
  // the one person on the phone: Users works out who that is from an empty session, as with sign-in off
  private readonly req = { session: {} } as unknown as Request;
  private readonly routes: [string, RegExp, string[], (c: Ctx) => unknown][] = [];

  constructor(SQL: SqlJsStatic, bytes: Uint8Array | null, readonly version: string, serverDay?: () => string) {
    this.db = new Database(SQL, bytes);
    const at = Number(this.db.pragma("user_version", { simple: true }) ?? 0);
    if (at > SCHEMA_VERSION) throw new Error(`This log was saved by a newer Craving Crusher (database version ${at}; this app knows ${SCHEMA_VERSION}). Update the app.`);
    for (let v = at; v < SCHEMA_VERSION; v++) {
      this.db.transaction(() => { this.db.exec(MIGRATIONS[v]); this.db.pragma(`user_version = ${v + 1}`); })();
    }
    this.db.exec("CREATE TABLE IF NOT EXISTS phone_app (key TEXT PRIMARY KEY, value TEXT NOT NULL)");

    const db = this.db as unknown as ConstructorParameters<typeof Goals>[0];
    const config = { get: () => ({ security: { loginEnabled: false, sessionDays: 30 }, appearance: this.appearance() }) } as unknown as Config;
    this.users = new Users(db, config);
    this.goals = new Goals(db);
    this.log = new Log(db, this.users, this.goals);
    this.game = new Game(db, this.users, serverDay ?? localDay);
    this.table();
  }

  private owner(): string { return this.users.owner(this.req); }

  private appearance(): Appearance {
    const row = this.db.prepare("SELECT value FROM phone_app WHERE key = 'appearance'").get();
    const fallback: Appearance = { theme: "system", customThemes: [] };
    try { return row ? { ...fallback, ...JSON.parse(String(row.value)) } : fallback; } catch { return fallback; }
  }

  private appSettings() {
    return {
      version: this.version,
      config: {
        server: { port: 0, allowNetwork: false, extraHosts: [] },
        security: { loginEnabled: false, sessionDays: 30 },
        database: { path: "on this phone" },
        appearance: this.appearance(),
      },
      restartRequired: [],
      networkUrls: [],
    };
  }

  private on(method: string, path: string, fn: (c: Ctx) => unknown): void {
    const names: string[] = [];
    const re = new RegExp(`^${path.replace(/:([a-z]+)/g, (_m, n: string) => { names.push(n); return "([^/]+)"; })}$`);
    this.routes.push([method, re, names, fn]);
  }

  /** the same routes as app.ts */
  private table(): void {
    const o = () => this.owner();
    const refuse = () => { throw new UserError(ONE_PERSON, 409); };

    this.on("GET", "/api/health", () => ({ ok: true, app: "craving-crusher-phone", version: this.version }));
    this.on("GET", "/api/auth/me", () => this.users.state(this.req));
    this.on("GET", "/api/appearance", () => this.appearance());
    this.on("POST", "/api/auth/setup", refuse);
    this.on("POST", "/api/auth/login", refuse);
    this.on("POST", "/api/auth/logout", () => ({ ok: true }));
    this.on("POST", "/api/auth/enable", refuse);
    this.on("POST", "/api/auth/disable", () => this.users.state(this.req));

    this.on("GET", "/api/overview", (c) => this.log.overview(o(), c.query.today));
    this.on("GET", "/api/reminders", (c) => this.log.reminders(o(), c.query.today));
    this.on("GET", "/api/splurges", (c) => this.log.splurgesBetween(o(), c.query.from ?? "", c.query.to ?? ""));
    this.on("POST", "/api/splurges", (c) => this.log.addSplurge(o(), c.body));
    this.on("PUT", "/api/splurges/:id", (c) => this.log.updateSplurge(o(), c.params.id, c.body));
    this.on("DELETE", "/api/splurges/:id", (c) => { this.log.deleteSplurge(o(), c.params.id); });
    this.on("GET", "/api/activities", (c) => this.log.activitiesBetween(o(), c.query.from ?? "", c.query.to ?? ""));
    this.on("POST", "/api/activities", (c) => this.log.addActivity(o(), c.body));
    this.on("PUT", "/api/activities/:id", (c) => this.log.updateActivity(o(), c.params.id, c.body));
    this.on("DELETE", "/api/activities/:id", (c) => { this.log.deleteActivity(o(), c.params.id); });
    this.on("GET", "/api/weigh-ins", (c) => this.log.weighInsBetween(o(), c.query.from ?? "", c.query.to ?? ""));
    this.on("PUT", "/api/weigh-ins/:day", (c) => this.log.setWeighIn(o(), c.params.day, c.body));
    this.on("DELETE", "/api/weigh-ins/:day", (c) => { this.log.deleteWeighIn(o(), c.params.day); });

    this.on("GET", "/api/goals", (c) => this.goals.list(o(), c.query.today));
    this.on("POST", "/api/goals", (c) => this.goals.add(o(), c.body));
    this.on("PUT", "/api/goals/:id", (c) => this.goals.edit(o(), c.params.id, c.body));
    this.on("POST", "/api/goals/:id/move", (c) => { this.goals.move(o(), c.params.id, c.body); });
    this.on("POST", "/api/goals/:id/done", (c) => this.goals.done(o(), c.params.id, c.body.today));
    this.on("POST", "/api/goals/:id/reopen", (c) => this.goals.reopen(o(), c.params.id, c.body.today));
    this.on("DELETE", "/api/goals/:id", (c) => { this.goals.remove(o(), c.params.id, c.body.today); });

    this.on("GET", "/api/game", (c) => this.game.view(o(), c.query));
    this.on("GET", "/api/game/hall", (c) => this.game.hall(o(), c.query));
    this.on("POST", "/api/game/sync", (c) => this.game.sync(o(), c.body));
    this.on("POST", "/api/game/run", (c) => this.game.start(o(), c.body));
    this.on("POST", "/api/game/auto", (c) => this.game.auto(o(), c.body));
    this.on("POST", "/api/game/next", (c) => this.game.next(o(), c.body));
    this.on("POST", "/api/game/bet", (c) => this.game.bet(o(), c.body));
    this.on("POST", "/api/game/powerup", (c) => this.game.powerUp(o(), c.body));
    this.on("POST", "/api/game/mode", (c) => this.game.mode(o(), c.body));
    this.on("GET", "/api/me/settings", () => this.users.settings(o()));
    this.on("PUT", "/api/me/settings", (c) => this.users.saveSettings(o(), parse(userSettingsSchema, c.body)));

    this.on("GET", "/api/users", () => this.users.list(this.req));
    this.on("POST", "/api/users", refuse);
    this.on("PUT", "/api/users/:id/password", refuse);
    this.on("PUT", "/api/users/:id/name", (c) => this.users.rename(c.params.id, c.body.name));
    this.on("POST", "/api/users/switch-back", () => this.users.state(this.req));
    this.on("POST", "/api/users/:id/switch", refuse);
    this.on("DELETE", "/api/users/:id", refuse);

    this.on("GET", "/api/settings", () => this.appSettings());
    this.on("PUT", "/api/settings", (c) => {
      const patch = parse(settingsSchema, c.body);
      if (patch.server || patch.security) throw new UserError("The phone app has no network or sign-in settings.");
      if (patch.appearance) {
        const next = { ...this.appearance(), ...patch.appearance };
        this.db.prepare("INSERT INTO phone_app (key, value) VALUES ('appearance', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(JSON.stringify(next));
      }
      const s = this.appSettings();
      return { config: s.config, restartRequired: [], networkUrls: [] };
    });
  }

  /** Answer one request the way the server would: JSON, `{ error }` with a plain sentence when refused. */
  handle(method: string, url: string, body?: unknown): Answer {
    const u = new URL(url, "http://phone");
    const m = method.toUpperCase();
    const query = Object.fromEntries(u.searchParams.entries());
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    for (const [rm, re, names, fn] of this.routes) {
      if (rm !== m) continue;
      const hit = re.exec(u.pathname);
      if (!hit) continue;
      const params = Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(hit[i + 1])]));
      try {
        const out = fn({ params, query, body: b });
        return { status: 200, body: out ?? { ok: true } };
      } catch (e) {
        if (e instanceof UserError) return { status: e.status, body: { error: e.message } };
        if ((e as { code?: string })?.code === "SQLITE_CONSTRAINT_UNIQUE") return { status: 409, body: { error: "That name is already taken. Pick a different name." } };
        console.error("[craving-crusher]", e);
        return { status: 500, body: { error: "Something went wrong in the app. Close Craving Crusher and open it again." } };
      }
    }
    return { status: 404, body: { error: "No such address." } };
  }
}

/** the phone's own date ("2026-11-21"): on the phone the "server" and the page share one clock */
function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
