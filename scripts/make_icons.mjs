#!/usr/bin/env node
/**
 * Make every app icon file from ONE drawing (Docs/icon/icon.svg, a full square — phones round the corners).
 *
 *   node scripts/make_icons.mjs                 # from Docs/icon/icon.svg
 *   node scripts/make_icons.mjs Docs/icon/options/07-hero-shield.svg   # try another; copies it to Docs/icon/icon.svg
 *
 * Writes (all committed, so `git pull` brings them — nothing to run on the computer the app is on):
 *   web/public/apple-touch-icon.png  180  iPhone / iPad "Add to Home Screen"
 *   web/public/icon-192.png          192  Android home screen (manifest)
 *   web/public/icon-512.png          512  Android splash, Play Store size
 *   web/public/icon-maskable-512.png 512  Android icons cut to a circle / squircle: the picture inside the safe zone
 *   web/public/icon.svg                   the browser tab (rounded corners)
 *   Docs/icon/icon-1024.png         1024  the master for a future iPhone / Android app (App Store size)
 *   …and the same files copied into the phone apps (app_ports/): the iPhone app's icon (1024) and the
 *   Android app's launcher picture (512)
 *
 * Draws with Google Chrome (headless), already on this Mac; no packages needed. Set CHROME=<path> for another.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MASTER = path.join(ROOT, "Docs/icon/icon.svg");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const from = process.argv[2] ? path.resolve(process.argv[2]) : MASTER;
if (!fs.existsSync(from)) { console.error(`No drawing at ${from}`); process.exit(1); }
if (!fs.existsSync(CHROME)) { console.error(`Google Chrome is needed to draw the icons (looked at ${CHROME}; set CHROME=<path>).`); process.exit(1); }
const svg = fs.readFileSync(from, "utf8");
if (!/viewBox="0 0 (\d+) \1"/.test(svg)) { console.error("The drawing must be a square SVG (viewBox=\"0 0 N N\")."); process.exit(1); }
if (from !== MASTER) fs.copyFileSync(from, MASTER);

// the background colour = the first full-size rect, for the maskable icon's margin
const bg = /<rect width="\d+" height="\d+" fill="(#[0-9a-fA-F]{3,8})"/.exec(svg)?.[1] ?? "#ffffff";
const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const page = (inner, size) => `data:text/html;base64,${Buffer.from(`<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;overflow:hidden;background:${bg}">${inner}</body></html>`).toString("base64")}`;
const full = (size) => page(`<img src="${src}" style="display:block;width:${size}px;height:${size}px">`, size);
// Android's maskable safe zone is the middle circle 80% across: the whole drawing goes inside it
const masked = (size) => page(`<img src="${src}" style="display:block;width:${size * 0.8}px;height:${size * 0.8}px;margin:${size * 0.1}px">`, size);

const OUT = [
  ["web/public/apple-touch-icon.png", 180, full],
  ["web/public/icon-192.png", 192, full],
  ["web/public/icon-512.png", 512, full],
  ["web/public/icon-maskable-512.png", 512, masked],
  ["Docs/icon/icon-1024.png", 1024, full],
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cc-icons-"));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${tmp}`, "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const done = (code) => {
  chrome.kill();
  // only ever the folder made above
  if (path.basename(tmp).startsWith("cc-icons-") && path.dirname(tmp) === path.resolve(os.tmpdir())) {
    setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} process.exit(code); }, 300);
  } else process.exit(code);
};

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try { target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json(); }
    catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  if (!target) throw new Error("Chrome did not start.");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
  let id = 0; const wait = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable");
  for (const [file, size, how] of OUT) {
    await send("Emulation.setDeviceMetricsOverride", { width: size, height: size, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: how(size) });
    for (let i = 0; i < 50; i++) {
      const r = await send("Runtime.evaluate", { expression: "(() => { const i = document.querySelector('img'); return !!(i && i.complete && i.naturalWidth) })()", returnByValue: true });
      if (r.result?.result?.value) break;
      await new Promise((res) => setTimeout(res, 100));
    }
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
    fs.writeFileSync(path.join(ROOT, file), Buffer.from(shot.result.data, "base64"));
    console.log(`${file}  ${size}×${size}`);
  }
  ws.close();

  // the browser tab: the same drawing with rounded corners
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const n = /viewBox="0 0 (\d+)/.exec(svg)[1];
  fs.writeFileSync(path.join(ROOT, "web/public/icon.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}"><defs><clipPath id="cc-round"><rect width="${n}" height="${n}" rx="${Math.round(n * 0.22)}"/></clipPath></defs><g clip-path="url(#cc-round)">${inner}</g></svg>\n`);
  console.log("web/public/icon.svg  (rounded, for the browser tab)");

  // the phone apps (app_ports/) use the same pictures
  for (const [from, to] of [
    ["Docs/icon/icon-1024.png", "app_ports/ios/CravingCrusher/Assets.xcassets/AppIcon.appiconset/icon-1024.png"],
    ["web/public/icon-512.png", "app_ports/android/app/src/main/res/drawable-nodpi/cc_icon.png"],
  ]) {
    fs.mkdirSync(path.dirname(path.join(ROOT, to)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, from), path.join(ROOT, to));
    console.log(`${to}  (copy of ${from})`);
  }
  done(0);
} catch (e) {
  console.error(e.message || e);
  done(1);
}
