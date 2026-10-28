import { Client } from "pg";
import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";
export default async function setup() {
  const adminUrl = new URL(process.env.DATABASE_URL);
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  if (
    !(await admin.query("SELECT 1 FROM pg_database WHERE datname='nckh_e2e'"))
      .rowCount
  )
    await admin.query("CREATE DATABASE nckh_e2e");
  await admin.end();
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = "/nckh_e2e";
  const env = {
    ...process.env,
    DATABASE_URL: url.toString(),
    MIGRATION_DATABASE_URL: url.toString(),
    NODE_ENV: "test",
  };
  const migrate = spawnSync(
    process.execPath,
    ["app/scripts/prisma.js", "migrate", "deploy"],
    { stdio: "inherit", env },
  );
  if (migrate.status) throw new Error("E2E migration failed");
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const tables =
    await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations'`;
  if (tables.length)
    await db.$executeRawUnsafe(
      "TRUNCATE " +
        tables.map((t) => `"${t.tablename}"`).join(",") +
        " CASCADE",
    );
  await db.$disconnect();
  const seed = spawnSync(process.execPath, ["app/server/prisma/seed.js"], {
    stdio: "inherit",
    env,
  });
  if (seed.status) throw new Error("E2E seed failed");
}
