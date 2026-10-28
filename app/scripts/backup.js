import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, chmodSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { db, hash } from "../server/src/core.js";
import { cloudStorage } from "../server/src/files.js";
export function pgEnvironment(url) {
  const connection = new URL(url);
  return {
    ...process.env,
    PGHOST: connection.hostname,
    PGPORT: connection.port || "5432",
    PGUSER: decodeURIComponent(connection.username),
    PGPASSWORD: decodeURIComponent(connection.password),
    PGDATABASE: connection.pathname.slice(1),
    PGSSLMODE:
      connection.searchParams.get("sslmode") ??
      (connection.hostname === "127.0.0.1" ||
      connection.hostname === "localhost"
        ? "prefer"
        : "require"),
  };
}
export function pgCommand(name, args, url) {
  const bin = process.env.PG_BIN
    ? join(
        resolve(process.env.PG_BIN),
        `${name}${process.platform === "win32" ? ".exe" : ""}`,
      )
    : name;
  const result = spawnSync(bin, args, {
    env: pgEnvironment(url),
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error(
      `${name} failed. Check PostgreSQL binary version and database permissions; credentials are not printed.`,
    );
}
export async function backup(output) {
  const directory = resolve(
    output ?? join("backups", new Date().toISOString().replaceAll(":", "-")),
  );
  mkdirSync(join(directory, "files"), { recursive: true, mode: 0o700 });
  if (process.platform === "win32") {
    const account = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
    const acl = spawnSync(
      "icacls",
      [
        directory,
        "/inheritance:r",
        "/grant:r",
        `${account}:(OI)(CI)F`,
        "*S-1-5-18:(OI)(CI)F",
      ],
      { encoding: "utf8", windowsHide: true },
    );
    if (acl.status !== 0)
      throw new Error(
        "Unable to restrict backup folder permissions. No database dump was written.",
      );
  }
  // Hold the business write lock while taking the dump and manifest, so rows and file inventory agree.
  let files, avatars;
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(72654001)`;
      pgCommand(
        "pg_dump",
        ["--format=custom", "--file", join(directory, "database.dump")],
        process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL,
      );
      files = await tx.attachment.findMany({ where: { status: "ready" } });
      avatars = await tx.user.findMany({
        where: { avatarUrl: { not: null } },
        select: { id: true, avatarUrl: true },
      });
    },
    { timeout: 60000, maxWait: 15000 },
  );
  const manifest = {
    version: 1,
    generatedBy: "research-hub-v1",
    createdAt: new Date().toISOString(),
    databaseFile: "database.dump",
    databaseSha256: hash(readFileSync(join(directory, "database.dump"))),
    files: [],
    avatars: [],
    complete: false,
  };
  writeFileSync(
    join(directory, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    { mode: 0o600 },
  );
  for (const file of files) {
    const url = cloudStorage.download(file),
      res = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!res.ok)
      throw new Error(
        "Private file backup download failed. Backup remains incomplete.",
      );
    const buffer = Buffer.from(await res.arrayBuffer());
    if (hash(buffer) !== file.sha256 || buffer.length !== file.sizeBytes)
      throw new Error("File backup checksum mismatch.");
    writeFileSync(join(directory, "files", file.id), buffer, { mode: 0o600 });
    manifest.files.push({
      attachmentId: file.id,
      relativePath: `files/${file.id}`,
      sha256: file.sha256,
      sizeBytes: file.sizeBytes,
      publicId: file.publicId,
      resourceType: file.resourceType,
      originalName: file.originalName,
    });
    writeFileSync(
      join(directory, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      { mode: 0o600 },
    );
  }
  for (const avatar of avatars) {
    const response = await fetch(avatar.avatarUrl, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error("Avatar backup download failed.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 5000000)
      throw new Error("Avatar backup exceeds configured limit.");
    const relativePath = `files/avatar-${avatar.id}`;
    writeFileSync(join(directory, relativePath), bytes, { mode: 0o600 });
    manifest.avatars.push({
      userId: avatar.id,
      relativePath,
      sha256: hash(bytes),
      sizeBytes: bytes.length,
    });
  }
  manifest.complete = true;
  writeFileSync(
    join(directory, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    { mode: 0o600 },
  );
  return {
    directory,
    fileCount: files.length,
    avatarCount: avatars.length,
    complete: true,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(JSON.stringify(await backup(process.argv[2])));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
