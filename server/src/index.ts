/**
 * Start Junk Tracker: read config.json, open the database, listen.
 * By default only this computer can connect (127.0.0.1); Settings → Network → "Allow other devices
 * on my network" listens on every interface instead (after a restart).
 */
import { createApp, VERSION } from "./app.js";
import { Config } from "./config.js";
import { networkUrls } from "./security.js";

const config = new Config();
const { app, db } = createApp(config);
const c = config.get();
const port = Number(process.env.PORT) || c.server.port;
const host = c.server.allowNetwork ? "0.0.0.0" : "127.0.0.1";

const server = app.listen(port, host, () => {
  console.log(`Junk Tracker ${VERSION} — http://localhost:${port}`);
  if (c.server.allowNetwork) for (const u of networkUrls(port)) console.log(`  on your network: ${u}`);
  console.log(`  config:   ${config.file}`);
  console.log(`  database: ${config.resolve(c.database.path)}`);
  console.log(`  login:    ${c.security.loginEnabled ? "on" : "off"}`);
});
server.on("error", (e: NodeJS.ErrnoException) => {
  console.error(e.code === "EADDRINUSE" ? `Port ${port} is already in use — is Junk Tracker already running? (./TRACKER.sh --status)` : e.message);
  process.exit(1);
});

function shutdown(signal: string) {
  console.log(`\n${signal} — shutting down…`);
  server.close();
  try { db.close(); } catch {}
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (e) => console.error("[unhandled]", e));
