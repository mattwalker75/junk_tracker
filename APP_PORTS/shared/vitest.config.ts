import { defineConfig } from "vitest/config";

// The phone apps' own tests (the web app's are in test/ at the top): `npx vitest run --config APP_PORTS/shared/vitest.config.ts`
export default defineConfig({
  root: import.meta.dirname,
  test: { include: ["test/**/*.test.ts"], environment: "node", testTimeout: 30000 },
});
