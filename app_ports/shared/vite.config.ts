/**
 * Builds the page the phone apps carry: the web app's page (web/, unchanged) with boot.ts in front of it,
 * which answers its /api requests inside the app (backend.ts). Run by ios/BUILD_APP.sh and
 * android/BUILD_APP.sh:
 *
 *   CC_PHONE_OUT=<folder> node_modules/.bin/vite build --config app_ports/shared/vite.config.ts
 */
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const BOOT = path.join(here, "src/boot.ts");
const version: string = JSON.parse(readFileSync(path.join(repo, "package.json"), "utf8")).version;
const out = process.env.CC_PHONE_OUT ? path.resolve(process.env.CC_PHONE_OUT) : path.join(here, "dist");

/** the web app's index.html, starting at boot.ts instead of main.tsx (boot.ts loads main.tsx itself) */
const phonePage = (): Plugin => ({
  name: "craving-crusher-phone",
  transformIndexHtml: {
    order: "pre",
    handler(html) {
      if (!html.includes('src="/src/main.tsx"')) throw new Error("web/index.html no longer starts at /src/main.tsx — update app_ports/shared/vite.config.ts.");
      // a home-screen manifest means nothing inside an installed app
      return html.replace('src="/src/main.tsx"', 'src="/@cc-phone/boot"').replace(/\s*<link rel="manifest"[^>]*>/, "");
    },
  },
  resolveId(id) { return id === "/@cc-phone/boot" ? BOOT : null; },
});

export default defineConfig({
  root: path.join(repo, "web"),
  plugins: [phonePage(), react(), tailwindcss()],
  define: {
    __CC_VERSION__: JSON.stringify(version),
    "import.meta.env.VITE_CC_PHONE": JSON.stringify("1"),
  },
  resolve: {
    alias: [
      { find: /^node:crypto$/, replacement: path.join(here, "src/shims/crypto.ts") },
      { find: /^node:fs$/, replacement: path.join(here, "src/shims/fs.ts") },
      { find: /^node:path$/, replacement: path.join(here, "src/shims/path.ts") },
    ],
  },
  build: { outDir: out, emptyOutDir: true, target: ["es2022", "safari16"], chunkSizeWarningLimit: 1200 },
  logLevel: "warn",
});
