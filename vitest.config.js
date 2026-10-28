import { defineConfig } from "vitest/config";
import { loadEnvFile } from "node:process";
try {
  loadEnvFile(".env");
} catch {
  /* CI supplies environment */
}
const url = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);
url.pathname = "/nckh_test";
process.env.DATABASE_URL = url.toString();
process.env.MIGRATION_DATABASE_URL = url.toString();
process.env.NODE_ENV = "test";
process.env.APP_ORIGIN = "http://localhost:5173";
export default defineConfig({
  test: {
    include: ["app/tests/**/*.test.js"],
    fileParallelism: false,
    pool: "forks",
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 60000,
    globalSetup: ["./app/tests/setup.js"],
    reporters: ["default", "json"],
    outputFile: { json: "app/docs/vitest-results.json" },
  },
});
