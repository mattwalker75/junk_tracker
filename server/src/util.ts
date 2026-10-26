import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { z } from "zod";

const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

/** A 12-character random id ("k3m9x2pq7wza"). */
export function newId(): string {
  const bytes = crypto.randomBytes(12);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}

export const now = (): string => new Date().toISOString();

/** An error whose message is shown to the person as-is (HTTP 400 unless given). */
export class UserError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

/** Check a request body against a schema; the first problem becomes the UserError the person sees. */
export function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw new UserError(r.error.issues[0]?.message || "Something in that is not right.");
  return r.data;
}

/** A real calendar day "YYYY-MM-DD" ("2026-02-30" is not one). */
export function realDay(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  return y >= 1900 && y <= 2200 && mo >= 1 && mo <= 12 && d >= 1 && d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** Write a file so a crash mid-write never leaves half a file behind. */
export function writeAtomic(file: string, data: string | Buffer, mode?: number): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data, mode !== undefined ? { mode } : undefined);
  fs.renameSync(tmp, file);
}
