import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { zipSync, unzipSync } from "fflate";
import { createHash } from "node:crypto";
const files = {};
function add(path) {
  files[path.replaceAll("\\", "/")] = new Uint8Array(readFileSync(path));
}
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (
      [
        "node_modules",
        "dist",
        ".local",
        ".npm-cache",
        "PACKAGE_MANIFEST.json",
      ].includes(entry.name) ||
      (entry.name.startsWith(".env") && entry.name !== ".env.example")
    )
      continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else add(path);
  }
}
walk("app");
for (const name of [
  "README.md",
  "package.json",
  "package-lock.json",
  "eslint.config.js",
  "vitest.config.js",
  "playwright.config.js",
  "vercel.json",
  "render.yaml",
  "compose.yaml",
  ".env.example",
  ".gitignore",
  ".npmrc",
  ".prettierignore",
])
  add(name);
for (const name of readdirSync(".").filter((n) =>
  /^(0[0-6]_.*\.md|PROJECT_REQUIREMENTS_SNAPSHOT\.md|HO_SO_TONG_HOP\.md)$/.test(
    n,
  ),
))
  add(name);
const secret = readFileSync(".env", "utf8")
  .split(/\r?\n/)
  .filter((line) =>
    /^(JWT_SECRET|DEMO_PASSWORD|CLOUDINARY_API_SECRET)=/.test(line),
  )
  .map((line) => line.slice(line.indexOf("=") + 1))
  .filter(Boolean);
for (const [path, bytes] of Object.entries(files)) {
  if (path === "app/scripts/package-source.js") continue;
  const content = Buffer.from(bytes).toString("utf8");
  if (secret.some((value) => value.length >= 12 && content.includes(value)))
    throw new Error(`Secret value found in deliverable: ${path}`);
}
const archive = zipSync(files, { level: 6 });
const entries = Object.keys(unzipSync(archive));
if (entries.some((path) => /(^|\/)\.env$|node_modules|(^|\/)dist\//.test(path)))
  throw new Error("Unsafe archive entry.");
mkdirSync("deliverables", { recursive: true });
const target = "deliverables/research-hub-source-2026-10-22.zip";
writeFileSync(target, archive);
const summary = {
  archive: target,
  entries: entries.length,
  sizeBytes: archive.length,
  sha256: createHash("sha256").update(archive).digest("hex"),
  excludes: [
    ".env",
    "node_modules",
    ".local",
    "backups",
    "dist",
    "test-results",
  ],
};
writeFileSync(
  "app/docs/PACKAGE_MANIFEST.json",
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary));
