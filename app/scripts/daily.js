import {
  readdirSync,
  readFileSync,
  rmSync,
  existsSync,
  mkdirSync,
  appendFileSync,
} from "node:fs";
import { resolve, join, sep } from "node:path";
import { runJobs } from "../server/src/jobs.js";
import { backup } from "./backup.js";
import { db } from "../server/src/core.js";
const logDirectory = resolve(".local");
mkdirSync(logDirectory, { recursive: true });
try {
  const jobs = await runJobs(),
    snapshot = await backup(),
    root = resolve("backups");
  const completed = readdirSync(root, { withFileTypes: true })
    .filter(
      (e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}T[0-9.-]+Z$/.test(e.name),
    )
    .map((e) => ({ path: resolve(root, e.name), name: e.name }))
    .filter((e) => {
      const manifest = join(e.path, "manifest.json");
      if (!existsSync(manifest)) return false;
      try {
        const m = JSON.parse(readFileSync(manifest));
        return m.generatedBy === "research-hub-v1" && m.complete;
      } catch {
        return false;
      }
    })
    .sort((a, b) => b.name.localeCompare(a.name));
  for (const old of completed.slice(7)) {
    if (!old.path.startsWith(root + sep) || old.path === root)
      throw new Error("Unsafe retention path");
    rmSync(old.path, { recursive: true, force: false });
  }
  const result = {
    at: new Date().toISOString(),
    status: "passed",
    jobs,
    backup: snapshot,
    retention: 7,
  };
  appendFileSync(
    join(logDirectory, "daily-jobs.jsonl"),
    JSON.stringify(result) + "\n",
  );
  console.log(JSON.stringify(result));
} catch (error) {
  const result = {
    at: new Date().toISOString(),
    status: "failed",
    message:
      "Daily job failed; check database/storage configuration and retry.",
  };
  appendFileSync(
    join(logDirectory, "daily-jobs.jsonl"),
    JSON.stringify(result) + "\n",
  );
  console.error(JSON.stringify(result));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
