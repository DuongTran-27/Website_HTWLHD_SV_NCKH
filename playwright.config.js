import { defineConfig } from "@playwright/test";
import { loadEnvFile } from "node:process";
try {
  loadEnvFile(".env");
} catch {
  /* CI env */
}
export default defineConfig({
  testDir: "app/tests/e2e",
  testMatch: "*.spec.js",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  globalSetup: "./app/tests/e2e/setup.js",
  reporter: [
    ["list"],
    ["json", { outputFile: "app/docs/playwright-results.json" }],
  ],
  use: {
    baseURL: "http://localhost:5174",
    actionTimeout: 10000,
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node --env-file=.env app/tests/e2e/server.js",
      url: "http://localhost:4101/api/v1/health",
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command:
        "node node_modules/vite/bin/vite.js --config app/client/vite.config.js app/client --host 127.0.0.1 --port 5174",
      url: "http://localhost:5174",
      env: { API_PROXY_TARGET: "http://127.0.0.1:4101" },
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
