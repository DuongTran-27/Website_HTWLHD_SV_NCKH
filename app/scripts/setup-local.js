import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
mkdirSync(".local", { recursive: true });
if (!existsSync(".env")) {
  let env = readFileSync(".env.example", "utf8");
  env = env
    .replaceAll("CHANGE_ME", randomBytes(24).toString("hex"))
    .replace(
      "REPLACE_WITH_AT_LEAST_32_RANDOM_BYTES",
      randomBytes(48).toString("hex"),
    )
    .replace(
      "DEMO_PASSWORD=",
      "DEMO_PASSWORD=" + randomBytes(18).toString("base64url"),
    );
  writeFileSync(".env", env, { mode: 0o600 });
}
process.loadEnvFile(".env");
if (process.argv.includes("--env-only")) {
  console.log("Local environment ready. Secrets are only in .env.");
  process.exit(0);
}
const { Client } = await import("pg");
const adminUrl = new URL(process.env.DATABASE_URL);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const db = new Client({ connectionString: adminUrl.toString() });
await db.connect();
for (const name of ["nckh", "nckh_test", "nckh_bench", "nckh_restore"]) {
  if (
    !(await db.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]))
      .rowCount
  )
    await db.query(`CREATE DATABASE "${name}"`);
}
await db.end();
for (const args of [
  ["app/scripts/prisma.js", "migrate", "deploy"],
  ["app/server/prisma/seed.js"],
]) {
  const run = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });
  if (run.status) process.exit(run.status);
}
console.log(
  "Local database ready. Demo account names: student1, lecturer1, staff, admin @demo.test. Password is in .env (DEMO_PASSWORD).",
);
