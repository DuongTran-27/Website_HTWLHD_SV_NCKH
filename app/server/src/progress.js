import { Router } from "express";
import { z } from "zod";
import { read, write } from "./routes.js";
import {
  ensure,
  found,
  uid,
  revision,
  reason,
  checkRevision,
  checkState,
  event,
  audit,
  paged,
} from "./core.js";
import {
  topicAccess,
  access,
  currentStudent,
  staffFor,
  lecturerFor,
  closeTeam,
  temporalWhere,
} from "./permissions.js";
import { milestoneTemplate } from "./admin.js";
import { readyForEvaluation } from "./topics.js";
import { publishCorpus } from "./similarity.js";
export const progressRouter = Router();

async function visibleSubmissions(tx, user, topic, milestoneId) {
  const rows = await tx.submission.findMany({
      where: { milestoneId },
      orderBy: { version: "desc" },
    }),
    visible = [];
  for (const row of rows)
    if (await access(tx, user, topic, row.submittedAt)) {
      const links = await tx.submissionFile.findMany({
          where: { submissionId: row.id },
        }),
        reviews = await tx.review.findMany({
          where: { submissionId: row.id },
          orderBy: { createdAt: "desc" },
        }),
        allowedReviews = [];
      for (const review of reviews)
        if (await access(tx, user, topic, review.createdAt))
          allowedReviews.push(review);
      visible.push({
        ...row,
        files: await tx.attachment.findMany({
          where: { id: { in: links.map((l) => l.attachmentId) } },
          select: {
            id: true,
            originalName: true,
            sizeBytes: true,
            mimeType: true,
            status: true,
          },
        }),
        reviews: allowedReviews,
      });
    }
  return visible;
}
read(progressRouter, "/topics/:id/milestones", async (req, tx) => {
  const topic = await topicAccess(tx, req.user, req.params.id),
    rows = await tx.milestone.findMany({
      where: { topicId: topic.id },
      orderBy: { sortOrder: "asc" },
    });
  const visible = [];
  for (const m of rows) {
    if (
      topic.accessMode === "historical" &&
      !(await access(tx, req.user, topic, m.createdAt))
    )
      continue;
    const subs = await visibleSubmissions(tx, req.user, topic, m.id);
    visible.push({
      ...m,
      ...(topic.accessMode === "historical"
        ? { deadline: undefined, resubmissionAllowed: undefined }
        : {}),
      submissions: subs,
      currentSubmission: subs[0] ?? null,
    });
  }
  return visible;
});
write(
  progressRouter,
  "post",
  "/topics/:id/milestones",
  milestoneTemplate.extend({ revision }).strict(),
  async (req, tx) => {
    const topic = await topicAccess(tx, req.user, req.params.id);
    await staffFor(tx, req.user, topic);
    checkRevision(topic, req.body.revision);
    checkState(topic, ["approved", "in_progress"]);
    const { revision: _, ...data } = req.body;
    const row = await tx.milestone.create({
      data: { ...data, deadline: new Date(data.deadline), topicId: topic.id },
    });
    await tx.topic.update({
      where: { id: topic.id },
      data: { revision: { increment: 1 } },
    });
    await event(tx, req.user, "milestone.created", topic, req, {
      afterData: { milestoneId: row.id },
    });
    return row;
  },
  { status: 201 },
);
write(
  progressRouter,
  "patch",
  "/milestones/:id",
  z
    .object({
      revision,
      name: z.string().min(2).max(200).optional(),
      deadline: z.iso.datetime().optional(),
      required: z.boolean().optional(),
      expectedOutput: z.string().min(10).max(2000).optional(),
      sortOrder: z.number().int().min(0).max(100).optional(),
      reason,
    })
    .strict(),
  async (req, tx) => {
    const row = await found("milestone", req.params.id, tx),
      topic = await topicAccess(tx, req.user, row.topicId);
    await staffFor(tx, req.user, topic);
    checkRevision(row, req.body.revision);
    checkState(topic, ["approved", "in_progress"]);
    const { revision: _, reason: why, ...data } = req.body;
    const result = await tx.milestone.update({
      where: { id: row.id },
      data: {
        ...data,
        ...(data.deadline ? { deadline: new Date(data.deadline) } : {}),
        revision: { increment: 1 },
      },
    });
    if (data.required === false && row.required)
      ensure(
        (await tx.milestone.count({
          where: { topicId: topic.id, required: true },
        })) >= 3,
        422,
        "REQUIRED_MILESTONES",
        "Cần giữ ít nhất ba mốc bắt buộc.",
      );
    await tx.topic.update({
      where: { id: topic.id },
      data: { revision: { increment: 1 } },
    });
    await event(tx, req.user, "milestone.updated", topic, req, {
      reason: why,
      beforeData: { deadline: row.deadline.toISOString() },
      afterData: {
        deadline: result.deadline.toISOString(),
        milestoneId: row.id,
      },
    });
    return result;
  },
);
write(
  progressRouter,
  "post",
  "/milestones/:id/reopen",
  z.object({ revision, reason }).strict(),
  async (req, tx) => {
    const row = await found("milestone", req.params.id, tx),
      topic = await topicAccess(tx, req.user, row.topicId);
    lecturerFor(req.user, topic);
    checkRevision(row, req.body.revision);
    checkState(topic, ["in_progress"]);
    const current = await tx.submission.findFirst({
      where: { milestoneId: row.id },
      orderBy: { version: "desc" },
    });
    ensure(
      current?.status === "accepted" && !row.resubmissionAllowed,
      409,
      "INVALID_TRANSITION",
      "Chỉ mở lại mốc đang được chấp nhận.",
    );
    const result = await tx.milestone.update({
      where: { id: row.id },
      data: { resubmissionAllowed: true, revision: { increment: 1 } },
    });
    await tx.topic.update({
      where: { id: topic.id },
      data: { revision: { increment: 1 } },
    });
    await event(tx, req.user, "milestone.reopened", topic, req, {
      reason: req.body.reason,
      afterData: { milestoneId: row.id },
    });
    return result;
  },
);
read(progressRouter, "/topics/:id/progress-updates", async (req, tx) => {
  const topic = await topicAccess(tx, req.user, req.params.id);
  return paged(
    tx,
    "progressUpdate",
    { topicId: topic.id, ...(await temporalWhere(tx, req.user, topic)) },
    req.query,
  );
});
write(
  progressRouter,
  "post",
  "/topics/:id/progress-updates",
  z
    .object({
      completedWork: z.string().trim().min(10).max(5000),
      difficulties: z.string().trim().max(5000),
      nextPlan: z.string().trim().min(10).max(5000),
      selfReportedPercent: z.number().int().min(0).max(100),
      milestoneId: uid.optional(),
    })
    .strict(),
  async (req, tx) => {
    const topic = await topicAccess(tx, req.user, req.params.id);
    await currentStudent(tx, req.user, topic);
    checkState(topic, ["in_progress"]);
    if (req.body.milestoneId)
      ensure(
        (await found("milestone", req.body.milestoneId, tx)).topicId ===
          topic.id,
        422,
        "MILESTONE_MISMATCH",
        "Mốc không thuộc đề tài.",
      );
    const row = await tx.progressUpdate.create({
      data: { ...req.body, topicId: topic.id, authorId: req.user.id },
    });
    await event(tx, req.user, "progress.added", topic, req, {
      afterData: {
        progressId: row.id,
        selfReportedPercent: row.selfReportedPercent,
      },
    });
    return row;
  },
  { status: 201, idempotency: true },
);
read(progressRouter, "/milestones/:id/submissions", async (req, tx) => {
  const milestone = await found("milestone", req.params.id, tx),
    topic = await topicAccess(tx, req.user, milestone.topicId);
  return visibleSubmissions(tx, req.user, topic, milestone.id);
});
write(
  progressRouter,
  "post",
  "/milestones/:id/submissions",
  z
    .object({
      milestoneRevision: revision,
      attachmentIds: z.array(uid).min(1).max(5),
      note: z.string().max(2000).optional(),
    })
    .strict(),
  async (req, tx) => {
    const milestone = await found("milestone", req.params.id, tx),
      topic = await topicAccess(tx, req.user, milestone.topicId);
    await currentStudent(tx, req.user, topic);
    checkState(topic, ["in_progress"]);
    checkRevision(milestone, req.body.milestoneRevision);
    const current = await tx.submission.findFirst({
      where: { milestoneId: milestone.id },
      orderBy: { version: "desc" },
    });
    ensure(
      current?.status !== "accepted" || milestone.resubmissionAllowed,
      409,
      "MILESTONE_ACCEPTED",
      "Mốc đã đạt; cần giảng viên mở lại trước khi nộp.",
    );
    const ids = [...new Set(req.body.attachmentIds)];
    ensure(
      ids.length === req.body.attachmentIds.length,
      422,
      "DUPLICATE_FILE",
      "File không được trùng.",
    );
    ensure(
      (await tx.attachment.count({
        where: {
          id: { in: ids },
          topicId: topic.id,
          status: "ready",
          purpose: { in: ["report", "private_image"] },
        },
      })) === ids.length,
      422,
      "FILE_NOT_READY",
      "File chưa sẵn sàng hoặc không thuộc đề tài.",
    );
    ensure(
      (await tx.attachment.count({
        where: {
          id: { in: ids },
          topicId: topic.id,
          status: "ready",
          purpose: "report",
        },
      })) > 0,
      422,
      "REPORT_REQUIRED",
      "Cần ít nhất một tài liệu báo cáo PDF hoặc Office. Ảnh riêng là tài liệu bổ trợ.",
    );
    ensure(
      !(await tx.submissionFile.count({
        where: { attachmentId: { in: ids } },
      })),
      409,
      "FILE_ALREADY_SUBMITTED",
      "File đã được dùng trong bản nộp khác. Vui lòng upload bản mới.",
    );
    const updated = await tx.milestone.update({
        where: { id: milestone.id },
        data: {
          submissionSequence: { increment: 1 },
          revision: { increment: 1 },
          resubmissionAllowed: false,
        },
      }),
      submittedAt = new Date();
    const row = await tx.submission.create({
      data: {
        topicId: topic.id,
        milestoneId: milestone.id,
        submittedBy: req.user.id,
        version: updated.submissionSequence,
        note: req.body.note,
        submittedAt,
        deadlineSnapshot: milestone.deadline,
        isLate: submittedAt > milestone.deadline,
      },
    });
    for (const attachmentId of ids)
      await tx.submissionFile.create({
        data: { submissionId: row.id, attachmentId, topicId: topic.id },
      });
    await event(tx, req.user, "submission.finalized", topic, req, {
      afterData: {
        submissionId: row.id,
        version: row.version,
        isLate: row.isLate,
      },
    });
    return row;
  },
  { status: 201, idempotency: true },
);
read(progressRouter, "/submissions/:id", async (req, tx) => {
  const sub = await found("submission", req.params.id, tx),
    topic = await topicAccess(tx, req.user, sub.topicId, sub.submittedAt);
  return (await visibleSubmissions(tx, req.user, topic, sub.milestoneId)).find(
    (s) => s.id === sub.id,
  );
});
read(progressRouter, "/submissions/:id/reviews", async (req, tx) => {
  const sub = await found("submission", req.params.id, tx),
    topic = await topicAccess(tx, req.user, sub.topicId, sub.submittedAt),
    rows = await tx.review.findMany({
      where: { submissionId: sub.id },
      orderBy: { createdAt: "desc" },
    }),
    visible = [];
  for (const row of rows)
    if (await access(tx, req.user, topic, row.createdAt)) visible.push(row);
  return visible;
});
write(
  progressRouter,
  "post",
  "/submissions/:id/reviews",
  z
    .object({
      submissionRevision: revision,
      comment: z.string().trim().min(10).max(5000),
      decision: z.enum(["comment_only", "changes_requested", "accepted"]),
      supersedesReviewId: uid.optional(),
    })
    .strict(),
  async (req, tx) => {
    const sub = await found("submission", req.params.id, tx),
      topic = await topicAccess(tx, req.user, sub.topicId);
    lecturerFor(req.user, topic);
    checkState(topic, ["in_progress"]);
    checkRevision(sub, req.body.submissionRevision);
    const current = await tx.submission.findFirst({
      where: { milestoneId: sub.milestoneId },
      orderBy: { version: "desc" },
    });
    ensure(
      current.id === sub.id,
      409,
      "SUBMISSION_NOT_CURRENT",
      "Chỉ nhận xét bản nộp hiện hành.",
    );
    ensure(
      sub.status !== "accepted" || req.body.decision === "comment_only",
      409,
      "MILESTONE_ACCEPTED",
      "Bản hiện hành đã đạt. Giảng viên cần mở lại mốc có lý do và nhận bản nộp mới trước khi đổi quyết định.",
    );
    if (req.body.supersedesReviewId)
      ensure(
        (await found("review", req.body.supersedesReviewId, tx))
          .submissionId === sub.id,
        422,
        "REVIEW_MISMATCH",
        "Nhận xét sửa sai không thuộc bản nộp này.",
      );
    const row = await tx.review.create({
      data: {
        submissionId: sub.id,
        reviewerId: req.user.id,
        comment: req.body.comment,
        decision: req.body.decision,
        supersedesReviewId: req.body.supersedesReviewId,
      },
    });
    await tx.submission.update({
      where: { id: sub.id },
      data: {
        ...(row.decision === "comment_only" ? {} : { status: row.decision }),
        revision: { increment: 1 },
      },
    });
    if (row.decision === "accepted")
      await tx.milestone.update({
        where: { id: sub.milestoneId },
        data: { resubmissionAllowed: false, revision: { increment: 1 } },
      });
    await event(tx, req.user, "submission.reviewed", topic, req, {
      afterData: {
        submissionId: sub.id,
        reviewId: row.id,
        decision: row.decision,
      },
    });
    return row;
  },
  { status: 201, idempotency: true },
);
read(progressRouter, "/topics/:id/evaluations", async (req, tx) => {
  const topic = await topicAccess(tx, req.user, req.params.id),
    rows = await tx.evaluation.findMany({
      where: { topicId: topic.id },
      orderBy: { version: "desc" },
    }),
    visible = [];
  for (const row of rows)
    if (await access(tx, req.user, topic, row.createdAt)) visible.push(row);
  return visible;
});
const evaluationShape = {
  result: z.enum(["passed", "failed"]),
  comment: z.string().trim().min(10).max(5000),
  score: z.number().min(0).max(10).nullable().optional(),
  revision,
};
write(
  progressRouter,
  "post",
  "/topics/:id/evaluations",
  z.object(evaluationShape).strict(),
  async (req, tx) => {
    const topic = await topicAccess(tx, req.user, req.params.id);
    lecturerFor(req.user, topic);
    checkRevision(topic, req.body.revision);
    checkState(topic, ["pending_evaluation"]);
    await readyForEvaluation(tx, topic);
    const { revision: _, ...data } = req.body;
    const updated = await tx.topic.update({
      where: { id: topic.id },
      data: {
        evaluationSequence: { increment: 1 },
        status: "completed",
        completedAt: new Date(),
        revision: { increment: 1 },
      },
    });
    const row = await tx.evaluation.create({
      data: {
        ...data,
        topicId: topic.id,
        evaluatorId: req.user.id,
        version: updated.evaluationSequence,
      },
    });
    await event(tx, req.user, "topic.evaluated", updated, req, {
      afterData: { evaluationId: row.id, result: row.result },
    });
    await closeTeam(tx, updated, "Đề tài đã hoàn thành");
    await publishCorpus(tx);
    return row;
  },
  { status: 201, idempotency: true },
);
write(
  progressRouter,
  "post",
  "/topics/:id/evaluation-corrections",
  z.object({ ...evaluationShape, correctionReason: reason }).strict(),
  async (req, tx) => {
    const topic = await topicAccess(tx, req.user, req.params.id);
    await staffFor(tx, req.user, topic);
    checkRevision(topic, req.body.revision);
    checkState(topic, ["completed"]);
    const previous = await tx.evaluation.findFirst({
      where: { topicId: topic.id },
      orderBy: { version: "desc" },
    });
    ensure(previous, 409, "EVALUATION_MISSING", "Chưa có kết quả để sửa sai.");
    const updated = await tx.topic.update({
      where: { id: topic.id },
      data: {
        evaluationSequence: { increment: 1 },
        revision: { increment: 1 },
      },
    });
    const { revision: _, ...data } = req.body;
    const row = await tx.evaluation.create({
      data: {
        ...data,
        topicId: topic.id,
        evaluatorId: req.user.id,
        version: updated.evaluationSequence,
        supersedesId: previous.id,
      },
    });
    await event(tx, req.user, "evaluation.corrected", updated, req, {
      reason: req.body.correctionReason,
      afterData: { evaluationId: row.id, result: row.result },
    });
    return row;
  },
  { status: 201, idempotency: true },
);
