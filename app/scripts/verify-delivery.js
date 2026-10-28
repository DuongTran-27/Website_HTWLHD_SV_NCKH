import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { createHash } from "node:crypto";
import { db } from "../server/src/core.js";
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run through npm run verify:delivery.");
const checks = [];
function run(name, args) {
  const started = performance.now(),
    result = spawnSync(process.execPath, [npmCli, ...args], {
      stdio: "inherit",
      env: process.env,
      windowsHide: true,
    });
  checks.push({
    name,
    exitCode: result.status,
    elapsedMs: performance.now() - started,
  });
  if (result.status !== 0) throw new Error(`${name} failed.`);
}
function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}
try {
  run("OpenAPI", ["run", "docs:api"]);
  run("ESLint", ["run", "lint"]);
  run("Vite production build", ["run", "build"]);
  const audit = spawnSync(
    process.execPath,
    [npmCli, "audit", "--json", "--offline=false", "--cache", ".npm-cache"],
    { encoding: "utf8", env: process.env, windowsHide: true },
  );
  const auditResult = JSON.parse(audit.stdout);
  writeFileSync(
    "app/docs/DEPENDENCY_AUDIT.json",
    JSON.stringify(auditResult, null, 2),
  );
  checks.push({
    name: "npm audit",
    exitCode: audit.status,
    vulnerabilities: auditResult.metadata?.vulnerabilities,
  });
  if (audit.status !== 0) throw new Error("Dependency audit requires review.");
  const files = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (["node_modules", "dist"].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(js|jsx|prisma|sql|json|toml|css|ps1)$/.test(path))
        files.push(path);
    }
  }
  for (const root of [
    "app/client/src",
    "app/server/src",
    "app/server/prisma",
    "app/scripts",
    "app/tests",
    "app/shared",
  ])
    if (existsSync(root)) walk(root);
  files.push(
    "package.json",
    "package-lock.json",
    "app/client/package.json",
    "app/server/package.json",
    "app/client/index.html",
    "app/client/vite.config.js",
    "app/server/similarity-thresholds.json",
    "vercel.json",
    "render.yaml",
    "compose.yaml",
    "eslint.config.js",
    "vitest.config.js",
    "playwright.config.js",
    ".env.example",
  );
  const digest = createHash("sha256");
  for (const path of [...new Set(files)].sort()) {
    digest.update(path.replaceAll("\\", "/"));
    digest.update(readFileSync(path));
  }
  const unit = readJson("app/docs/vitest-results.json"),
    e2e = readJson("app/docs/playwright-results.json"),
    tables =
      await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' ORDER BY tablename`,
    schema = readJson("app/docs/openapi.json");
  const report = {
    at: new Date().toISOString(),
    sourceVersion: `sha256:${digest.digest("hex")}`,
    gitCommit: null,
    node: process.version,
    checks,
    unit: {
      total: unit.numTotalTests,
      passed: unit.numPassedTests,
      failed: unit.numFailedTests,
    },
    browser: e2e.stats,
    database: {
      tables: tables.length,
      names: tables.map((t) => t.tablename),
      migrationFiles: readdirSync("app/server/prisma/migrations").filter((n) =>
        /^\d/.test(n),
      ).length,
    },
    apiOperations: Object.values(schema.paths).reduce(
      (n, p) => n + Object.keys(p).length,
      0,
    ),
    externalVerification: readJson("app/docs/CLOUDINARY_RESULTS.json"),
    restore: readJson("app/docs/RESTORE_RESULTS.json"),
    limitations: [
      "Cloudinary live 20 MB/download expiry/content restore not verified without credentials.",
      "Vercel/Render/Supabase deployment not performed.",
      "Similarity labels are synthetic; academic accuracy remains unverified.",
    ],
  };
  if (report.unit.failed || report.browser.unexpected || report.browser.skipped)
    throw new Error("Stored test reports are not all passing.");
  writeFileSync("app/docs/QA_RESULTS.json", JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      sourceVersion: report.sourceVersion,
      tables: tables.length,
      apiOperations: report.apiOperations,
      unit: report.unit,
      browser: report.browser,
    }),
  );
} finally {
  await db.$disconnect();
}
