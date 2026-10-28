import { spawnSync } from "node:child_process";
import { loadEnvFile } from "node:process";
try {
  loadEnvFile(".env");
} catch {
  /* deployment injects env */
}
const result = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    ...process.argv.slice(2),
    "--schema",
    "app/server/prisma/schema.prisma",
  ],
  { stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
