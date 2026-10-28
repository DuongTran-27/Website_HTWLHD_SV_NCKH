import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { vi } from "zod/locales";
z.config(vi());

export const db = new PrismaClient({ log: [] });
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}
export const fail = (status, code, message, details) => {
  throw new AppError(status, code, message, details);
};
export const ensure = (condition, status, code, message, details) => {
  if (!condition) fail(status, code, message, details);
};
export const json = (value) =>
  JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? Number(v) : v)),
  );
export const hash = (value) =>
  createHash("sha256")
    .update(
      typeof value === "string" || value instanceof Uint8Array
        ? value
        : JSON.stringify(value),
    )
    .digest("hex");
export const uid = z.uuid();
export const revision = z.number().int().positive();
export const reason = z
  .string()
  .trim()
  .min(10, "Lý do cần ít nhất 10 ký tự")
  .max(2000);
export const decisionSchema = z.enum(["accept", "decline"]);
export const roles = ["student", "lecturer", "faculty_staff", "admin"];
export const publicStates = [
  "approved",
  "in_progress",
  "pending_evaluation",
  "completed",
];
export const terminalStates = ["completed", "rejected", "cancelled"];
export const editableStates = ["draft", "revision_required"];
export const academicShape = {
  title: z.string().trim().min(10).max(250),
  fieldId: uid,
  abstract: z.string().trim().max(5000),
  objectives: z.string().trim().max(5000),
  researchContent: z.string().trim().max(20000),
  methodology: z.string().trim().max(10000),
  expectedOutcomes: z.string().trim().max(10000),
};
export const completeAcademic = z.object({
  ...academicShape,
  abstract: academicShape.abstract.min(100),
  objectives: academicShape.objectives.min(50),
  researchContent: academicShape.researchContent.min(200),
  methodology: academicShape.methodology.min(1),
  expectedOutcomes: academicShape.expectedOutcomes.min(1),
});
export const academicKeys = Object.keys(academicShape);
export const pickAcademic = (topic) =>
  Object.fromEntries(academicKeys.map((k) => [k, topic[k]]));
export const academicHash = (topic) => hash(pickAcademic(topic));
export const has = (user, role) => user.roles.includes(role);
export const scoped = (user, facultyId) =>
  has(user, "faculty_staff") && user.scopes.includes(facultyId);
export const requireRole = (user, ...allowed) =>
  ensure(
    allowed.some((r) => has(user, r)),
    403,
    "ACTION_FORBIDDEN",
    "Bạn không có quyền thực hiện thao tác này.",
  );
export function checkRevision(row, expected) {
  ensure(
    row.revision === expected,
    409,
    "REVISION_CONFLICT",
    "Dữ liệu đã thay đổi. Vui lòng tải lại trước khi tiếp tục.",
    { currentRevision: row.revision },
  );
}
export function checkState(row, states) {
  ensure(
    states.includes(row.status),
    409,
    "INVALID_TRANSITION",
    "Thao tác không hợp lệ ở trạng thái hiện tại.",
  );
}
export async function found(model, id, client = db) {
  const row = await client[model].findUnique({ where: { id } });
  ensure(
    row,
    404,
    "RESOURCE_NOT_FOUND",
    "Không tìm thấy dữ liệu được phép truy cập.",
  );
  return row;
}
export const safeUser = (u) =>
  u &&
  Object.fromEntries(
    [
      "id",
      "accountCode",
      "email",
      "fullName",
      "facultyId",
      "classId",
      "specialization",
      "avatarUrl",
      "status",
      "mustChangePassword",
      "revision",
    ].map((k) => [k, u[k]]),
  );
export async function loadUser(id, client = db) {
  const user = await client.user.findUnique({ where: { id } });
  if (!user) return null;
  const [rs, scopes] = await Promise.all([
    client.userRole.findMany({ where: { userId: id } }),
    client.managementScope.findMany({ where: { userId: id } }),
  ]);
  return {
    ...user,
    roles: rs.map((r) => r.role),
    scopes: scopes.map((s) => s.facultyId),
  };
}
// One database-wide write lock is intentional for the first single-school release.
// It also serializes corpus publication, team seat allocation and evaluation prerequisites.
export async function transaction(fn) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(72654001)`;
          return fn(tx);
        },
        {
          maxWait: 15000,
          timeout: 30000,
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        },
      );
    } catch (error) {
      if (error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
}
export async function audit(
  tx,
  user,
  action,
  entityType,
  row,
  req,
  extra = {},
) {
  return tx.auditLog.create({
    data: {
      actorId: user?.id,
      actorKind: user ? "user" : "system",
      action,
      entityType,
      entityId: row.id,
      facultyId: row.facultyId ?? extra.facultyId,
      requestId: req?.requestId ?? randomUUID(),
      ...extra,
    },
  });
}
export async function notify(
  tx,
  recipientIds,
  type,
  title,
  body,
  entity,
  eventKey,
) {
  for (const recipientId of new Set(recipientIds.filter(Boolean)))
    await tx.notification.upsert({
      where: { recipientId_eventKey: { recipientId, eventKey } },
      create: {
        recipientId,
        type,
        title,
        body,
        entityType: "topic",
        entityId: entity.id,
        eventKey,
      },
      update: {},
    });
}
export async function audience(tx, topic) {
  const [members, staff] = await Promise.all([
    tx.teamMember.findMany({ where: { teamId: topic.teamId, active: true } }),
    tx.managementScope.findMany({ where: { facultyId: topic.facultyId } }),
  ]);
  return [
    ...members.map((m) => m.studentId),
    ...staff.map((s) => s.userId),
    topic.supervisorId,
  ];
}
export async function event(tx, user, action, topic, req, extra = {}) {
  await audit(tx, user, action, "topic", topic, req, extra);
  await notify(
    tx,
    await audience(tx, topic),
    "workflow",
    "Hồ sơ nghiên cứu được cập nhật",
    `${topic.code}: ${topic.title}`,
    topic,
    `${action}:${topic.id}:${topic.revision}`,
  );
}
export async function idempotent(req, tx, operation, fn, status = 200) {
  const key = req.get("Idempotency-Key");
  ensure(
    key && key.length >= 8 && key.length <= 128,
    422,
    "IDEMPOTENCY_KEY_REQUIRED",
    "Thiếu khóa chống gửi lặp hợp lệ.",
  );
  const where = {
    actorId_operation_idempotencyKey: {
      actorId: req.user.id,
      operation,
      idempotencyKey: key,
    },
  };
  const fingerprint = hash(req.body ?? {});
  const previous = await tx.idempotencyRecord.findUnique({ where });
  if (previous && previous.expiresAt > new Date()) {
    ensure(
      previous.requestHash === fingerprint,
      409,
      "IDEMPOTENCY_CONFLICT",
      "Khóa gửi lặp đã được dùng cho dữ liệu khác.",
    );
    return { data: previous.responseData, status: previous.responseStatus };
  }
  if (previous) await tx.idempotencyRecord.delete({ where });
  const data = json(await fn());
  await tx.idempotencyRecord.create({
    data: {
      actorId: req.user.id,
      operation,
      idempotencyKey: key,
      requestHash: fingerprint,
      responseData: data,
      responseStatus: status,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  return { data, status };
}
export function pagination(query) {
  const page = z.coerce.number().int().min(1).default(1).parse(query.page);
  const pageSize = z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .parse(query.pageSize);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
export async function paged(
  client,
  model,
  where,
  query,
  orderBy = { createdAt: "desc" },
  select,
) {
  const p = pagination(query);
  const [data, totalItems] = await Promise.all([
    client[model].findMany({
      where,
      skip: p.skip,
      take: p.take,
      orderBy,
      select,
    }),
    client[model].count({ where }),
  ]);
  return {
    data,
    meta: {
      page: p.page,
      pageSize: p.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / p.pageSize),
    },
  };
}
export const ok = (res, req, data, status = 200) =>
  res.status(status).json({ data: json(data), requestId: req.requestId });
export const listOk = (res, req, result) =>
  res.json({ ...json(result), requestId: req.requestId });
export const rateLimitHandler = (req, res) =>
  res.status(429).json({
    error: {
      code: "RATE_LIMITED",
      message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
    },
    requestId: req.requestId,
  });
