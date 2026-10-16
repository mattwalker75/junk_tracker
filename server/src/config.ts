/**
 * config.json — the app-wide settings (the port, network access, the login, the database file, the
 * look). Settings in the page reads and writes this same file. Missing keys fall back to DEFAULTS,
 * unknown keys are kept, and the file is written atomically with owner-only permissions.
 * Each person's own settings (units, trend, week start, size examples) live in the database instead.
 *
 * Paths inside it are relative to the folder config.json lives in.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CustomTheme } from "../../shared/types.js";
import { writeAtomic } from "./util.js";

export interface AppConfig {
  /** extraHosts: other names this computer is reached by (a VPN or Tailscale name) that the app answers to */
  server: { port: number; allowNetwork: boolean; extraHosts: string[] };
  security: { loginEnabled: boolean; sessionDays: number };
  database: { path: string };
  appearance: { theme: string; customThemes: CustomTheme[] };
}

export const DEFAULTS: AppConfig = {
  server: { port: 8420, allowNetwork: false, extraHosts: [] },
  security: { loginEnabled: false, sessionDays: 30 },
  database: { path: "./data/junk.db" },
  appearance: { theme: "system", customThemes: [] },
};

/** Settings that only take effect after ./TRACKER.sh --restart. */
export const RESTART_REQUIRED = ["server.port", "server.allowNetwork", "security.sessionDays", "database.path"];

/** The repository folder: the nearest parent holding this app's package.json. */
function findRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const pkg = path.join(dir, "package.json");
    if (fs.existsSync(pkg)) {
      try { if (JSON.parse(fs.readFileSync(pkg, "utf8")).name === "junk-tracker") return dir; } catch {}
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}
export const ROOT = findRoot();

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

export function deepMerge<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over)) return (over === undefined ? base : over) as T;
  const out: Obj = { ...(base as Obj) };
  for (const [k, v] of Object.entries(over)) out[k] = k in out ? deepMerge(out[k], v) : v;
  return out as T;
}

function getPath(o: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((a, k) => (isObj(a) ? a[k] : undefined), o);
}

export class Config {
  readonly file: string;
  private data: AppConfig = structuredClone(DEFAULTS);
  private pending = new Set<string>();
  private readonly startedWith: AppConfig;

  constructor(file = process.env.JT_CONFIG || path.join(ROOT, "config.json")) {
    this.file = path.resolve(file);
    this.load();
    this.startedWith = structuredClone(this.data);
  }

  get dir(): string { return path.dirname(this.file); }
  get(): AppConfig { return this.data; }

  /** Resolve a path setting against the config file's folder (~ = home). */
  resolve(p: string): string {
    if (p.startsWith("~")) p = path.join(process.env.HOME || "", p.slice(1));
    return path.resolve(this.dir, p);
  }

  load(): void {
    let raw: unknown = {};
    if (fs.existsSync(this.file)) {
      try { raw = JSON.parse(fs.readFileSync(this.file, "utf8")); }
      catch (e) { throw new Error(`config.json is not valid JSON (${(e as Error).message}). Fix it or delete it to start from the defaults.`); }
    }
    this.data = deepMerge(structuredClone(DEFAULTS), raw);
  }

  save(): void {
    writeAtomic(this.file, JSON.stringify(this.data, null, 2) + "\n", 0o600);
    try { fs.chmodSync(this.file, 0o600); } catch {}
  }

  /** Merge a checked partial change in and save. Returns which changed keys need a restart. */
  update(patch: unknown): { restartRequired: string[] } {
    this.data = deepMerge(this.data, patch);
    this.save();
    for (const k of RESTART_REQUIRED) {
      if (JSON.stringify(getPath(this.data, k)) !== JSON.stringify(getPath(this.startedWith, k))) this.pending.add(k);
      else this.pending.delete(k);
    }
    return { restartRequired: [...this.pending] };
  }

  restartRequired(): string[] { return [...this.pending]; }
}
