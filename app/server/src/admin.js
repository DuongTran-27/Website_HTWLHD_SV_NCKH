import { Router } from "express";
import { z } from "zod";
import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { parse as csvParse } from "csv-parse/sync";
import { rateLimit } from "express-rate-limit";
import { read, write } from "./routes.js";
import {
  db,
  ensure,
  fail,
  found,
  has,
  scoped,
  requireRole,
  uid,
  revision,
  reason,
  roles,
  safeUser,
  paged,
  checkRevision,
  audit,
  loadUser,
  transaction,
  ok,
  rateLimitHandler,
} from "./core.js";
import { passwordSchema, revokeUser } from "./auth.js";

export const adminRouter = Router();
const canManage = (u, f) => has(u, "admin") || scoped(u, f);
const profileShape = {
  accountCode: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9._-]+$/),
  email: z.email().transform((s) => s.toLowerCase()),
  fullName: z.string().trim().min(2).max(200),
  facultyId: uid.nullable(),
  classId: uid.nullable(),
  specialization: z.string().max(2000).optional(),
};
const userCreate = z
  .object({
    ...profileShape,
    password: passwordSchema,
    roles: z.array(z.enum(roles)).min(1).max(4),
  })
  .strict();
async function validateUser(tx, actor, body) {
  ensure(
    canManage(actor, body.facultyId),
    403,
    "ACTION_FORBIDDEN",
    "Tài khoản nằm ngoài khoa được quản lý.",
  );
  if (!has(actor, "admin"))
    ensure(
      body.roles.every((r) => ["student", "lecturer"].includes(r)),
      403,
      "ACTION_FORBIDDEN",
      "Cán bộ chỉ được tạo sinh viên và giảng viên trong khoa.",
    );
  if (body.roles.includes("student"))
    ensure(
      body.facultyId && body.classId,
      422,
      "VALIDATION_FAILED",
      "Sinh viên cần khoa và lớp.",
    );
  if (body.classId) {
    const cls = await found("class", body.classId, tx),
      major = await found("major", cls.majorId, tx);
    ensure(
      cls.isActive && major.isActive && major.facultyId === body.facultyId,
      422,
      "FACULTY_MISMATCH",
      "Lớp, ngành và khoa không nhất quán.",
    );
  }
  if (body.roles.some((r) => ["lecturer", "faculty_staff"].includes(r)))
    ensure(
      body.facultyId,
      422,
      "VALIDATION_FAILED",
      "Vai trò nghiệp vụ cần khoa.",
    );
}
async function createUser(tx, actor, body, req, passwordHash) {
  await validateUser(tx, actor, body);
  const { password, roles: rs, ...profile } = body;
  const user = await tx.user.create({
    data: {
      ...profile,
      passwordHash:
        passwordHash ??
        (await argon2.hash(password, { type: argon2.argon2id })),
      mustChangePassword: true,
    },
  });
  await tx.userRole.createMany({
    data: rs.map((role) => ({ userId: user.id, role })),
  });
  await audit(tx, actor, "user.created", "user", user, req, {
    afterData: { accountCode: user.accountCode, roles: rs },
  });
  return { ...safeUser(user), roles: rs };
}
read(adminRouter, "/users", async (req, tx) => {
  requireRole(req.user, "faculty_staff", "admin");
  const where = {
    ...(!has(req.user, "admin") ? { facultyId: { in: req.user.scopes } } : {}),
    ...(req.query.facultyId
      ? { facultyId: uid.parse(req.query.facultyId) }
      : {}),
  };
  if (req.query.search) {
    const search = z.string().max(250).parse(req.query.search);
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { accountCode: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (!has(req.user, "admin"))
    where.AND = [{ facultyId: { in: req.user.scopes } }];
  if (req.query.role) {
    const ids = await tx.userRole.findMany({
      where: { role: z.enum(roles).parse(req.query.role) },
    });
    where.id = { in: ids.map((x) => x.userId) };
  }
  const result = await paged(tx, "user", where, req.query);
  result.data = await Promise.all(
    result.data.map(async (u) => ({
      ...safeUser(u),
      roles: (await tx.userRole.findMany({ where: { userId: u.id } })).map(
        (r) => r.role,
      ),
      scopes: (
        await tx.managementScope.findMany({ where: { userId: u.id } })
      ).map((s) => s.facultyId),
    })),
  );
  return result;
});
read(adminRouter, "/users/:id", async (req, tx) => {
  const user = await loadUser(uid.parse(req.params.id), tx);
  ensure(
    user && (user.id === req.user.id || canManage(req.user, user.facultyId)),
    404,
    "RESOURCE_NOT_FOUND",
    "Không tìm thấy tài khoản.",
  );
  return { ...safeUser(user), roles: user.roles, scopes: user.scopes };
});
write(
  adminRouter,
  "post",
  "/users",
  userCreate,
  (req, tx) => createUser(tx, req.user, req.body, req),
  { status: 201 },
);
write(
  adminRouter,
  "patch",
  "/users/:id",
  z
    .object({
      revision,
      ...Object.fromEntries(
        Object.entries(profileShape).map(([k, v]) => [k, v.optional()]),
      ),
      status: z.enum(["active", "locked"]).optional(),
    })
    .strict(),
  async (req, tx) => {
    requireRole(req.user, "faculty_staff", "admin");
    const user = await found("user", req.params.id, tx);
    checkRevision(user, req.body.revision);
    const target = await loadUser(user.id, tx);
    ensure(
      canManage(req.user, user.facultyId),
      403,
      "ACTION_FORBIDDEN",
      "Ngoài phạm vi quản lý.",
    );
    if (!has(req.user, "admin"))
      ensure(
        !target.roles.some((r) => ["admin", "faculty_staff"].includes(r)),
        403,
        "ACTION_FORBIDDEN",
        "Không có quyền sửa tài khoản quản lý.",
      );
    const merged = { ...user, ...req.body, roles: target.roles };
    await validateUser(tx, req.user, merged);
    if (req.body.status === "locked" && target.roles.includes("admin")) {
      const activeAdmins = await tx.userRole.findMany({
        where: { role: "admin" },
      });
      ensure(
        (await tx.user.count({
          where: {
            id: { in: activeAdmins.map((r) => r.userId) },
            status: "active",
          },
        })) > 1,
        409,
        "LAST_ADMIN",
        "Không được khóa quản trị viên cuối cùng.",
      );
    }
    const { revision: _, ...changes } = req.body;
    const result = await tx.user.update({
      where: { id: user.id },
      data: {
        ...changes,
        authVersion: { increment: 1 },
        revision: { increment: 1 },
      },
    });
    await revokeUser(tx, user.id, "account_update");
    await audit(tx, req.user, "user.updated", "user", result, req, {
      afterData: { status: result.status, fullName: result.fullName },
    });
    return safeUser(result);
  },
);
write(
  adminRouter,
  "post",
  "/users/:id/reset-password",
  z.object({ reason }).strict(),
  async (req, tx) => {
    requireRole(req.user, "faculty_staff", "admin");
    const target = await loadUser(req.params.id, tx);
    ensure(
      target && canManage(req.user, target.facultyId),
      403,
      "ACTION_FORBIDDEN",
      "Ngoài phạm vi quản lý.",
    );
    if (!has(req.user, "admin"))
      ensure(
        !target.roles.some((r) => ["admin", "faculty_staff"].includes(r)),
        403,
        "ACTION_FORBIDDEN",
        "Không có quyền đặt lại mật khẩu quản lý.",
      );
    const temporaryPassword = randomBytes(18).toString("base64url");
    await tx.user.update({
      where: { id: target.id },
      data: {
        passwordHash: await argon2.hash(temporaryPassword, {
          type: argon2.argon2id,
        }),
        mustChangePassword: true,
        authVersion: { increment: 1 },
        revision: { increment: 1 },
      },
    });
    await revokeUser(tx, target.id, "password_reset");
    await audit(tx, req.user, "user.password_reset", "user", target, req, {
      reason: req.body.reason,
    });
    return { temporaryPassword, mustChangePassword: true };
  },
);
write(
  adminRouter,
  "put",
  "/users/:id/roles",
  z.object({ revision, roles: z.array(z.enum(roles)).min(1).max(4) }).strict(),
  async (req, tx) => {
    requireRole(req.user, "admin");
    const user = await found("user", req.params.id, tx);
    checkRevision(user, req.body.revision);
    const old = await loadUser(user.id, tx);
    await validateUser(tx, req.user, { ...user, roles: req.body.roles });
    if (old.roles.includes("admin") && !req.body.roles.includes("admin")) {
      const admins = await tx.userRole.findMany({ where: { role: "admin" } });
      ensure(
        (await tx.user.count({
          where: { id: { in: admins.map((r) => r.userId) }, status: "active" },
        })) > 1,
        409,
        "LAST_ADMIN",
        "Không được gỡ quản trị viên cuối cùng.",
      );
    }
    if (!req.body.roles.includes("student"))
      ensure(
        !(await tx.teamMember.count({
          where: { studentId: user.id, active: true },
        })),
        409,
        "ROLE_IN_USE",
        "Sinh viên còn tham gia nhóm hoạt động.",
      );
    if (!req.body.roles.includes("lecturer"))
      ensure(
        !(await tx.topic.count({
          where: {
            supervisorId: user.id,
            status: { in: ["approved", "in_progress", "pending_evaluation"] },
          },
        })),
        409,
        "ROLE_IN_USE",
        "Giảng viên còn hướng dẫn đề tài.",
      );
    await tx.userRole.deleteMany({ where: { userId: user.id } });
    await tx.userRole.createMany({
      data: req.body.roles.map((role) => ({ userId: user.id, role })),
    });
    if (!req.body.roles.includes("faculty_staff"))
      await tx.managementScope.deleteMany({ where: { userId: user.id } });
    const result = await tx.user.update({
      where: { id: user.id },
      data: { revision: { increment: 1 }, authVersion: { increment: 1 } },
    });
    await revokeUser(tx, user.id, "role_change");
    await audit(tx, req.user, "user.roles_changed", "user", result, req, {
      beforeData: { roles: old.roles },
      afterData: { roles: req.body.roles },
    });
    return { ...safeUser(result), roles: req.body.roles };
  },
);
write(
  adminRouter,
  "put",
  "/users/:id/management-scopes",
  z.object({ revision, facultyIds: z.array(uid).max(100) }).strict(),
  async (req, tx) => {
    requireRole(req.user, "admin");
    const user = await loadUser(req.params.id, tx);
    ensure(user, 404, "RESOURCE_NOT_FOUND", "Không tìm thấy tài khoản.");
    checkRevision(user, req.body.revision);
    ensure(
      user.roles.includes("faculty_staff") || !req.body.facultyIds.length,
      422,
      "ROLE_REQUIRED",
      "Cần vai trò cán bộ khoa để cấp phạm vi.",
    );
    await tx.managementScope.deleteMany({ where: { userId: user.id } });
    await tx.managementScope.createMany({
      data: [...new Set(req.body.facultyIds)].map((facultyId) => ({
        userId: user.id,
        facultyId,
      })),
    });
    const result = await tx.user.update({
      where: { id: user.id },
      data: { revision: { increment: 1 }, authVersion: { increment: 1 } },
    });
    await revokeUser(tx, user.id, "scope_change");
    await audit(tx, req.user, "user.scopes_changed", "user", result, req, {
      afterData: { facultyIds: req.body.facultyIds },
    });
    return { ...safeUser(result), scopes: req.body.facultyIds };
  },
);
function importRows(csv) {
  try {
    return csvParse(csv, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      max_record_size: 20000,
    });
  } catch {
    fail(422, "CSV_INVALID", "CSV không đúng định dạng.");
  }
}
// Hash before the write transaction: 500 argon2 hashes take ~25 s and would hold the global lock.
adminRouter.post("/users/import", async (req, _res, next) => {
  requireRole(req.user, "faculty_staff", "admin");
  const csv = req.body?.csv;
  if (typeof csv !== "string" || !csv || csv.length > 1000000) return next();
  let rows;
  try {
    rows = importRows(csv);
  } catch {
    return next();
  }
  if (rows.length > 500) return next();
  req.importHashes = await Promise.all(
    rows.map((row) =>
      passwordSchema.safeParse(row.password).success
        ? argon2.hash(row.password, { type: argon2.argon2id })
        : null,
    ),
  );
  next();
});
write(
  adminRouter,
  "post",
  "/users/import",
  z.object({ csv: z.string().min(1).max(1000000) }).strict(),
  async (req, tx) => {
    requireRole(req.user, "faculty_staff", "admin");
    const rows = importRows(req.body.csv);
    ensure(
      rows.length > 0 && rows.length <= 500,
      422,
      "CSV_LIMIT",
      "CSV cần từ 1 đến 500 dòng.",
    );
    const errors = [],
      parsed = [],
      emails = new Set(),
      codes = new Set();
    for (const [i, row] of rows.entries()) {
      try {
        const { facultyCode, classCode, ...input } = row;
        const facultyId =
          input.facultyId ||
          (facultyCode
            ? (await tx.faculty.findUnique({ where: { code: facultyCode } }))
                ?.id
            : null);
        const classId =
          input.classId ||
          (classCode
            ? (await tx.class.findUnique({ where: { code: classCode } }))?.id
            : null);
        ensure(
          !facultyCode || facultyId,
          422,
          "FACULTY_NOT_FOUND",
          "Mã khoa không tồn tại.",
        );
        ensure(
          !classCode || classId,
          422,
          "CLASS_NOT_FOUND",
          "Mã lớp không tồn tại.",
        );
        const body = userCreate.parse({
          ...input,
          roles: (row.roles ?? "student").split("|"),
          facultyId: facultyId || null,
          classId: classId || null,
        });
        await validateUser(tx, req.user, body);
        ensure(
          !emails.has(body.email) && !codes.has(body.accountCode),
          409,
          "DUPLICATE",
          "Mã hoặc email trùng trong CSV.",
        );
        emails.add(body.email);
        codes.add(body.accountCode);
        ensure(
          !(await tx.user.count({
            where: {
              OR: [{ email: body.email }, { accountCode: body.accountCode }],
            },
          })),
          409,
          "DUPLICATE",
          "Tài khoản đã tồn tại.",
        );
        parsed.push({ body, passwordHash: req.importHashes?.[i] });
      } catch (e) {
        errors.push({
          row: i + 2,
          message:
            e instanceof z.ZodError
              ? e.issues
                  .map((v) => `${v.path.join(".")}: ${v.message}`)
                  .join("; ")
              : e.message,
        });
      }
    }
    ensure(
      !errors.length,
      422,
      "CSV_VALIDATION_FAILED",
      "CSV có lỗi; chưa ghi bất kỳ tài khoản nào.",
      { rows: errors },
    );
    for (const { body, passwordHash } of parsed)
      await createUser(tx, req.user, body, req, passwordHash);
    return { created: parsed.length };
  },
  { status: 201 },
);

const catalogConfig = {
  faculties: { model: "faculty", shape: {} },
  majors: { model: "major", shape: { facultyId: uid } },
  classes: {
    model: "class",
    shape: {
      majorId: uid,
      admissionYear: z.number().int().min(2000).max(2100),
    },
  },
  "research-fields": { model: "researchField", shape: {} },
};
for (const [path, { model, shape }] of Object.entries(catalogConfig)) {
  read(adminRouter, `/${path}`, async (req, tx) => {
    const where = {};
    if (req.query.active !== "all") where.isActive = true;
    if (shape.facultyId && req.query.facultyId)
      where.facultyId = uid.parse(req.query.facultyId);
    if (model === "class" && req.query.majorId)
      where.majorId = uid.parse(req.query.majorId);
    return tx[model].findMany({ where, orderBy: { code: "asc" } });
  });
  write(
    adminRouter,
    "post",
    `/${path}`,
    z
      .object({
        code: z.string().trim().min(2).max(30),
        name: z.string().trim().min(2).max(200),
        ...shape,
      })
      .strict(),
    async (req, tx) => {
      requireRole(req.user, "admin");
      const row = await tx[model].create({ data: req.body });
      await audit(tx, req.user, "catalog.created", model, row, req);
      return row;
    },
    { status: 201 },
  );
  write(
    adminRouter,
    "patch",
    `/${path}/:id`,
    z
      .object({
        revision,
        name: z.string().trim().min(2).max(200).optional(),
        isActive: z.boolean().optional(),
      })
      .strict(),
    async (req, tx) => {
      requireRole(req.user, "admin");
      const row = await found(model, req.params.id, tx);
      checkRevision(row, req.body.revision);
      const { revision: _, ...data } = req.body;
      const result = await tx[model].update({
        where: { id: row.id },
        data: { ...data, revision: { increment: 1 } },
      });
      await audit(tx, req.user, "catalog.updated", model, result, req);
      return result;
    },
  );
}
read(adminRouter, "/lecturers", async (req, tx) => {
  const rs = await tx.userRole.findMany({ where: { role: "lecturer" } });
  return tx.user.findMany({
    where: {
      id: { in: rs.map((r) => r.userId) },
      status: "active",
      ...(req.query.facultyId
        ? { facultyId: uid.parse(req.query.facultyId) }
        : {}),
    },
    select: { id: true, fullName: true, facultyId: true, specialization: true },
    orderBy: { fullName: "asc" },
  });
});
adminRouter.use(
  "/students/search",
  rateLimit({
    windowMs: 60000,
    limit: 30,
    handler: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
read(adminRouter, "/students/search", async (req, tx) => {
  requireRole(req.user, "student", "faculty_staff");
  const code = z
    .string()
    .min(3)
    .max(50)
    .parse(req.query.accountCode)
    .toLowerCase();
  const facultyIds = new Set(
    has(req.user, "faculty_staff") ? req.user.scopes : [],
  );
  if (
    has(req.user, "student") &&
    (await tx.team.count({
      where: { leaderId: req.user.id, status: "active" },
    })) > 0
  )
    facultyIds.add(req.user.facultyId);
  ensure(
    facultyIds.size,
    403,
    "ACTION_FORBIDDEN",
    "Chỉ trưởng nhóm hoặc cán bộ đúng phạm vi được tra cứu thành viên.",
  );
  const where = {
    accountCode: code,
    status: "active",
    facultyId: { in: [...facultyIds] },
  };
  const users = await tx.user.findMany({
    where,
    select: {
      id: true,
      accountCode: true,
      fullName: true,
      facultyId: true,
      classId: true,
    },
  });
  const students = await tx.userRole.findMany({
    where: { userId: { in: users.map((u) => u.id) }, role: "student" },
  });
  return users.filter((u) => students.some((s) => s.userId === u.id));
});
export const milestoneTemplate = z
  .object({
    code: z.string().min(2).max(30),
    name: z.string().min(2).max(200),
    required: z.boolean(),
    expectedOutput: z.string().min(10).max(2000),
    deadline: z.iso.datetime(),
    sortOrder: z.number().int().min(0).max(100),
  })
  .strict();
const periodShape = {
  facultyId: uid,
  name: z.string().trim().min(5).max(200),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  registrationStart: z.iso.datetime(),
  registrationEnd: z.iso.datetime(),
  minMembers: z.number().int().min(1).max(20),
  maxMembers: z.number().int().min(1).max(20),
  status: z.enum(["open", "closed"]),
  milestoneTemplates: z.array(milestoneTemplate).min(3).max(20),
};
function periodValid(body) {
  ensure(
    new Date(body.registrationStart) < new Date(body.registrationEnd) &&
      body.minMembers <= body.maxMembers,
    422,
    "INVALID_PERIOD",
    "Thời hạn và giới hạn thành viên không hợp lệ.",
  );
  ensure(
    new Set(body.milestoneTemplates.map((m) => m.code)).size ===
      body.milestoneTemplates.length,
    422,
    "INVALID_MILESTONES",
    "Mã mốc không được trùng.",
  );
  ensure(
    body.milestoneTemplates.filter((m) => m.required).length >= 3,
    422,
    "INVALID_MILESTONES",
    "Cần ít nhất ba mốc bắt buộc.",
  );
}
read(adminRouter, "/research-periods", async (req, tx) =>
  tx.researchPeriod.findMany({
    where: {
      ...(req.query.facultyId
        ? { facultyId: uid.parse(req.query.facultyId) }
        : {}),
      ...(req.query.status
        ? { status: z.enum(["open", "closed"]).parse(req.query.status) }
        : {}),
      ...(req.query.academicYear
        ? { academicYear: String(req.query.academicYear) }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  }),
);
read(adminRouter, "/research-periods/:id", (req, tx) =>
  found("researchPeriod", uid.parse(req.params.id), tx),
);
write(
  adminRouter,
  "post",
  "/research-periods",
  z.object(periodShape).strict(),
  async (req, tx) => {
    ensure(
      scoped(req.user, req.body.facultyId),
      403,
      "ACTION_FORBIDDEN",
      "Chỉ cán bộ được cấp khoa mới được mở đợt.",
    );
    periodValid(req.body);
    const row = await tx.researchPeriod.create({
      data: {
        ...req.body,
        registrationStart: new Date(req.body.registrationStart),
        registrationEnd: new Date(req.body.registrationEnd),
      },
    });
    await audit(tx, req.user, "period.created", "researchPeriod", row, req);
    return row;
  },
  { status: 201 },
);
write(
  adminRouter,
  "patch",
  "/research-periods/:id",
  z
    .object({
      ...Object.fromEntries(
        Object.entries(periodShape)
          .filter(([k]) => k !== "facultyId")
          .map(([k, v]) => [k, v.optional()]),
      ),
      revision,
      reason: reason.optional(),
    })
    .strict(),
  async (req, tx) => {
    const row = await found("researchPeriod", req.params.id, tx);
    ensure(
      scoped(req.user, row.facultyId),
      403,
      "ACTION_FORBIDDEN",
      "Ngoài phạm vi khoa.",
    );
    checkRevision(row, req.body.revision);
    const body = { ...row, ...req.body };
    periodValid(body);
    if (req.body.registrationEnd || req.body.registrationStart)
      reason.parse(req.body.reason);
    const teams = await tx.team.findMany({
      where: { periodId: row.id, status: "active" },
    });
    for (const team of teams)
      ensure(
        (await tx.teamMember.count({
          where: { teamId: team.id, active: true },
        })) <= body.maxMembers,
        409,
        "TEAM_SIZE_CONFLICT",
        "Giới hạn mới nhỏ hơn nhóm đang hoạt động.",
      );
    const { revision: _, reason: why, ...data } = req.body;
    const result = await tx.researchPeriod.update({
      where: { id: row.id },
      data: {
        ...data,
        ...(data.registrationStart
          ? { registrationStart: new Date(data.registrationStart) }
          : {}),
        ...(data.registrationEnd
          ? { registrationEnd: new Date(data.registrationEnd) }
          : {}),
        revision: { increment: 1 },
      },
    });
    await audit(tx, req.user, "period.updated", "researchPeriod", result, req, {
      reason: why,
    });
    return result;
  },
);
read(adminRouter, "/audit-logs", async (req, tx) => {
  requireRole(req.user, "faculty_staff", "admin");
  return paged(
    tx,
    "auditLog",
    has(req.user, "admin")
      ? {
          entityType: {
            in: [
              "user",
              "faculty",
              "major",
              "class",
              "researchField",
              "researchPeriod",
              "system",
            ],
          },
        }
      : { facultyId: { in: req.user.scopes } },
    req.query,
  );
});
