/**
 * People, passwords and who a request is acting for.
 *
 * Like People Manager and the trading desk, Junk Tracker starts as ONE person with no sign-in:
 *
 *  - Login OFF (the default): nobody signs in and there is one log. The first time the app is
 *    opened that person is made for you ("Me", no password; rename them in Settings).
 *  - Login ON (Settings → Users and sign-in, which asks for your name and a password): several
 *    users, each with their own log, each signing in with a name and password (bcrypt). The
 *    session carries a fingerprint of the password, so a new password signs that person out
 *    everywhere else. The accounts keep logs apart more than they keep them private: every user
 *    may add users, set anyone's password and "switch to" anyone to look at or fill in their log.
 *  - Turning it OFF again is refused while there is more than one user (remove the others
 *    first, so no one's log is lost); it then removes the password.
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
/** the one person made on first start, with the login off */
export const FIRST_NAME = "Me";

export interface SessionData {
  /** the signed-in person (login on), or the one this browser is (login off) */
  userId?: Id;
  /** fingerprint of the password the session signed in with (login on) */
  tag?: string;
  /** whose log is shown instead, after "Switch to" */
  actingAs?: Id;
  /** when it signed in (ms) — the server, not only the cookie, ends a sign-in after security.sessionDays */
  at?: number;
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
      const days = Math.max(1, this.config.get().security.sessionDays || 30);
      if (!s.at || Date.now() - s.at > days * 86_400_000) return null;
      return u && u.password_hash && s.tag === tagOf(u.password_hash) ? u : null;
    }
    return this.byId(s.userId) ?? this.all()[0] ?? this.first();
  }

  /** First start with the login off: make the one person, so the app opens straight onto their log. */
  private first(): Row {
    const row: Row = { id: newId(), name: FIRST_NAME, password_hash: "", settings_json: "{}", created_at: now(), last_used_at: null };
    this.db.prepare("INSERT INTO users (id, name, password_hash, settings_json, created_at, last_used_at) VALUES (@id, @name, @password_hash, @settings_json, @created_at, @last_used_at)").run(row);
    return row;
  }
  /** Does anyone have a password? (Signing in needs one; with none, the page asks for the first.) */
  private anyPassword(): boolean { return !!this.db.prepare("SELECT 1 FROM users WHERE password_hash != '' LIMIT 1").get(); }

  /** Whose log a request works on: the person switched to, else the person themselves. */
  owner(req: Request): Id {
    const me = this.me(req);
    if (!me) throw new UserError("Sign in first.", 401);
    const acting = session(req).actingAs;
    return acting && acting !== me.id && this.byId(acting) ? acting : me.id;
  }

  allowed(req: Request): boolean { return !!this.me(req); }

  state(req: Request): AuthState {
    // the login is on but nobody can sign in (config.json edited by hand): ask for a name and password
    if (this.loginOn() && !this.anyPassword()) return { status: "setup" };
    const me = this.me(req);
    if (!me) return { status: "signin" };
    const actingId = session(req).actingAs;
    const acting = actingId && actingId !== me.id ? this.byId(actingId) : undefined;
    return { status: "ok", loginEnabled: this.loginOn(), users: this.count(), me: { id: me.id, name: me.name }, acting: acting ? { id: acting.id, name: acting.name } : null };
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
    req.session = { userId: u.id, tag: tagOf(u.password_hash), at: Date.now() };
    this.db.prepare("UPDATE users SET last_used_at = ? WHERE id = ?").run(now(), u.id);
  }

  /** The login is on and nobody has a password: the first person gets a name and password, and this browser is them. */
  async setup(req: Request, name: unknown, password: unknown): Promise<AuthState> {
    if (!this.loginOn() || this.anyPassword()) throw new UserError("Junk Tracker is already set up. Sign in, or add people in Settings → Users.", 409);
    const u = this.all()[0] ?? this.first();
    this.signInAs(req, await this.nameAndPassword(u, name, password, () => {
      if (this.anyPassword()) throw new UserError("Junk Tracker is already set up. Sign in, or add people in Settings → Users.", 409);
    }));
    return this.state(req);
  }

  /**
   * Turn on several users and sign-in: the person on screen gets a name and password and this
   * browser is signed in as them. (The caller then saves security.loginEnabled = true.)
   */
  async enable(req: Request, name: unknown, password: unknown): Promise<void> {
    if (this.loginOn()) throw new UserError("Users and sign-in are already on.", 409);
    const me = this.me(req);
    if (!me) throw new UserError("Open the app first.", 409);
    const u = await this.nameAndPassword(me, name, password, () => {
      // two "turn on" requests at once: only the first one names you and sets the password
      if (this.loginOn() || this.anyPassword()) throw new UserError("Users and sign-in are already on.", 409);
    });
    req.session = { userId: u.id, tag: tagOf(u.password_hash), at: Date.now() };
  }

  /** Turn sign-in off: only with one person left (no log is lost); their password goes. */
  disable(): void {
    if (this.count() > 1) throw new UserError(`There are ${this.count()} users. Remove everyone but yourself in Settings → Users first — with sign-in off there is only one log.`, 409);
    this.db.prepare("UPDATE users SET password_hash = ''").run();
  }

  /** `recheck` runs after the (slow) hashing, right before the write, so a request that raced past the first checks is refused. */
  private async nameAndPassword(u: Row, name: unknown, password: unknown, recheck: () => void = () => {}): Promise<Row> {
    const n = Users.checkName(name);
    const p = Users.checkPassword(password);
    this.nameFree(n, u.id);
    const hash = await bcrypt.hash(p, 10);
    recheck();
    this.nameFree(n, u.id);
    this.db.prepare("UPDATE users SET name = ?, password_hash = ?, last_used_at = ? WHERE id = ?").run(n, hash, now(), u.id);
    return { ...u, name: n, password_hash: hash };
  }

  /** A new name for someone (any user may rename anyone, like setting their password). */
  rename(id: Id, name: unknown): UserInfo {
    const u = this.byId(id);
    if (!u) throw new UserError("That person no longer exists.", 404);
    const n = Users.checkName(name);
    this.nameFree(n, id);
    this.db.prepare("UPDATE users SET name = ? WHERE id = ?").run(n, id);
    return { id, name: n, createdAt: u.created_at, lastUsedAt: u.last_used_at, isYou: false };
  }

  async login(req: Request, name: unknown, password: unknown): Promise<AuthState> {
    const u = this.byName(String(name ?? ""));
    // an unknown name costs the same time as a wrong password, so timing does not reveal which names exist
    if (!u) this.decoy ??= await bcrypt.hash("nobody-signs-in-with-this", 10);
    // someone without a password (made while sign-in was off) cannot sign in with any password
    const ok = await bcrypt.compare(String(password ?? ""), u?.password_hash || this.decoy || (this.decoy = await bcrypt.hash("nobody-signs-in-with-this", 10)));
    if (!u || !u.password_hash || !ok) throw new UserError("That name and password do not match.", 401);
    this.signInAs(req, u);
    return this.state(req);
  }

  /** Names are unique in any mix of capitals; `except` is the person being renamed. */
  private nameFree(n: string, except?: Id): void {
    const clash = this.byName(n);
    if (clash && clash.id !== except) throw new UserError(`There is already someone called “${n}”. Pick a different name.`, 409);
  }

  private async insert(name: unknown, password: unknown): Promise<Row> {
    const n = Users.checkName(name);
    const p = Users.checkPassword(password);
    this.nameFree(n);
    const hash = await bcrypt.hash(p, 10);
    // checked again after the hashing: two adds of the same name at once, or sign-in turned off meanwhile
    this.nameFree(n);
    if (!this.loginOn()) throw new UserError("Turn on users and sign-in first (Settings → Users and sign-in).", 409);
    const row: Row = { id: newId(), name: n, password_hash: hash, settings_json: "{}", created_at: now(), last_used_at: null };
    this.db.prepare("INSERT INTO users (id, name, password_hash, settings_json, created_at, last_used_at) VALUES (@id, @name, @password_hash, @settings_json, @created_at, @last_used_at)").run(row);
    return row;
  }

  // ---------------------------------------------------------------- the Users page
  list(req: Request): UserInfo[] {
    const me = this.me(req);
    return this.all().map((u) => ({ id: u.id, name: u.name, createdAt: u.created_at, lastUsedAt: u.last_used_at, isYou: u.id === me?.id }));
  }

  async add(name: unknown, password: unknown): Promise<UserInfo> {
    if (!this.loginOn()) throw new UserError("Turn on users and sign-in first (Settings → Users and sign-in).", 409);
    const u = await this.insert(name, password);
    return { id: u.id, name: u.name, createdAt: u.created_at, lastUsedAt: null, isYou: false };
  }

  /** Set anyone's password. Your own: this browser stays signed in with the new one. */
  async setPassword(req: Request, id: Id, password: unknown): Promise<void> {
    // with sign-in off nobody has a password (turning it on sets yours)
    if (!this.loginOn()) throw new UserError("Turn on users and sign-in first (Settings → Users and sign-in).", 409);
    const u = this.byId(id);
    if (!u) throw new UserError("That person no longer exists.", 404);
    const hash = await bcrypt.hash(Users.checkPassword(password), 10);
    if (!this.byId(id)) throw new UserError("That person no longer exists.", 404);
    // who this browser is must be worked out BEFORE the change: afterwards its fingerprint no longer matches
    const mine = this.me(req)?.id === id;
    this.db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
    if (mine) {
      const s = session(req);
      req.session = { ...s, userId: id, tag: tagOf(hash), at: s.at ?? Date.now() };
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
