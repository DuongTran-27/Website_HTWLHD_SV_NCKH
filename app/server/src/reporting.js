import { Router } from "express";
import { z } from "zod";
import { stringify } from "csv-stringify/sync";
import { read, write } from "./routes.js";
import {
  db,
  ensure,
  found,
  has,
  scoped,
  requireRole,
  uid,
  paged,
  publicStates,
} from "./core.js";
import { topicFilter, decorateMetadata, metadataSelect } from "./topics.js";
export const reportingRouter = Router();
export async function reportRows(tx, user, query) {
  requireRole(user, "lecturer", "faculty_staff");
  const where = await topicFilter(tx, user, query, true);
  // Reports are scoped to assigned topics / managed faculties, irrespective of student membership.
  where.AND = [
    ...(where.AND ?? []),
    {
      OR: [
        ...(has(user, "lecturer") ? [{ supervisorId: user.id }] : []),
        ...(has(user, "faculty_staff")
          ? [{ facultyId: { in: user.scopes } }]
          : []),
      ],
    },
  ];
  const rows = await tx.topic.findMany({
      where,
      select: metadataSelect,
      orderBy: { code: "asc" },
    }),
    decorated = await decorateMetadata(tx, rows),
    evals = await tx.evaluation.findMany({
      where: { topicId: { in: rows.map((r) => r.id) } },
      orderBy: { version: "desc" },
    }),
    latest = new Map();
  for (const e of evals) if (!latest.has(e.topicId)) latest.set(e.topicId, e);
  const periods = await tx.researchPeriod.findMany();
  return decorated.map((row) => ({
    ...row,
    academicYear: periods.find((p) => p.id === row.periodId)?.academicYear,
    result: latest.get(row.id)?.result ?? "unassessed",
    score: latest.get(row.id)?.score ?? null,
  }));
}
read(reportingRouter, "/reports/topics", async (req, tx) => {
  const rows = await reportRows(tx, req.user, req.query),
    groupBy = z
      .enum([
        "status",
        "result",
        "faculty",
        "field",
        "period",
        "supervisor",
        "academicYear",
      ])
      .default("status")
      .parse(req.query.groupBy);
  const key = {
      status: "status",
      result: "result",
      faculty: "facultyName",
      field: "fieldName",
      period: "periodName",
      supervisor: "supervisorName",
      academicYear: "academicYear",
    }[groupBy],
    counts = new Map();
  for (const row of rows) {
    const name = row[key] ?? "Chưa phân công";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return {
    total: rows.length,
    groupBy,
    breakdown: [...counts].map(([name, value]) => ({ name, value })),
    rows,
  };
});
export function csvCell(value) {
  const text = String(value ?? "");
  return /^[\s]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text)
    ? `'${text}`
    : text;
}
reportingRouter.get("/reports/topics/export", async (req, res) => {
  const rows = await reportRows(db, req.user, req.query);
  const table = rows.map((r) =>
    Object.fromEntries(
      Object.entries({
        "Mã đề tài": r.code,
        "Tên đề tài": r.title,
        Khoa: r.facultyName,
        Đợt: r.periodName,
        "Năm học": r.academicYear,
        "Lĩnh vực": r.fieldName,
        "Giảng viên": r.supervisorName,
        "Trạng thái": r.status,
        "Kết quả": r.result,
        Điểm: r.score,
      }).map(([k, v]) => [k, csvCell(v)]),
    ),
  );
  res
    .type("text/csv; charset=utf-8")
    .set("Content-Disposition", 'attachment; filename="bao-cao-nckh.csv"')
    .set("Cache-Control", "no-store")
    .send(
      "\uFEFF" +
        stringify(table, {
          header: true,
          columns: [
            "Mã đề tài",
            "Tên đề tài",
            "Khoa",
            "Đợt",
            "Năm học",
            "Lĩnh vực",
            "Giảng viên",
            "Trạng thái",
            "Kết quả",
            "Điểm",
          ],
        }),
    );
});
read(reportingRouter, "/dashboard", async (req, tx) => {
  const user = req.user,
    unread = await tx.notification.count({
      where: { recipientId: user.id, readAt: null },
    });
  if (
    has(user, "admin") &&
    !has(user, "student") &&
    !has(user, "lecturer") &&
    !has(user, "faculty_staff")
  )
    return {
      kind: "admin",
      cards: [
        { label: "Tài khoản", value: await tx.user.count() },
        {
          label: "Tài khoản hoạt động",
          value: await tx.user.count({ where: { status: "active" } }),
        },
        { label: "Khoa", value: await tx.faculty.count() },
        { label: "Thông báo chưa đọc", value: unread },
      ],
      breakdown: [],
      recentTopics: [],
      deadlines: [],
      pending: 0,
    };
  const where = await topicFilter(tx, user, {}, true),
    topics = await tx.topic.findMany({
      where,
      select: metadataSelect,
      orderBy: { createdAt: "desc" },
    }),
    counts = new Map();
  for (const t of topics) counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
  const activeIds = topics
    .filter((t) => ["approved", "in_progress"].includes(t.status))
    .map((t) => t.id);
  const milestones = await tx.milestone.findMany({
      where: { topicId: { in: activeIds } },
      orderBy: { deadline: "asc" },
    }),
    deadlines = [],
    latestSubmission = new Map();
  for (const s of await tx.submission.findMany({
    where: { milestoneId: { in: milestones.map((m) => m.id) } },
    orderBy: { version: "desc" },
    select: { milestoneId: true, status: true },
  }))
    if (!latestSubmission.has(s.milestoneId))
      latestSubmission.set(s.milestoneId, s);
  for (const m of milestones) {
    const sub = latestSubmission.get(m.id);
    if (sub?.status !== "accepted" || m.resubmissionAllowed)
      deadlines.push({
        ...m,
        topicTitle: topics.find((t) => t.id === m.topicId)?.title,
        topicCode: topics.find((t) => t.id === m.topicId)?.code,
      });
  }
  const pending = has(user, "faculty_staff")
    ? topics.filter((t) => t.status === "submitted").length
    : await tx.supervisionRequest.count({
        where: { lecturerId: user.id, status: "pending" },
      });
  return {
    kind: has(user, "faculty_staff")
      ? "staff"
      : has(user, "lecturer")
        ? "lecturer"
        : "student",
    cards: [
      { label: "Đề tài trong phạm vi", value: topics.length },
      { label: "Đang thực hiện", value: counts.get("in_progress") ?? 0 },
      { label: "Đã hoàn thành", value: counts.get("completed") ?? 0 },
      { label: "Thông báo chưa đọc", value: unread },
    ],
    breakdown: [...counts].map(([name, value]) => ({ name, value })),
    recentTopics: await decorateMetadata(tx, topics.slice(0, 5)),
    deadlines: deadlines.slice(0, 8),
    pending,
  };
});
read(reportingRouter, "/notifications", async (req, tx) =>
  paged(
    tx,
    "notification",
    {
      recipientId: req.user.id,
      ...(req.query.unread === "true" ? { readAt: null } : {}),
    },
    req.query,
  ),
);
write(
  reportingRouter,
  "patch",
  "/notifications/:id",
  z.object({ read: z.literal(true) }).strict(),
  async (req, tx) => {
    const row = await found("notification", uid.parse(req.params.id), tx);
    ensure(
      row.recipientId === req.user.id,
      404,
      "RESOURCE_NOT_FOUND",
      "Không tìm thấy thông báo.",
    );
    return tx.notification.update({
      where: { id: row.id },
      data: { readAt: row.readAt ?? new Date() },
    });
  },
);
write(
  reportingRouter,
  "post",
  "/notifications/read-all",
  z.object({}).strict(),
  (req, tx) =>
    tx.notification.updateMany({
      where: { recipientId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    }),
);
