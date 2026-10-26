/**
 * The HTTP app: security middleware, sessions, every /api route, and the built page.
 * `createApp` is used by index.ts and by the tests (which run it on a spare port with scratch data).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import cookieSession from "cookie-session";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import type Database from "better-sqlite3";
import { z } from "zod";
import { Config, ROOT } from "./config.js";
import { openDatabase } from "./db.js";
import { Goals } from "./goals.js";
import { Log } from "./log.js";
import { hostGuard, networkUrls, sameOriginWrites } from "./security.js";
import { Users } from "./users.js";
import { parse, UserError, writeAtomic } from "./util.js";

export const VERSION: string = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

type Handler = (req: Request, res: Response) => unknown;
/** Wrap a route so a thrown UserError becomes { error } with its status, and anything else a logged 500. */
const h = (fn: Handler) => async (req: Request, res: Response, next: NextFunction) => {
  try { const out = await fn(req, res); if (!res.headersSent) res.json(out ?? { ok: true }); } catch (e) { next(e); }
};
const param = (req: Request, k: string) => String(req.params[k]);

/** The key that signs session cookies, kept beside the database so a restart does not sign everyone out. */
function sessionKey(config: Config): string {
  const file = path.join(path.dirname(config.resolve(config.get().database.path)), "session.key");
  try { const k = fs.readFileSync(file, "utf8").trim(); if (k.length >= 32) return k; } catch {}
  const k = crypto.randomBytes(32).toString("hex");
  writeAtomic(file, k + "\n", 0o600);
  return k;
}

const themeSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  name: z.string().trim().min(1, "Give the theme a name.").max(40),
  dark: z.boolean(),
  tokens: z.record(z.string().regex(/^[a-z0-9-]{1,30}$/), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours are #rrggbb.")),
});
const hostName = z.string().trim().toLowerCase().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/, "Other names are plain host names, like my-mac.tailnet-name.ts.net — no http:// or port.");
/** Only these app settings can be changed from the page, each checked. */
const settingsSchema = z.object({
  server: z.object({
    port: z.number().int().min(1024, "Use a port from 1024 to 65535.").max(65535, "Use a port from 1024 to 65535."),
    allowNetwork: z.boolean(),
    extraHosts: z.array(hostName).max(20),
  }).partial(),
  // signing in is turned on and off with /api/auth/enable and /disable (they set or remove the password), never here
  security: z.object({ sessionDays: z.number().int().min(1).max(365) }).partial().strict(),
  appearance: z.object({ theme: z.string().max(40), customThemes: z.array(themeSchema).max(30) }).partial(),
}).partial().strict();

const userSettingsSchema = z.object({
  units: z.enum(["lb", "kg"]),
  trendDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  weekStart: z.union([z.literal(0), z.literal(1)]),
  examples: z.object({ snack: z.string().max(120), meal: z.string().max(120), feast: z.string().max(120) }).partial(),
}).partial().strict();

export interface AppHandle { app: express.Express; db: Database.Database; users: Users; log: Log; goals: Goals; config: Config }

export function createApp(config = new Config(), opts: { rateLimit?: boolean; webDir?: string } = {}): AppHandle {
  const db = openDatabase(config.resolve(config.get().database.path));
  const users = new Users(db, config);
  const goals = new Goals(db);
  const log = new Log(db, users, goals);
  const owner = (req: Request) => users.owner(req);
  const app = express();
  app.disable("x-powered-by");
  app.set("etag", false);

  app.use(hostGuard(config));
  app.use(helmet({
    contentSecurityPolicy: { useDefaults: true, directives: {
      "default-src": ["'self'"], "img-src": ["'self'", "data:"], "style-src": ["'self'", "'unsafe-inline'"],
      "font-src": ["'self'", "data:"], "connect-src": ["'self'"], "script-src": ["'self'"], "upgrade-insecure-requests": null,
    } },
    strictTransportSecurity: false, // plain http on a home network must keep working
  }));
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieSession({ name: "jt_session", keys: [sessionKey(config)], httpOnly: true, sameSite: "strict",
    maxAge: Math.max(1, config.get().security.sessionDays) * 86_400_000 }));
  app.use(sameOriginWrites);

  // one limiter per kind of request, so setting a few passwords never locks anyone out of signing in;
  // signing in only counts the attempts that fail
  const limit = (o: { skipSuccessfulRequests?: boolean } = {}) => opts.rateLimit === false ? (_r: Request, _s: Response, n: NextFunction) => n()
    : rateLimit({ windowMs: 5 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Too many attempts. Wait five minutes and try again." }, ...o });
  const loginLimiter = limit({ skipSuccessfulRequests: true });
  const setupLimiter = limit();
  const passwordLimiter = limit();

  // ---------------------------------------------------------------- open routes
  // "app" lets the scripts tell Junk Tracker from another program answering on the same port
  app.get("/api/health", (_req, res) => { res.json({ ok: true, app: "junk-tracker", version: VERSION }); });
  app.get("/api/auth/me", h((req) => users.state(req)));
  // the look is needed before signing in, so the sign-in screen wears the same theme
  app.get("/api/appearance", h(() => { const a = config.get().appearance; return { theme: a.theme, customThemes: a.customThemes }; }));
  app.post("/api/auth/setup", setupLimiter, h((req) => users.setup(req, req.body?.name, req.body?.password)));
  app.post("/api/auth/login", loginLimiter, h((req) => {
    if (!config.get().security.loginEnabled) throw new UserError("Signing in is turned off — just open the app.", 409);
    return users.login(req, req.body?.name, req.body?.password);
  }));
  app.post("/api/auth/logout", h((req) => { req.session = null; return { ok: true }; }));

  // ---------------------------------------------------------------- everything else needs a person (signed in, with the login on)
  app.use("/api", (req, res, next) => {
    if (users.allowed(req)) return next();
    const auth = users.state(req);
    res.status(401).json({ error: auth.status === "setup" ? "Choose a name and password first." : "Sign in first.", auth });
  });

  // ---------------------------------------------------------------- the log of the person on screen
  app.get("/api/overview", h((req) => log.overview(owner(req), req.query.today)));
  app.get("/api/splurges", h((req) => log.splurgesBetween(owner(req), String(req.query.from || ""), String(req.query.to || ""))));
  app.post("/api/splurges", h((req) => log.addSplurge(owner(req), req.body)));
  app.put("/api/splurges/:id", h((req) => log.updateSplurge(owner(req), param(req, "id"), req.body)));
  app.delete("/api/splurges/:id", h((req) => { log.deleteSplurge(owner(req), param(req, "id")); }));
  app.get("/api/weigh-ins", h((req) => log.weighInsBetween(owner(req), String(req.query.from || ""), String(req.query.to || ""))));
  app.put("/api/weigh-ins/:day", h((req) => log.setWeighIn(owner(req), param(req, "day"), req.body)));
  app.delete("/api/weigh-ins/:day", h((req) => { log.deleteWeighIn(owner(req), param(req, "day")); }));
  // goals: the open list in order (the first is the goal now) and the ones checked off
  app.get("/api/goals", h((req) => goals.list(owner(req), req.query.today)));
  app.post("/api/goals", h((req) => goals.add(owner(req), req.body)));
  app.put("/api/goals/:id", h((req) => goals.edit(owner(req), param(req, "id"), req.body)));
  app.post("/api/goals/:id/move", h((req) => { goals.move(owner(req), param(req, "id"), req.body?.dir); }));
  app.post("/api/goals/:id/done", h((req) => goals.done(owner(req), param(req, "id"), req.body?.today)));
  app.post("/api/goals/:id/reopen", h((req) => goals.reopen(owner(req), param(req, "id"))));
  app.delete("/api/goals/:id", h((req) => { goals.remove(owner(req), param(req, "id")); }));
  app.get("/api/me/settings", h((req) => users.settings(owner(req))));
  app.put("/api/me/settings", h((req) => users.saveSettings(owner(req), parse(userSettingsSchema, req.body))));

  // ---------------------------------------------------------------- users (every person may do all of this)
  app.get("/api/users", h((req) => users.list(req)));
  app.post("/api/users", h((req) => users.add(req.body?.name, req.body?.password)));
  app.put("/api/users/:id/password", passwordLimiter, h(async (req) => { await users.setPassword(req, param(req, "id"), req.body?.password); }));
  app.put("/api/users/:id/name", h((req) => users.rename(param(req, "id"), req.body?.name)));
  // users and sign-in on: you get a name and password and this browser signs in; off: back to one log
  app.post("/api/auth/enable", setupLimiter, h(async (req) => {
    await users.enable(req, req.body?.name, req.body?.password);
    config.update({ security: { loginEnabled: true } });
    return users.state(req);
  }));
  app.post("/api/auth/disable", h((req) => {
    if (req.body?.confirm !== "TURN OFF") throw new UserError("Type TURN OFF to confirm.");
    if (!config.get().security.loginEnabled) return users.state(req);
    users.disable();
    config.update({ security: { loginEnabled: false } });
    return users.state(req);
  }));
  app.post("/api/users/switch-back", h((req) => { users.switchBack(req); return users.state(req); }));
  app.post("/api/users/:id/switch", h((req) => { users.switchTo(req, param(req, "id")); return users.state(req); }));
  app.delete("/api/users/:id", h((req) => {
    if (req.body?.confirm !== "DELETE") throw new UserError("Type DELETE to confirm — their splurges and weigh-ins go with them.");
    users.remove(req, param(req, "id"));
  }));

  // ---------------------------------------------------------------- app settings (config.json)
  app.get("/api/settings", h(() => {
    const c = config.get();
    return { version: VERSION, config: c, restartRequired: config.restartRequired(), configFile: config.file,
      databaseFile: config.resolve(c.database.path), networkUrls: c.server.allowNetwork ? networkUrls(c.server.port) : [] };
  }));
  app.put("/api/settings", h((req) => {
    const patch = parse(settingsSchema, req.body);
    if (patch.server?.extraHosts) patch.server.extraHosts = [...new Set(patch.server.extraHosts)];
    const r = config.update(patch);
    const c = config.get();
    return { config: c, restartRequired: r.restartRequired, networkUrls: c.server.allowNetwork ? networkUrls(c.server.port) : [] };
  }));

  // ---------------------------------------------------------------- the page
  app.use("/api", (_req, res) => { res.status(404).json({ error: "No such address." }); });
  const web = opts.webDir ?? path.join(ROOT, "dist", "web");
  if (fs.existsSync(path.join(web, "index.html"))) {
    app.use(express.static(web, { index: false, maxAge: "1h", setHeaders: (res, f) => { if (f.endsWith(".html")) res.setHeader("cache-control", "no-cache"); } }));
    app.get(/.*/, (_req, res) => { res.setHeader("cache-control", "no-cache"); res.sendFile(path.join(web, "index.html")); });
  } else {
    app.get("/", (_req, res) => { res.type("text").send("Junk Tracker's page is not built yet. Run ./TRACKER.sh --start (it builds it), or npm run build."); });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof UserError) { res.status(err.status).json({ error: err.message }); return; }
    // body-parser's own refusals (bad JSON, too large, wrong charset) are the asker's fault, not a server error
    const status = Number((err as { status?: number })?.status);
    if ((err as { type?: string })?.type === "entity.parse.failed") { res.status(400).json({ error: "That request was not valid." }); return; }
    if (status >= 400 && status < 500) { res.status(status).json({ error: status === 413 ? "That is too much to send at once." : "That request was not valid." }); return; }
    if ((err as { code?: string })?.code === "SQLITE_CONSTRAINT_UNIQUE") { res.status(409).json({ error: "That name is already taken. Pick a different name." }); return; }
    console.error("[error]", err);
    res.status(500).json({ error: "Something went wrong on the server. The log has the details (./TRACKER.sh --logs)." });
  });

  return { app, db, users, log, goals, config };
}
