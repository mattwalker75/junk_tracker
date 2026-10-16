/** A scratch Junk Tracker per test: its own config.json and database in a temp folder, on a spare port. */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import { createApp, type AppHandle } from "../server/src/app.js";
import { Config } from "../server/src/config.js";

export interface Scratch {
  dir: string;
  handle: AppHandle;
  url: string;
  /** a browser: keeps its own cookie */
  browser(): Browser;
  close(): Promise<void>;
}

export interface Browser {
  call(method: string, p: string, body?: unknown, headers?: Record<string, string>): Promise<{ status: number; body: any }>;
}

export async function scratch(config: Record<string, unknown> = {}): Promise<Scratch> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jt-test-"));
  const file = path.join(dir, "config.json");
  fs.writeFileSync(file, JSON.stringify({ database: { path: "./data/junk.db" }, ...config }));
  const handle = createApp(new Config(file), { rateLimit: false, webDir: path.join(dir, "no-web") });
  const server: Server = await new Promise((resolve) => { const s = handle.app.listen(0, "127.0.0.1", () => resolve(s)); });
  const port = (server.address() as { port: number }).port;
  const url = `http://127.0.0.1:${port}`;
  const browser = (): Browser => {
    let cookie = "";
    return {
      // node:http rather than fetch: fetch will not send a Host header of our choosing (the host check tests need one)
      call(method, p, body, headers = {}) {
        const data = body !== undefined ? JSON.stringify(body) : undefined;
        return new Promise((resolve, reject) => {
          const req = http.request(url + p, {
            method,
            headers: { ...(data !== undefined ? { "content-type": "application/json", "content-length": Buffer.byteLength(data) } : {}), ...(cookie ? { cookie } : {}), ...headers },
          }, (res) => {
            const set = res.headers["set-cookie"] || [];
            if (set.length) {
              const jar = new Map(cookie.split("; ").filter(Boolean).map((c) => [c.split("=")[0], c]));
              for (const c of set) { const kv = c.split(";")[0]; jar.set(kv.split("=")[0], kv); }
              cookie = [...jar.values()].join("; ");
            }
            let text = "";
            res.setEncoding("utf8");
            res.on("data", (c) => { text += c; });
            res.on("end", () => { let parsed: unknown = text; try { parsed = JSON.parse(text); } catch {} resolve({ status: res.statusCode || 0, body: parsed }); });
          });
          req.on("error", reject);
          if (data !== undefined) req.write(data);
          req.end();
        });
      },
    };
  };
  return {
    dir, handle, url, browser,
    async close() { await new Promise((r) => server.close(() => r(null))); handle.db.close(); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}

export const PW = "correct-horse";
