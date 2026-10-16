import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, existsSync } from "node:fs";

// In dev (`./TRACKER.sh --dev`) Vite serves the page with live reload and forwards /api to the server
// on the port in config.json.
function serverPort(): number {
  try {
    const file = process.env.JT_CONFIG || "config.json";
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")).server?.port || 8420;
  } catch {}
  return 8420;
}

export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../dist/web", emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: { port: 5173, proxy: { "/api": { target: `http://127.0.0.1:${serverPort()}`, changeOrigin: false } } },
});
