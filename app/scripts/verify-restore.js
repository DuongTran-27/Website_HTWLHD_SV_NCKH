import { writeFileSync } from "node:fs";
import { backup } from "./backup.js";
import { restore } from "./restore.js";
import { db } from "../server/src/core.js";
import { Client } from "pg";
try {
  const snapshot = await backup(".local/restore-proof-backup"),
    url = new URL(process.env.DATABASE_URL),
    databaseName = `nckh_verify_${Date.now()}_restore`,
    adminUrl = new URL(
      process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL,
    );
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  await admin.end();
  url.pathname = "/" + databaseName;
  const result = await restore(snapshot.directory, url.toString(), {
    allowEmptyFiles: true,
  });
  const report = {
    at: new Date().toISOString(),
    databaseBackupRestore: result,
    limitation:
      "Local demo currently has no real Cloudinary documents. This verifies PostgreSQL restore only. Full private document content restore awaits Cloudinary credentials.",
  };
  writeFileSync(
    "app/docs/RESTORE_RESULTS.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await db.$disconnect();
}
