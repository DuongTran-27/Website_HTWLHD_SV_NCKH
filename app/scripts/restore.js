import { readFileSync, existsSync } from "node:fs";
import { resolve, join, sep, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { pgCommand } from "./backup.js";
import { hash, db } from "../server/src/core.js";
import { cloudStorage } from "../server/src/files.js";
export async function restore(
  directory,
  targetUrl,
  { allowEmptyFiles = false } = {},
) {
  const destination = new URL(targetUrl);
  if (!destination.pathname.endsWith("_restore"))
    throw new Error(
      "Restore only targets a dedicated database ending in _restore. Never restore over production.",
    );
  const root = resolve(directory),
    manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
  if (!manifest.complete || manifest.version !== 1)
    throw new Error("Incomplete or unsupported backup.");
  const dump = join(root, "database.dump");
  if (hash(readFileSync(dump)) !== manifest.databaseSha256)
    throw new Error("Database backup checksum mismatch.");
  for (const file of [...manifest.files, ...(manifest.avatars ?? [])]) {
    const filePath = resolve(root, file.relativePath);
    if (!filePath.startsWith(root + sep) || !existsSync(filePath))
      throw new Error("Invalid backup file path.");
    const bytes = readFileSync(filePath);
    if (hash(bytes) !== file.sha256 || bytes.length !== file.sizeBytes)
      throw new Error("File checksum mismatch.");
  }
  // A full restore never silently falls back to metadata only.
  if (!manifest.files.length && !manifest.avatars?.length && !allowEmptyFiles)
    throw new Error(
      "No document content in backup. Pass --allow-empty-files only to verify a database without documents.",
    );
  const client = new PrismaClient({ datasources: { db: { url: targetUrl } } });
  try {
    const tables =
      await client.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
    if (tables.length)
      throw new Error(
        "Restore target must be an empty database. Create a new *_restore database.",
      );
    pgCommand(
      "pg_restore",
      [
        "--no-owner",
        "--no-privileges",
        "--exit-on-error",
        "--dbname",
        destination.pathname.slice(1),
        dump,
      ],
      targetUrl,
    );
    for (const file of manifest.files) {
      const bytes = readFileSync(resolve(root, file.relativePath)),
        publicId = `nckh-restore/${randomUUID()}${file.resourceType === "raw" ? extname(file.originalName) : ""}`;
      const result = await cloudStorage.upload(bytes, {
        public_id: publicId,
        resource_type: file.resourceType,
      });
      if (result.bytes !== file.sizeBytes)
        throw new Error("Restored asset size mismatch.");
      await client.attachment.update({
        where: { id: file.attachmentId },
        data: { publicId: result.public_id, assetId: result.asset_id },
      });
      const current = await client.attachment.findUnique({
          where: { id: file.attachmentId },
        }),
        response = await fetch(cloudStorage.download(current));
      if (
        !response.ok ||
        hash(Buffer.from(await response.arrayBuffer())) !== file.sha256
      )
        throw new Error("Restored file download verification failed.");
    }
    for (const avatar of manifest.avatars ?? []) {
      const bytes = readFileSync(resolve(root, avatar.relativePath)),
        result = await cloudStorage.uploadPublicImage(
          bytes,
          `nckh-restore-avatars/${randomUUID()}`,
        );
      await client.user.update({
        where: { id: avatar.userId },
        data: {
          avatarAssetId: result.asset_id,
          avatarPublicId: result.public_id,
          avatarUrl: result.secure_url,
        },
      });
      const response = await fetch(result.secure_url);
      if (
        !response.ok ||
        hash(Buffer.from(await response.arrayBuffer())) !== avatar.sha256
      )
        throw new Error("Restored avatar download verification failed.");
    }
    const counts = {
      topics: await client.topic.count(),
      revisions: await client.topicRevision.count(),
      attachments: await client.attachment.count(),
    };
    return {
      targetDatabase: destination.pathname.slice(1),
      restoredFiles: manifest.files.length,
      restoredAvatars: manifest.avatars?.length ?? 0,
      counts,
      complete: true,
    };
  } finally {
    await client.$disconnect();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const directory = process.argv[2],
      target = process.env.RESTORE_DATABASE_URL;
    if (!directory || !target)
      throw new Error(
        "Usage: npm run restore -- <backup-directory> [--allow-empty-files], with RESTORE_DATABASE_URL pointing to an empty *_restore database.",
      );
    console.log(
      JSON.stringify(
        await restore(directory, target, {
          allowEmptyFiles: process.argv.includes("--allow-empty-files"),
        }),
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
