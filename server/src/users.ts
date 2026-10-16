/**
 * People, passwords and who a request is acting for.
 *
 * Everyone who uses Junk Tracker is a user in the database with a name and a password (bcrypt).
 * The accounts are for keeping each person's log apart, more than for privacy, so every user may
 * add users, set anyone's password and "switch to" anyone to look at or fill in their log
 * (a strip at the top says so; switching back is one tap).
 *
 *  - Login OFF (the default): nobody signs in. A browser is the first person created until it
 *    switches to someone else.
 *  - Login ON: a browser signs in with a name and password. The session carries a fingerprint
 *    of the password, so setting a new password signs that person out everywhere else.
 *
 * Sessions are signed cookies; the signing key is kept in data/session.key so a restart (after an
 * update, say) does not sign the phone out.
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type Database from "better-sqlite3";
import type { Request } from "express";
import { DEFAULT_USER_SETTINGS, SIZES, type AuthState, type Id, type UserInfo, type UserSettings } from "../../shared/types.js";
import type { Config } from "./config.js";
import { newId, now, UserError } from "./util.js";

export const MIN_PASSWORD = 8;

export interface SessionData {
  /** the signed-in person (login on), or the one this browser is (login off) */
  userId?: Id;
  /** fingerprint of the password the session signed in with (login on) */
  tag?: string;
  /** whose log is shown instead, after "Switch to" */
  actingAs?: Id;
}

interface Row { id: Id; name: string; password_hash: string; settings_json: string; created_at: string; last_used_at: string | null }
const tagOf = (hash: string) => crypto.createHash("sha256").update(hash).digest("hex").slice(0, 16);
const session = (req: Request) => (req.session ?? {}) as SessionData;

export class Users {
  private decoy: string | null = null;

  constructor(private readonly db: Database.Database, private readonly config: Config) {}

  private loginOn(): boolean { return !!this.config.get().security.loginEnabled; }
  private all(): Row[] { return this.db.prepare("SELECT * FROM users ORDER BY created_at, name").all() as Row[]; }
  private byId(id: Id | undefined): Row | undefined { return id ? (this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Row | undefined) : undefined; }
  private byName(name: string): Row | undefined { return this.db.prepare("SELECT * FROM users WHERE name = ? COLLATE NOCASE").get(name.trim()) as Row | undefined; }
  count(): number { return (this.db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n; }

  // ---------------------------------------------------------------- who is asking
  /** The person this browser is (signed in, or by default with the login off), or null. */
  private me(req: Request): Row | null {
    const s = session(req);
    if (this.loginOn()) {
      const u = this.byId(s.userId);
      return u && s.tag === tagOf(u.password_hash) ? u : null;
    }
    return this.byId(s.userId) ?? this.all()[0] ?? null;
  }

  /** Whose log a request works on: the person switched to, else the person themselves. */
  owner(req: Request): Id {
    const me = this.me(req);
    if (!me) throw new UserError(this.count() ? "Sign in first." : "Create the first person first.", 401);
    const acting = session(req).actingAs;
    return acting && acting !== me.id && this.byId(acting) ? acting : me.id;
  }

  allowed(req: Request): boolean { return !!this.me(req); }

  state(req: Request): AuthState {
    if (!this.count()) return { status: "setup" };
    const me = this.me(req);
    if (!me) return { status: "signin" };
    const actingId = session(req).actingAs;
    const acting = actingId && actingId !== me.id ? this.byId(actingId) : undefined;
    return { status: "ok", loginEnabled: this.loginOn(), me: { id: me.id, name: me.name }, acting: acting ? { id: acting.id, name: acting.name } : null };
  }

  // ---------------------------------------------------------------- names and passwords
  private static checkName(name: unknown): string {
    const n = String(name ?? "").trim();
    if (!n) throw new UserError("Type a name.");
    if (n.length > 40) throw new UserError("Keep the name under 40 characters.");
    return n;
  }
  private static checkPassword(password: unknown): string {
    const p = String(password ?? "");
    if (p.length < MIN_PASSWORD) throw new UserError(`Choose a password of at least ${MIN_PASSWORD} characters.`);
    if (p.length > 1024) throw new UserError("That password is too long.");
    return p;
  }

  private signInAs(req: Request, u: Row): void {
    req.session = { userId: u.id, tag: tagOf(u.password_hash) };
    this.db.prepare("UPDATE users SET last_used_at = ? WHERE id = ?").run(now(), u.id);
  }

  /** First start: create the first person and make this browser them. */
  async setup(req: Request, name: unknown, password: unknown): Promise<AuthState> {
    if (this.count()) throw new UserError("Someone already exists. Sign in, or add people in Settings → Users.", 409);
    const u = await this.insert(name, password);
    this.signInAs(req, u);
    return this.state(req);
  }

  async login(req: Request, name: unknown, password: unknown): Promise<AuthState> {
    const u = this.byName(String(name ?? ""));
    // an unknown name costs the same time as a wrong password, so timing does not reveal which names exist
    if (!u) this.decoy ??= await bcrypt.hash("nobody-signs-in-with-this", 10);
    const ok = await bcrypt.compare(String(password ?? ""), u?.password_hash ?? this.decoy!);
    if (!u || !ok) throw new UserError("That name and password do not match.", 401);
    this.signInAs(req, u);
    return this.state(req);
  }

  private async insert(name: unknown, password: unknown): Promise<Row> {
    const n = Users.checkName(name);
    const p = Users.checkPassword(password);
    if (this.byName(n)) throw new UserError(`There is already someone called “${n}”. Pick a different name.`, 409);
    const row: Row = { id: newId(), name: n, password_hash: await bcrypt.hash(p, 10), settings_json: "{}", created_at: now(), last_used_at: null };
    this.db.prepare("INSERT INTO users (id, name, password_hash, settings_json, created_at, last_used_at) VALUES (@id, @name, @password_hash, @settings_json, @created_at, @last_used_at)").run(row);
    return row;
  }

  // ---------------------------------------------------------------- the Users page
  list(req: Request): UserInfo[] {
    const me = this.me(req);
    return this.all().map((u) => ({ id: u.id, name: u.name, createdAt: u.created_at, lastUsedAt: u.last_used_at, isYou: u.id === me?.id }));
  }

  async add(name: unknown, password: unknown): Promise<UserInfo> {
    const u = await this.insert(name, password);
    return { id: u.id, name: u.name, createdAt: u.created_at, lastUsedAt: null, isYou: false };
  }

  /** Set anyone's password. Your own: this browser stays signed in with the new one. */
  async setPassword(req: Request, id: Id, password: unknown): Promise<void> {
    const u = this.byId(id);
    if (!u) throw new UserError("That person no longer exists.", 404);
    const hash = await bcrypt.hash(Users.checkPassword(password), 10);
    // who this browser is must be worked out BEFORE the change: afterwards its fingerprint no longer matches
    const mine = this.me(req)?.id === id;
    this.db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
    if (mine) {
      const s = session(req);
      req.session = { ...s, userId: id, tag: tagOf(hash) };
    }
  }

  switchTo(req: Request, id: Id): void {
    const me = this.me(req);
    if (!me) throw new UserError("Sign in first.", 401);
    if (!this.byId(id)) throw new UserError("That person no longer exists.", 404);
    const s = session(req);
    req.session = { ...s, userId: me.id, actingAs: id === me.id ? undefined : id };
    this.db.prepare("UPDATE users SET last_used_at = ? WHERE id = ?").run(now(), id);
  }

  switchBack(req: Request): void {
    const s = session(req);
    const next: SessionData = { ...s };
    delete next.actingAs;
    req.session = next;
  }

  /** Remove someone and everything they logged. Never yourself, never the last person. */
  remove(req: Request, id: Id): void {
    const me = this.me(req);
    if (me?.id === id) throw new UserError("You cannot remove yourself. Switch to another person's sign-in to remove this one.", 409);
    if (!this.byId(id)) throw new UserError("That person no longer exists.", 404);
    if (this.count() <= 1) throw new UserError("Junk Tracker needs at least one person.", 409);
    this.db.prepare("DELETE FROM users WHERE id = ?").run(id);
    if (session(req).actingAs === id) this.switchBack(req);
  }

  // ---------------------------------------------------------------- each person's own settings
  settings(id: Id): UserSettings {
    const u = this.byId(id);
    let saved: Partial<UserSettings> = {};
    try { saved = JSON.parse(u?.settings_json || "{}"); } catch {}
    return {
      ...DEFAULT_USER_SETTINGS,
      ...saved,
      examples: { ...DEFAULT_USER_SETTINGS.examples, ...(saved.examples || {}) },
    };
  }

  saveSettings(id: Id, patch: Partial<Omit<UserSettings, "examples">> & { examples?: Partial<UserSettings["examples"]> }): UserSettings {
    const cur = this.settings(id);
    const next: UserSettings = { ...cur, ...patch, examples: { ...cur.examples, ...(patch.examples || {}) } as UserSettings["examples"] };
    for (const s of SIZES) next.examples[s] = String(next.examples[s] ?? "").trim().slice(0, 120);
    this.db.prepare("UPDATE users SET settings_json = ? WHERE id = ?").run(JSON.stringify(next), id);
    return next;
  }
}
