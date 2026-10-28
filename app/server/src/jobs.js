import { pathToFileURL } from "node:url";
import { db, transaction, notify, audit, audience } from "./core.js";
import { cloudStorage, configureCloud } from "./files.js";

export async function reminders(now = new Date()) {
  return transaction(async (tx) => {
    let created = 0;
    const topics = await tx.topic.findMany({
      where: { status: { in: ["approved", "in_progress"] } },
    });
    const milestones = await tx.milestone.findMany({
      where: {
        topicId: { in: topics.map((t) => t.id) },
        deadline: { lte: new Date(now.getTime() + 3 * 86400000) },
      },
    });
    for (const m of milestones) {
      const topic = topics.find((t) => t.id === m.topicId);
      const sub = await tx.submission.findFirst({
        where: { milestoneId: m.id },
        orderBy: { version: "desc" },
      });
      if (sub?.status === "accepted" && !m.resubmissionAllowed) continue;
      const kind = m.deadline < now ? "overdue" : "upcoming",
        key = `deadline:${m.id}:v${m.deadlineVersion}:${m.deadline.toISOString()}:${kind}`;
      const recipients = await audience(tx, topic),
        before = await tx.notification.count({ where: { eventKey: key } });
      await notify(
        tx,
        recipients,
        "deadline",
        kind === "overdue"
          ? "Mốc nghiên cứu đã quá hạn"
          : "Mốc nghiên cứu sắp đến hạn",
        `${m.name} · ${topic.code}`,
        topic,
        key,
      );
      created +=
        (await tx.notification.count({ where: { eventKey: key } })) - before;
    }
    await tx.teamInvitation.updateMany({
      where: { status: "pending", expiresAt: { lte: now } },
      data: { status: "expired", respondedAt: now, revision: { increment: 1 } },
    });
    await tx.supervisionRequest.updateMany({
      where: { status: "pending", expiresAt: { lte: now } },
      data: { status: "expired", respondedAt: now, revision: { increment: 1 } },
    });
    await tx.idempotencyRecord.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return { notificationsCreated: created };
  });
}
export async function cleanup(now = new Date()) {
  const cutoff = new Date(now.getTime() - 86400000),
    candidates = await db.attachment.findMany({
      // Ready files may still be waiting for submit; only unfinished uploads expire.
      where: {
        createdAt: { lt: cutoff },
        status: { in: ["pending", "failed"] },
      },
      take: 100,
    });
  let deleted = 0;
  for (const file of candidates) {
    const pending = await transaction(async (tx) => {
      const current = await tx.attachment.findUnique({
        where: { id: file.id },
      });
      if (!current) return;
      if (
        (await tx.topicRevisionFile.count({
          where: { attachmentId: file.id },
        })) ||
        (await tx.submissionFile.count({ where: { attachmentId: file.id } }))
      )
        return;
      return tx.attachment.update({
        where: { id: file.id },
        data: { status: "failed", errorCode: "CLEANUP_PENDING" },
      });
    });
    if (!pending) continue;
    const result = await cloudStorage.destroy(pending);
    if (!["ok", "not found"].includes(result.result))
      throw new Error("Cloudinary cleanup failed");
    await transaction(async (tx) => {
      await tx.attachment.delete({ where: { id: pending.id } });
      await audit(
        tx,
        null,
        "attachment.orphan_deleted",
        "topic",
        { id: pending.topicId },
        null,
        { afterData: { attachmentId: pending.id } },
      );
    });
    deleted++;
  }
  // Reconcile remote assets whose upload succeeded while the database update failed.
  const cloud = configureCloud();
  for (const resourceType of ["raw", "image"]) {
    let cursor;
    do {
      const page = await cloud.api.resources({
        resource_type: resourceType,
        type: "authenticated",
        prefix: "nckh/",
        max_results: 100,
        next_cursor: cursor,
      });
      for (const asset of page.resources) {
        if (new Date(asset.created_at) >= cutoff) continue;
        await transaction(async (tx) => {
          if (
            await tx.attachment.count({
              where: {
                OR: [
                  { publicId: asset.public_id },
                  { assetId: asset.asset_id },
                ],
              },
            })
          )
            return;
          const result = await cloudStorage.destroy({
            publicId: asset.public_id,
            resourceType,
            deliveryType: "authenticated",
          });
          if (["ok", "not found"].includes(result.result)) deleted++;
        });
      }
      cursor = page.next_cursor;
    } while (cursor);
  }
  let avatarCursor;
  do {
    const page = await cloud.api.resources({
      resource_type: "image",
      type: "upload",
      prefix: "nckh-avatars/",
      max_results: 100,
      next_cursor: avatarCursor,
    });
    for (const asset of page.resources) {
      if (new Date(asset.created_at) >= cutoff) continue;
      await transaction(async (tx) => {
        if (await tx.user.count({ where: { avatarPublicId: asset.public_id } }))
          return;
        await cloudStorage.destroy({
          publicId: asset.public_id,
          resourceType: "image",
          deliveryType: "upload",
        });
        deleted++;
      });
    }
    avatarCursor = page.next_cursor;
  } while (avatarCursor);
  return { orphanAssetsDeleted: deleted };
}
export async function runJobs() {
  const result = { reminders: await reminders() };
  if (process.env.CLOUDINARY_CLOUD_NAME) result.cleanup = await cleanup();
  else result.cleanup = { skipped: "Cloudinary not configured" };
  return result;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(JSON.stringify(await runJobs()));
  } catch {
    console.error("Background job failed; retry is safe.");
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
