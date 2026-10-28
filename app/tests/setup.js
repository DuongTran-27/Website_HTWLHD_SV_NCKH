import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
export default async function setup() {
  if (!new URL(process.env.DATABASE_URL).pathname.endsWith("_test"))
    throw new Error("Tests require a dedicated *_test database.");
  const result = spawnSync(
    process.execPath,
    ["app/scripts/prisma.js", "migrate", "deploy"],
    { stdio: "inherit", env: process.env },
  );
  if (result.status) throw new Error("Test migration failed.");
  const db = new PrismaClient();
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
    env: process.env,
  });
  if (seed.status) throw new Error("Test seed failed.");
}
