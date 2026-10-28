import { Router } from "express";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { read, write } from "./routes.js";
import {
  ensure,
  found,
  has,
  scoped,
  uid,
  revision,
  reason,
  checkRevision,
  checkState,
  editableStates,
  publicStates,
  terminalStates,
  academicShape,
  completeAcademic,
  pickAcademic,
  academicHash,
  json,
  paged,
  event,
  audit,
  notify,
  loadUser,
  hash,
  rateLimitHandler,
} from "./core.js";
import {
  topicAccess,
  access,
  currentStudent,
  staffFor,
  lecturerFor,
  editableTeam,
  closeTeam,
  temporalWhere,
} from "./permissions.js";
import {
  normalize,
  checkSimilarity,
  publishCorpus,
  similarityHistory,
} from "./similarity.js";
import { activateMember, removeMember } from "./teams.js";
import { milestoneTemplate } from "./admin.js";

export const topicsRouter = Router();
export const metadataSelect = {
  id: true,
  code: true,
  title: true,
  status: true,
  facultyId: true,
  periodId: true,
  fieldId: true,
  supervisorId: true,
  createdAt: true,
  approvedAt: true,
  completedAt: true,
};
export async function topicFilter(tx, user, query, privateList = false) {
  const where = privateList ? {} : { status: { in: publicStates } };
  if (privateList) {
    const members = await tx.teamMember.findMany({
        where: { studentId: user.id },
      }),
      grants = await tx.teamAccessGrant.findMany({
        where: {
          membershipId: { in: members.map((m) => m.id) },
          revokedAt: null,
        },
      });
    where.OR = [
      {
        teamId: {
          in: members
            .filter(
              (m) =>
                m.active ||
                grants.some(
                  (g) => g.membershipId === m.id && g.retainedAfterLeave,
                ),
            )
            .map((m) => m.teamId),
        },
      },
      ...(has(user, "lecturer")
        ? [
            { supervisorId: user.id },
            {
              id: {
                in: (
                  await tx.supervisionRequest.findMany({
                    where: {
                      lecturerId: user.id,
                      purpose: "initial",
                      status: { in: ["pending", "accepted"] },
                    },
                  })
                ).map((r) => r.topicId),
              },
              approvedAt: null,
            },
          ]
        : []),
      ...(has(user, "faculty_staff")
        ? [{ facultyId: { in: user.scopes } }]
        : []),
    ];
  }
  for (const key of ["facultyId", "periodId", "fieldId", "supervisorId"])
    if (query[key]) where[key] = uid.parse(query[key]);
  if (query.status) {
    const status = z
      .enum([
        ...editableStates,
        "submitted",
        ...publicStates,
        "rejected",
        "cancelled",
      ])
      .parse(query.status);
    where.AND = [...(where.AND ?? []), { status }];
  }
  if (query.search) {
    const search = z.string().max(250).parse(query.search);
    where.AND = [
      ...(where.AND ?? []),
      {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
        ],
      },
    ];
  }
  if (query.academicYear) {
    const periods = await tx.researchPeriod.findMany({
      where: { academicYear: z.string().max(20).parse(query.academicYear) },
    });
    where.AND = [
      ...(where.AND ?? []),
      { periodId: { in: periods.map((p) => p.id) } },
    ];
  }
  if (query.result) {
    const result = z
      .enum(["passed", "failed", "unassessed"])
      .parse(query.result);
    const evaluations = await tx.evaluation.findMany({
        orderBy: { version: "desc" },
      }),
      latest = new Map();
    for (const e of evaluations)
      if (!latest.has(e.topicId)) latest.set(e.topicId, e.result);
    where.AND = [
      ...(where.AND ?? []),
      result === "unassessed"
        ? { id: { notIn: [...latest.keys()] } }
        : {
            id: {
              in: [...latest].filter(([, v]) => v === result).map(([id]) => id),
            },
          },
    ];
  }
  return where;
}
export async function decorateMetadata(tx, rows) {
  const [faculties, fields, periods, lecturers] = await Promise.all([
    tx.faculty.findMany(),
    tx.researchField.findMany(),
    tx.researchPeriod.findMany(),
    tx.user.findMany({
      where: { id: { in: rows.map((t) => t.supervisorId).filter(Boolean) } },
      select: { id: true, fullName: true },
    }),
  ]);
  return rows.map((row) => ({
    ...row,
    facultyName: faculties.find((f) => f.id === row.facultyId)?.name,
    fieldName: fields.find((f) => f.id === row.fieldId)?.name,
    periodName: periods.find((f) => f.id === row.periodId)?.name,
    supervisorName: lecturers.find((f) => f.id === row.supervisorId)?.fullName,
  }));
}
function sortOrder(query) {
  const sort = z
    .enum(["createdAt", "-createdAt", "title", "-title", "code", "-code"])
    .default("-createdAt")
    .parse(query.sort);
  return { [sort.replace("-", "")]: sort.startsWith("-") ? "desc" : "asc" };
}
read(topicsRouter, "/topics", async (req, tx) => {
  const result = await paged(
    tx,
    "topic",
    await topicFilter(tx, req.user, req.query),
    req.query,
    sortOrder(req.query),
    metadataSelect,
  );
  result.data = await decorateMetadata(tx, result.data);
  return result;
});
read(topicsRouter, "/me/topics", async (req, tx) => {
  const result = await paged(
    tx,
    "topic",
    await topicFilter(tx, req.user, req.query, true),
    req.query,
    sortOrder(req.query),
    { ...metadataSelect, revision: true, teamId: true },
  );
  result.data = await decorateMetadata(tx, result.data);
  return result;
});
read(topicsRouter, "/topics/:id", async (req, tx) => {
  const topic = await found("topic", uid.parse(req.params.id), tx);
  ensure(
    publicStates.includes(topic.status) || (await access(tx, req.user, topic)),
    404,
    "RESOURCE_NOT_FOUND",
    "Không tìm thấy đề tài.",
  );
  return (
    await decorateMetadata(tx, [
      Object.fromEntries(Object.keys(metadataSelect).map((k) => [k, topic[k]])),
    ])
  )[0];
});
export async function visibleRevisions(tx, user, topic) {
  const rows = await tx.topicRevision.findMany({
      where: { topicId: topic.id },
      orderBy: { version: "desc" },
    }),
    visible = [];
  for (const row of rows)
    if (await access(tx, user, topic, row.publishedAt)) visible.push(row);
  return visible;
}
read(topicsRouter, "/topics/:id/workspace", async (req, tx) => {
  const topic = await topicAccess(tx, req.user, uid.parse(req.params.id));
  if (topic.accessMode === "historical") {
    const revisions = await visibleRevisions(tx, req.user, topic);
    ensure(
      revisions.length,
      404,
      "RESOURCE_NOT_FOUND",
      "Không có phiên bản trong khoảng quyền.",
    );
    return {
      ...(
        await decorateMetadata(tx, [
          Object.fromEntries(
            Object.keys(metadataSelect).map((k) => [k, topic[k]]),
          ),
        ])
      )[0],
      ...revisions[0].snapshot,
      accessMode: "historical",
      historicalOnly: true,
      revision: topic.revision,
      revisions,
      actions: [],
    };
  }
  const team = await found("team", topic.teamId, tx),
    members = await tx.teamMember.findMany({
      where: { teamId: team.id, active: true },
    });
  const users = await tx.user.findMany({
    where: { id: { in: members.map((m) => m.studentId) } },
    select: { id: true, fullName: true, accountCode: true },
  });
  const latestProgress = await tx.progressUpdate.findFirst({
    where: { topicId: topic.id },
    orderBy: { createdAt: "desc" },
  });
  return {
    ...(await decorateMetadata(tx, [topic]))[0],
    team: {
      ...team,
      members: members.map((m) => ({
        ...m,
        user: users.find((u) => u.id === m.studentId),
      })),
    },
    latestProgress,
    isLeader: team.leaderId === req.user.id,
    actions: {
      edit:
        team.leaderId === req.user.id && editableStates.includes(topic.status),
      staff: scoped(req.user, topic.facultyId),
      lecturer: topic.supervisorId === req.user.id,
    },
  };
});
write(
  topicsRouter,
  "post",
  "/topics",
  z
    .object({
      teamId: uid,
      ...academicShape,
      proposedSupervisorId: uid.optional(),
    })
    .strict(),
  async (req, tx) => {
    const team = await editableTeam(tx, req.user, req.body.teamId);
    ensure(
      !(await tx.topic.count({ where: { teamId: team.id } })),
      409,
      "TOPIC_EXISTS",
      "Mỗi nhóm chỉ có một hồ sơ.",
    );
    const field = await found("researchField", req.body.fieldId, tx);
    ensure(field.isActive, 422, "INACTIVE_FIELD", "Lĩnh vực đã ngừng sử dụng.");
    const period = await found("researchPeriod", team.periodId, tx),
      now = new Date();
    ensure(
      period.status === "open" &&
        period.registrationStart <= now &&
        period.registrationEnd >= now,
      422,
      "REGISTRATION_CLOSED",
      "Ngoài thời gian đăng ký.",
    );
    const seq =
      await tx.$queryRaw`SELECT nextval('topic_code_sequence') AS value`;
    const code = `NCKH-${new Date().getUTCFullYear()}-${String(seq[0].value).padStart(4, "0")}`;
    const topic = await tx.topic.create({
      data: {
        ...req.body,
        periodId: team.periodId,
        facultyId: team.facultyId,
        code,
        normalizedTitle: normalize(req.body.title),
      },
    });
    await event(tx, req.user, "topic.created", topic, req);
    return topic;
  },
  { status: 201, idempotency: true },
);
write(
  topicsRouter,
  "patch",
  "/topics/:id",
  z
    .object({
      ...Object.fromEntries(
        Object.entries(academicShape).map(([k, v]) => [k, v.optional()]),
      ),
      revision,
      proposedSupervisorId: uid.nullable().optional(),
    })
    .strict(),
  async (req, tx) => {
    const topic = await topicAccess(tx, req.user, req.params.id);
    await currentStudent(tx, req.user, topic, true);
    checkRevision(topic, req.body.revision);
    checkState(topic, editableStates);
    const { revision: _, ...data } = req.body;
    if (data.fieldId)
      ensure(
        (await found("researchField", data.fieldId, tx)).isActive,
        422,
        "INACTIVE_FIELD",
        "Lĩnh vực đã ngừng sử dụng.",
      );
    const result = await tx.topic.update({
      where: { id: topic.id },
      data: {
        ...data,
        ...(data.title ? { normalizedTitle: normalize(data.title) } : {}),
        revision: { increment: 1 },
      },
    });
    if (
      academicHash(topic) !== academicHash(result) ||
      topic.proposedSupervisorId !== result.proposedSupervisorId
    )
      await tx.supervisionRequest.updateMany({
        where: {
          topicId: topic.id,
          purpose: "initial",
          status: { in: ["accepted", "pending"] },
        },
        data: {
          status: "cancelled",
          respondedAt: new Date(),
          responseReason: "Nội dung hoặc giảng viên đề xuất đã thay đổi",
          revision: { increment: 1 },
        },
      });
    await event(tx, req.user, "topic.updated", result, req);
    return result;
  },
);
read(topicsRouter, "/topics/:id/revisions", async (req, tx) =>
  visibleRevisions(
    tx,
    req.user,
    await topicAccess(tx, req.user, req.params.id),
  ),
);
read(topicsRouter, "/topics/:id/revisions/:version", async (req, tx) => {
  const topic = await topicAccess(tx, req.user, req.params.id),
    row = await tx.topicRevision.findUnique({
      where: {
        topicId_version: {
          topicId: topic.id,
          version: z.coerce.number().int().positive().parse(req.params.version),
        },
      },
    });
  ensure(
    row && (await access(tx, req.user, topic, row.publishedAt)),
    404,
    "RESOURCE_NOT_FOUND",
    "Phiên bản ngoài khoảng quyền.",
  );
  const links = await tx.topicRevisionFile.findMany({
    where: { topicRevisionId: row.id },
  });
  return {
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
  };
});
export async function snapshot(
  tx,
  topic,
  user,
  kind = "submission",
  checkId = null,
  changeId = null,
  attachmentIds = [],
) {
  const team = await found("team", topic.teamId, tx),
    members = await tx.teamMember.findMany({
      where: { teamId: team.id, active: true },
    }),
    users = await tx.user.findMany({
      where: { id: { in: members.map((m) => m.studentId) } },
      select: { id: true, accountCode: true, fullName: true },
    });
  const updated = await tx.topic.update({
    where: { id: topic.id },
    data: { revisionSequence: { increment: 1 } },
  });
  const row = await tx.topicRevision.create({
    data: {
      topicId: topic.id,
      version: updated.revisionSequence,
      kind,
      snapshot: json({
        ...pickAcademic(topic),
        teamId: team.id,
        teamName: team.name,
        leaderId: team.leaderId,
        members: users,
        periodId: topic.periodId,
        facultyId: topic.facultyId,
        supervisorId: topic.supervisorId ?? topic.proposedSupervisorId,
      }),
      createdBy: user.id,
      publishedAt: new Date(Date.now() + 1),
      similarityCheckId: checkId,
      sourceChangeRequestId: changeId,
    },
  });
  for (const attachmentId of attachmentIds)
    await tx.topicRevisionFile.create({
      data: { topicRevisionId: row.id, attachmentId, topicId: topic.id },
    });
  await tx.topic.update({
    where: { id: topic.id },
    data: { currentRevisionId: row.id },
  });
  return row;
}
write(
  topicsRouter,
  "post",
  "/topics/:id/supervision-requests",
  z
    .object({ revision, lecturerId: uid, changeRequestId: uid.optional() })
    .strict(),
  async (req, tx) => {
    const topic = await topicAccess(tx, req.user, req.params.id);
    await currentStudent(tx, req.user, topic, true);
    checkRevision(topic, req.body.revision);
    let purpose = "initial";
    if (req.body.changeRequestId) {
      checkState(topic, ["approved", "in_progress"]);
      const c = await found("topicChangeRequest", req.body.changeRequestId, tx);
      ensure(
        c.topicId === topic.id &&
          c.status === "pending" &&
          c.type === "supervisor" &&
          c.afterData.supervisorId === req.body.lecturerId,
        422,
        "INVALID_CHANGE",
        "Yêu cầu thay giảng viên không hợp lệ.",
      );
      purpose = "replacement";
    } else checkState(topic, editableStates);
    const lecturer = await loadUser(req.body.lecturerId, tx);
    ensure(
      lecturer?.status === "active" && lecturer.roles.includes("lecturer"),
      422,
      "INVALID_LECTURER",
      "Giảng viên không hoạt động.",
    );
    ensure(
      !(await tx.teamMember.count({
        where: { teamId: topic.teamId, studentId: lecturer.id },
      })),
      403,
      "CONFLICT_OF_INTEREST",
      "Thành viên không được tự hướng dẫn đề tài.",
    );
    const period = await found("researchPeriod", topic.periodId, tx);
    if (purpose === "initial")
      ensure(
        period.status === "open" &&
          period.registrationStart <= new Date() &&
          period.registrationEnd > new Date(),
        422,
        "REGISTRATION_CLOSED",
        "Đợt không trong thời gian đề nghị hướng dẫn.",
      );
    const row = await tx.supervisionRequest.create({
      data: {
        topicId: topic.id,
        lecturerId: lecturer.id,
        requestedBy: req.user.id,
        purpose,
        changeRequestId: req.body.changeRequestId,
        academicHash: academicHash(topic),
        expiresAt:
          purpose === "initial"
            ? period.registrationEnd
            : new Date(Date.now() + 7 * 86400000),
      },
    });
    if (purpose === "initial")
      await tx.topic.update({
        where: { id: topic.id },
        data: { proposedSupervisorId: lecturer.id, revision: { increment: 1 } },
      });
    await notify(
      tx,
      [lecturer.id],
      "supervision",
      "Đề nghị hướng dẫn nghiên cứu",
      topic.title,
      topic,
      `supervision:${row.id}`,
    );
    await audit(tx, req.user, "supervision.requested", "topic", topic, req);
    return row;
  },
  { status: 201 },
);
read(topicsRouter, "/supervision-requests", async (req, tx) => {
  const ownTeams = await tx.team.findMany({ where: { leaderId: req.user.id } }),
    topics = await tx.topic.findMany({
      where: { teamId: { in: ownTeams.map((t) => t.id) } },
    });
  const rows = await tx.supervisionRequest.findMany({
    where: {
      OR: [
        { lecturerId: req.user.id },
        { topicId: { in: topics.map((t) => t.id) } },
        ...(has(req.user, "faculty_staff")
          ? [
              {
                topicId: {
                  in: (
                    await tx.topic.findMany({
                      where: { facultyId: { in: req.user.scopes } },
                      select: { id: true },
                    })
                  ).map((t) => t.id),
                },
              },
            ]
          : []),
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  return Promise.all(
    rows.map(async (r) => {
      const t = await found("topic", r.topicId, tx);
      const mode = await access(tx, req.user, t);
      let mayRead = mode && mode !== "historical";
      if (
        !mayRead &&
        r.purpose === "replacement" &&
        r.lecturerId === req.user.id &&
        ["pending", "accepted"].includes(r.status)
      ) {
        const c = await tx.topicChangeRequest.findUnique({
          where: { id: r.changeRequestId },
        });
        mayRead = c?.status === "pending";
      }
      return {
        ...r,
        academicHash: undefined,
        topic: {
          id: t.id,
          code: t.code,
          title: t.title,
          ...(mayRead ? pickAcademic(t) : {}),
        },
        lecturerName: (await found("user", r.lecturerId, tx)).fullName,
      };
    }),
  );
});
write(
  topicsRouter,
  "post",
  "/supervision-requests/:id/respond",
  z
    .object({
      revision,
      decision: z.enum(["accept", "decline"]),
      reason: reason.optional(),
    })
    .strict(),
  async (req, tx) => {
    const row = await found("supervisionRequest", req.params.id, tx);
    ensure(
      row.lecturerId === req.user.id && has(req.user, "lecturer"),
      403,
      "ACTION_FORBIDDEN",
      "Đề nghị không dành cho bạn.",
    );
    checkRevision(row, req.body.revision);
    checkState(row, ["pending"]);
    ensure(
      !row.expiresAt || row.expiresAt > new Date(),
      409,
      "REQUEST_EXPIRED",
      "Đề nghị đã hết hạn.",
    );
    const topic = await found("topic", row.topicId, tx);
    checkState(
      topic,
      row.purpose === "initial" ? editableStates : ["approved", "in_progress"],
    );
    ensure(
      row.academicHash === academicHash(topic),
      409,
      "PROPOSAL_CHANGED",
      "Nội dung đã thay đổi, cần gửi đề nghị mới.",
    );
    const result = await tx.supervisionRequest.update({
      where: { id: row.id },
      data: {
        status: req.body.decision === "accept" ? "accepted" : "declined",
        responseReason: req.body.reason,
        respondedAt: new Date(),
        revision: { increment: 1 },
      },
    });
    await notify(
      tx,
      [row.requestedBy],
      "supervision",
      "Phản hồi đề nghị hướng dẫn",
      req.body.decision === "accept"
        ? "Giảng viên đã đồng ý hướng dẫn."
        : "Giảng viên đã từ chối đề nghị.",
      topic,
      `supervision-response:${row.id}`,
    );
    await audit(tx, req.user, "supervision.responded", "topic", topic, req, {
      afterData: { requestId: row.id, status: result.status },
    });
    return result;
  },
);
write(
  topicsRouter,
  "post",
  "/supervision-requests/:id/cancel",
  z.object({ revision }).strict(),
  async (req, tx) => {
    const row = await found("supervisionRequest", req.params.id, tx),
      topic = await found("topic", row.topicId, tx);
    await currentStudent(tx, req.user, topic, true);
    checkRevision(row, req.body.revision);
    checkState(row, ["pending"]);
    return tx.supervisionRequest.update({
      where: { id: row.id },
      data: {
        status: "cancelled",
        respondedAt: new Date(),
        revision: { increment: 1 },
      },
    });
  },
);
read(topicsRouter, "/topics/:id/supervisor-assignments", async (req, tx) => {
  const topic = await topicAccess(tx, req.user, req.params.id);
  ensure(
    topic.accessMode !== "historical",
    403,
    "ACTION_FORBIDDEN",
    "Chỉ xem phân công trong phiên bản hồ sơ được cấp quyền.",
  );
  return tx.supervisorAssignment.findMany({
    where: { topicId: topic.id },
    orderBy: { startedAt: "desc" },
  });
});
topicsRouter.use(
  "/topics/:id/similarity-checks",
  rateLimit({
    windowMs: 60000,
    limit: 15,
    keyGenerator: (req) => req.user.id,
    handler: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
write(
  topicsRouter,
  "post",
  "/topics/:id/similarity-checks",
  z.object({ revision }).strict(),
  async (req, tx) => {
    const topic = await topicAccess(tx, req.user, req.params.id);
    checkRevision(topic, req.body.revision);
    if (!scoped(req.user, topic.facultyId))
      await currentStudent(tx, req.user, topic, true);
    return checkSimilarity(tx, req.user, topic);
  },
);
read(topicsRouter, "/topics/:id/similarity-checks", async (req, tx) => {
  const topic = await topicAccess(tx, req.user, req.params.id);
  if (!scoped(req.user, topic.facultyId))
    await currentStudent(tx, req.user, topic, true);
  return similarityHistory(tx, topic.id);
});
write(
  topicsRouter,
  "post",
  "/topics/:id/submit",
  z
    .object({ revision, attachmentIds: z.array(uid).max(5).default([]) })
    .strict(),
  async (req, tx) => {
    const topic = await topicAccess(tx, req.user, req.params.id),
      team = await currentStudent(tx, req.user, topic, true);
    checkRevision(topic, req.body.revision);
    checkState(topic, editableStates);
    completeAcademic.parse(topic);
    const period = await found("researchPeriod", topic.periodId, tx),
      now = new Date();
    ensure(
      period.status === "open" &&
        period.registrationStart <= now &&
        period.registrationEnd >= now,
      422,
      "REGISTRATION_CLOSED",
      "Ngoài thời gian đăng ký.",
    );
    const count = await tx.teamMember.count({
      where: { teamId: team.id, active: true },
    });
    ensure(
      count >= period.minMembers && count <= period.maxMembers,
      422,
      "TEAM_SIZE_INVALID",
      "Số thành viên không phù hợp cấu hình đợt.",
    );
    const consent = await tx.supervisionRequest.findFirst({
      where: {
        topicId: topic.id,
        lecturerId:
          topic.proposedSupervisorId ?? "00000000-0000-0000-0000-000000000000",
        purpose: "initial",
        status: "accepted",
        academicHash: academicHash(topic),
      },
      orderBy: { createdAt: "desc" },
    });
    const lecturer = consent && (await loadUser(consent.lecturerId, tx));
    ensure(
      lecturer?.status === "active" && lecturer.roles.includes("lecturer"),
      422,
      "SUPERVISOR_NOT_CONFIRMED",
      "Cần giảng viên xác nhận đúng nội dung hiện hành trước khi gửi.",
    );
    const ids = [...new Set(req.body.attachmentIds)];
    ensure(
      (await tx.attachment.count({
        where: {
          id: { in: ids },
          topicId: topic.id,
          purpose: "proposal",
          status: "ready",
        },
      })) === ids.length,
      422,
      "FILE_NOT_READY",
      "File đề xuất chưa sẵn sàng hoặc thuộc hồ sơ khác.",
    );
    const similarity = await checkSimilarity(tx, req.user, topic, "submit"),
      rev = await snapshot(
        tx,
        topic,
        req.user,
        "submission",
        similarity.id,
        null,
        ids,
      );
    const result = await tx.topic.update({
      where: { id: topic.id },
      data: {
        status: "submitted",
        submittedAt: now,
        revision: { increment: 1 },
      },
    });
    await event(tx, req.user, "topic.submitted", result, req);
    return {
      ...result,
      topicRevisionId: rev.id,
      topicRevisionVersion: rev.version,
      similarity,
    };
  },
  { idempotency: true },
);
write(
  topicsRouter,
  "post",
  "/topics/:id/decisions",
  z
    .object({
      revision,
      topicRevisionId: uid,
      action: z.enum(["approve", "request_revision", "reject"]),
      reason: reason.optional(),
      warningJustification: reason.optional(),
      milestones: z.array(milestoneTemplate).min(3).max(20).optional(),
    })
    .strict(),
  async (req, tx) => {
    const topic = await topicAccess(tx, req.user, req.params.id);
    await staffFor(tx, req.user, topic);
    checkRevision(topic, req.body.revision);
    checkState(topic, ["submitted"]);
    ensure(
      topic.currentRevisionId === req.body.topicRevisionId,
      409,
      "SNAPSHOT_CONFLICT",
      "Cần xem đúng phiên bản hồ sơ hiện hành trước khi quyết định.",
    );
    const rev = await found("topicRevision", req.body.topicRevisionId, tx);
    ensure(
      hash(pickAcademic(topic)) === hash(pickAcademic(rev.snapshot)),
      409,
      "SNAPSHOT_CONFLICT",
      "Hồ sơ không khớp phiên bản đã xem.",
    );
    let check;
    if (req.body.action === "approve") {
      const lecturer = await loadUser(topic.proposedSupervisorId, tx);
      ensure(
        lecturer?.status === "active" && lecturer.roles.includes("lecturer"),
        422,
        "SUPERVISOR_NOT_CONFIRMED",
        "Giảng viên không còn hoạt động.",
      );
      ensure(
        await tx.supervisionRequest.count({
          where: {
            topicId: topic.id,
            lecturerId: lecturer.id,
            purpose: "initial",
            status: "accepted",
            academicHash: academicHash(topic),
          },
        }),
        422,
        "SUPERVISOR_NOT_CONFIRMED",
        "Chưa xác nhận hướng dẫn nội dung hiện hành.",
      );
      check = await checkSimilarity(tx, req.user, topic, "approve");
      if (check.hasWarning) reason.parse(req.body.warningJustification);
      const period = await found("researchPeriod", topic.periodId, tx),
        milestones = req.body.milestones ?? period.milestoneTemplates;
      ensure(
        milestones.length >= 3 &&
          milestones.filter((m) => m.required).length >= 3 &&
          new Set(milestones.map((m) => m.code)).size === milestones.length,
        422,
        "MILESTONES_REQUIRED",
        "Cần ít nhất ba mốc bắt buộc có mã riêng.",
      );
      for (const m of milestones) {
        milestoneTemplate.parse(m);
        ensure(
          new Date(m.deadline) > new Date(),
          422,
          "MILESTONE_DEADLINE",
          "Hạn mốc phải sau thời điểm duyệt.",
        );
        await tx.milestone.create({
          data: { ...m, deadline: new Date(m.deadline), topicId: topic.id },
        });
      }
      await tx.supervisorAssignment.create({
        data: {
          topicId: topic.id,
          lecturerId: lecturer.id,
          assignedBy: req.user.id,
        },
      });
    } else reason.parse(req.body.reason);
    const decision = await tx.topicDecision.create({
      data: {
        topicRevisionId: rev.id,
        decidedBy: req.user.id,
        action: req.body.action,
        reason: req.body.reason,
        warningJustification: req.body.warningJustification,
        similarityCheckId: check?.id,
      },
    });
    const status = {
      approve: "approved",
      request_revision: "revision_required",
      reject: "rejected",
    }[req.body.action];
    const result = await tx.topic.update({
      where: { id: topic.id },
      data: {
        status,
        revision: { increment: 1 },
        ...(status === "approved"
          ? { supervisorId: topic.proposedSupervisorId, approvedAt: new Date() }
          : {}),
      },
    });
    await event(tx, req.user, `topic.${status}`, result, req, {
      reason: req.body.reason,
    });
    if (status === "rejected") await closeTeam(tx, result, "Hồ sơ bị từ chối");
    if (status === "approved") await publishCorpus(tx);
    return { topic: result, decision, similarity: check };
  },
  { status: 201, idempotency: true },
);
write(
  topicsRouter,
  "post",
  "/topics/:id/start",
  z.object({ revision }).strict(),
  async (req, tx) => {
    const topic = await topicAccess(tx, req.user, req.params.id);
    if (scoped(req.user, topic.facultyId)) await staffFor(tx, req.user, topic);
    else lecturerFor(req.user, topic);
    checkRevision(topic, req.body.revision);
    checkState(topic, ["approved"]);
    const result = await tx.topic.update({
      where: { id: topic.id },
      data: { status: "in_progress", revision: { increment: 1 } },
    });
    await event(tx, req.user, "topic.started", result, req);
    await publishCorpus(tx);
    return result;
  },
);
export async function readyForEvaluation(tx, topic) {
  const milestones = await tx.milestone.findMany({
    where: { topicId: topic.id, required: true },
  });
  ensure(
    milestones.length >= 3,
    422,
    "REQUIRED_MILESTONE_NOT_ACCEPTED",
    "Chưa có đủ mốc bắt buộc.",
  );
  for (const m of milestones) {
    const s = await tx.submission.findFirst({
      where: { milestoneId: m.id },
      orderBy: { version: "desc" },
    });
    ensure(
      s?.status === "accepted" && !m.resubmissionAllowed,
      422,
      "REQUIRED_MILESTONE_NOT_ACCEPTED",
      `Mốc “${m.name}” chưa có bản hiện hành được chấp nhận.`,
    );
  }
  ensure(
    !(await tx.topicChangeRequest.count({
      where: { topicId: topic.id, status: "pending" },
    })) &&
      !(await tx.topicCancellationRequest.count({
        where: { topicId: topic.id, status: "pending" },
      })),
    409,
    "PENDING_REQUEST",
    "Cần xử lý yêu cầu thay đổi/hủy đang chờ.",
  );
}
write(
  topicsRouter,
  "post",
  "/topics/:id/request-evaluation",
  z.object({ revision }).strict(),
  async (req, tx) => {
    const topic = await topicAccess(tx, req.user, req.params.id);
    await currentStudent(tx, req.user, topic, true);
    checkRevision(topic, req.body.revision);
    checkState(topic, ["in_progress"]);
    await readyForEvaluation(tx, topic);
    const result = await tx.topic.update({
      where: { id: topic.id },
      data: { status: "pending_evaluation", revision: { increment: 1 } },
    });
    await event(tx, req.user, "topic.evaluation_requested", result, req);
    await publishCorpus(tx);
    return result;
  },
  { idempotency: true },
);
write(
  topicsRouter,
  "post",
  "/topics/:id/return-to-progress",
  z
    .object({
      revision,
      reason,
      reopenMilestoneIds: z.array(uid).max(20).default([]),
    })
    .strict(),
  async (req, tx) => {
    const topic = await topicAccess(tx, req.user, req.params.id);
    lecturerFor(req.user, topic);
    checkRevision(topic, req.body.revision);
    checkState(topic, ["pending_evaluation"]);
    for (const id of req.body.reopenMilestoneIds) {
      const m = await found("milestone", id, tx);
      ensure(
        m.topicId === topic.id,
        422,
        "MILESTONE_MISMATCH",
        "Mốc không thuộc đề tài.",
      );
      await tx.milestone.update({
        where: { id },
        data: { resubmissionAllowed: true, revision: { increment: 1 } },
      });
    }
    const result = await tx.topic.update({
      where: { id: topic.id },
      data: { status: "in_progress", revision: { increment: 1 } },
    });
    await event(tx, req.user, "topic.returned_to_progress", result, req, {
      reason: req.body.reason,
    });
    await publishCorpus(tx);
    return result;
  },
);
export async function cancelTopic(tx, user, topic, why, req) {
  ensure(
    !terminalStates.includes(topic.status),
    409,
    "INVALID_TRANSITION",
    "Đề tài đã kết thúc.",
  );
  const wasPublic = publicStates.includes(topic.status);
  const result = await tx.topic.update({
    where: { id: topic.id },
    data: { status: "cancelled", revision: { increment: 1 } },
  });
  await event(tx, user, "topic.cancelled", result, req, { reason: why });
  await closeTeam(tx, result, why);
  await tx.topicChangeRequest.updateMany({
    where: { topicId: topic.id, status: "pending" },
    data: {
      status: "conflicted",
      decisionReason: "Đề tài đã hủy",
      decidedAt: new Date(),
    },
  });
  await tx.supervisionRequest.updateMany({
    where: { topicId: topic.id, status: "pending" },
    data: { status: "cancelled", respondedAt: new Date() },
  });
  if (wasPublic) await publishCorpus(tx);
  return result;
}
write(
  topicsRouter,
  "post",
  "/topics/:id/cancel",
  z.object({ revision, reason }).strict(),
  async (req, tx) => {
    const topic = await topicAccess(tx, req.user, req.params.id);
    await staffFor(tx, req.user, topic);
    checkRevision(topic, req.body.revision);
    return cancelTopic(tx, req.user, topic, req.body.reason, req);
  },
  { idempotency: true },
);

for (const [path, model] of [
  ["change-requests", "topicChangeRequest"],
  ["cancellation-requests", "topicCancellationRequest"],
]) {
  read(topicsRouter, `/topics/:id/${path}`, async (req, tx) => {
    const topic = await topicAccess(tx, req.user, req.params.id);
    const rows = await tx[model].findMany({
        where: { topicId: topic.id },
        orderBy: { createdAt: "desc" },
      }),
      visible = [];
    for (const row of rows) {
      if (!(await access(tx, req.user, topic, row.createdAt))) continue;
      if (model === "topicChangeRequest" && row.type === "members") {
        row.proposedMembers = await tx.user.findMany({
          where: { id: { in: row.afterData.memberIds } },
          select: { id: true, fullName: true, accountCode: true },
        });
      }
      if (model === "topicChangeRequest" && row.type === "supervisor") {
        row.proposedSupervisor = await tx.user.findUnique({
          where: { id: row.afterData.supervisorId },
          select: { id: true, fullName: true, facultyId: true },
        });
      }
      visible.push(row);
    }
    return visible;
  });
  write(
    topicsRouter,
    "post",
    `/${path}/:id/withdraw`,
    z.object({ revision }).strict(),
    async (req, tx) => {
      const row = await found(model, req.params.id, tx),
        topic = await topicAccess(tx, req.user, row.topicId);
      await currentStudent(tx, req.user, topic, true);
      ensure(
        row.requestedBy === req.user.id,
        403,
        "ACTION_FORBIDDEN",
        "Chỉ người yêu cầu được rút.",
      );
      checkRevision(row, req.body.revision);
      checkState(row, ["pending"]);
      const result = await tx[model].update({
        where: { id: row.id },
        data: { status: "withdrawn", revision: { increment: 1 } },
      });
      if (model === "topicChangeRequest") {
        await tx.teamInvitation.updateMany({
          where: { changeRequestId: row.id, status: "pending" },
          data: { status: "cancelled", respondedAt: new Date() },
        });
        await tx.supervisionRequest.updateMany({
          where: { changeRequestId: row.id, status: "pending" },
          data: { status: "cancelled", respondedAt: new Date() },
        });
      }
      await event(tx, req.user, `${path}.withdrawn`, topic, req);
      return result;
    },
  );
}
const memberChange = z
  .object({ memberIds: z.array(uid).min(1).max(20), leaderId: uid })
  .strict();
const supervisorChange = z.object({ supervisorId: uid }).strict();
write(
  topicsRouter,
  "post",
  "/topics/:id/change-requests",
  z
    .object({
      revision,
      type: z.enum(["academic", "members", "supervisor"]),
      afterData: z.record(z.string(), z.unknown()),
      reason,
    })
    .strict(),
  async (req, tx) => {
    const topic = await topicAccess(tx, req.user, req.params.id),
      team = await currentStudent(tx, req.user, topic, true);
    checkRevision(topic, req.body.revision);
    checkState(topic, ["approved", "in_progress"]);
    let beforeData, afterData;
    if (req.body.type === "academic") {
      afterData = completeAcademic.strict().parse(req.body.afterData);
      beforeData = pickAcademic(topic);
    }
    if (req.body.type === "members") {
      afterData = memberChange.parse(req.body.afterData);
      ensure(
        new Set(afterData.memberIds).size === afterData.memberIds.length &&
          afterData.memberIds.includes(afterData.leaderId),
        422,
        "INVALID_MEMBERS",
        "Danh sách thành viên/trưởng nhóm không hợp lệ.",
      );
      beforeData = {
        memberIds: (
          await tx.teamMember.findMany({
            where: { teamId: team.id, active: true },
          })
        ).map((m) => m.studentId),
        leaderId: team.leaderId,
      };
    }
    if (req.body.type === "supervisor") {
      afterData = supervisorChange.parse(req.body.afterData);
      ensure(
        afterData.supervisorId !== topic.supervisorId,
        422,
        "UNCHANGED_SUPERVISOR",
        "Giảng viên mới phải khác giảng viên hiện hành.",
      );
      beforeData = { supervisorId: topic.supervisorId };
    }
    const row = await tx.topicChangeRequest.create({
      data: {
        topicId: topic.id,
        requestedBy: req.user.id,
        type: req.body.type,
        beforeData,
        afterData,
        baseRevision: topic.revision,
        reason: req.body.reason,
      },
    });
    await event(tx, req.user, "change.requested", topic, req, {
      reason: req.body.reason,
    });
    return row;
  },
  { status: 201, idempotency: true },
);
write(
  topicsRouter,
  "post",
  "/change-requests/:id/decisions",
  z
    .object({
      revision,
      topicRevision: revision,
      decision: z.enum(["approve", "reject"]),
      reason,
      warningJustification: reason.optional(),
    })
    .strict(),
  async (req, tx) => {
    const row = await found("topicChangeRequest", req.params.id, tx),
      topic = await topicAccess(tx, req.user, row.topicId);
    await staffFor(tx, req.user, topic);
    checkRevision(row, req.body.revision);
    checkRevision(topic, req.body.topicRevision);
    checkState(row, ["pending"]);
    checkState(topic, ["approved", "in_progress"]);
    if (row.baseRevision !== topic.revision) {
      const result = await tx.topicChangeRequest.update({
        where: { id: row.id },
        data: {
          status: "conflicted",
          decisionReason: "Hồ sơ đã thay đổi so với lúc yêu cầu",
          decidedBy: req.user.id,
          decidedAt: new Date(),
          revision: { increment: 1 },
        },
      });
      await event(tx, req.user, "change.conflicted", topic, req);
      return { ...result, conflict: true };
    }
    let similarity;
    let updated = topic;
    if (req.body.decision === "approve") {
      const team = await found("team", topic.teamId, tx);
      if (row.type === "academic") {
        const after = completeAcademic.strict().parse(row.afterData);
        ensure(
          (await found("researchField", after.fieldId, tx)).isActive,
          422,
          "INACTIVE_FIELD",
          "Lĩnh vực không hoạt động.",
        );
        similarity = await checkSimilarity(
          tx,
          req.user,
          { ...topic, ...after },
          "change",
        );
        if (similarity.hasWarning) reason.parse(req.body.warningJustification);
        updated = await tx.topic.update({
          where: { id: topic.id },
          data: {
            ...after,
            normalizedTitle: normalize(after.title),
            revision: { increment: 1 },
          },
        });
      }
      if (row.type === "supervisor") {
        const after = supervisorChange.parse(row.afterData),
          lecturer = await loadUser(after.supervisorId, tx);
        ensure(
          lecturer?.status === "active" && lecturer.roles.includes("lecturer"),
          422,
          "INVALID_LECTURER",
          "Giảng viên mới không hoạt động.",
        );
        ensure(
          !(await tx.teamMember.count({
            where: { teamId: team.id, studentId: lecturer.id },
          })),
          403,
          "CONFLICT_OF_INTEREST",
          "Không được tự hướng dẫn đề tài mình tham gia.",
        );
        ensure(
          await tx.supervisionRequest.count({
            where: {
              topicId: topic.id,
              changeRequestId: row.id,
              purpose: "replacement",
              lecturerId: lecturer.id,
              status: "accepted",
              academicHash: academicHash(topic),
            },
          }),
          422,
          "SUPERVISOR_NOT_CONFIRMED",
          "Giảng viên mới chưa đồng ý hướng dẫn đúng nội dung.",
        );
        const now = new Date();
        await tx.supervisorAssignment.updateMany({
          where: { topicId: topic.id, endedAt: null },
          data: { endedAt: now },
        });
        await tx.supervisorAssignment.create({
          data: {
            topicId: topic.id,
            lecturerId: lecturer.id,
            assignedBy: req.user.id,
            reason: req.body.reason,
            startedAt: now,
          },
        });
        updated = await tx.topic.update({
          where: { id: topic.id },
          data: {
            supervisorId: lecturer.id,
            proposedSupervisorId: lecturer.id,
            revision: { increment: 1 },
          },
        });
      }
      if (row.type === "members") {
        const after = memberChange.parse(row.afterData),
          period = await found("researchPeriod", topic.periodId, tx);
        ensure(
          after.memberIds.length >= period.minMembers &&
            after.memberIds.length <= period.maxMembers,
          422,
          "TEAM_SIZE_INVALID",
          "Số thành viên ngoài giới hạn đợt.",
        );
        const current = await tx.teamMember.findMany({
            where: { teamId: team.id, active: true },
          }),
          add = after.memberIds.filter(
            (id) => !current.some((m) => m.studentId === id),
          ),
          remove = current.filter(
            (m) => !after.memberIds.includes(m.studentId),
          );
        for (const studentId of add)
          ensure(
            await tx.teamInvitation.count({
              where: {
                teamId: team.id,
                inviteeId: studentId,
                changeRequestId: row.id,
                purpose: "approved_change",
                status: "accepted",
              },
            }),
            422,
            "MEMBER_CONSENT_REQUIRED",
            "Thành viên mới cần đồng ý lời mời.",
          );
        // Free removed seats before allocation; the deferred leader invariant is checked at commit.
        await tx.team.update({
          where: { id: team.id },
          data: { leaderId: after.leaderId, revision: { increment: 1 } },
        });
        for (const member of remove)
          await removeMember(
            tx,
            { ...team, leaderId: after.leaderId },
            member.studentId,
            req.user.id,
            row.reason,
            true,
          );
        for (const id of add) await activateMember(tx, team, id, req.user.id);
        updated = await tx.topic.update({
          where: { id: topic.id },
          data: { revision: { increment: 1 } },
        });
      }
      const oldFiles = await tx.topicRevisionFile.findMany({
        where: { topicRevisionId: topic.currentRevisionId },
      });
      await snapshot(
        tx,
        updated,
        req.user,
        "approved_change",
        similarity?.id,
        row.id,
        oldFiles.map((f) => f.attachmentId),
      );
      await publishCorpus(tx);
    }
    const result = await tx.topicChangeRequest.update({
      where: { id: row.id },
      data: {
        status: req.body.decision === "approve" ? "approved" : "rejected",
        decidedBy: req.user.id,
        decisionReason: req.body.reason,
        decidedAt: new Date(),
        similarityCheckId: similarity?.id,
        revision: { increment: 1 },
      },
    });
    await event(tx, req.user, `change.${result.status}`, updated, req, {
      reason: req.body.reason,
      afterData: {
        warningJustification: req.body.warningJustification ?? null,
      },
    });
    return {
      request: result,
      topic: await tx.topic.findUnique({ where: { id: topic.id } }),
      similarity,
    };
  },
  { idempotency: true },
);
write(
  topicsRouter,
  "post",
  "/topics/:id/cancellation-requests",
  z.object({ revision, reason }).strict(),
  async (req, tx) => {
    const topic = await topicAccess(tx, req.user, req.params.id);
    await currentStudent(tx, req.user, topic, true);
    checkRevision(topic, req.body.revision);
    ensure(
      !terminalStates.includes(topic.status),
      409,
      "INVALID_TRANSITION",
      "Đề tài đã kết thúc.",
    );
    const row = await tx.topicCancellationRequest.create({
      data: {
        topicId: topic.id,
        requestedBy: req.user.id,
        reason: req.body.reason,
      },
    });
    await event(tx, req.user, "cancellation.requested", topic, req, {
      reason: req.body.reason,
    });
    return row;
  },
  { status: 201, idempotency: true },
);
write(
  topicsRouter,
  "post",
  "/cancellation-requests/:id/decisions",
  z
    .object({ revision, decision: z.enum(["approve", "reject"]), reason })
    .strict(),
  async (req, tx) => {
    const row = await found("topicCancellationRequest", req.params.id, tx),
      topic = await topicAccess(tx, req.user, row.topicId);
    await staffFor(tx, req.user, topic);
    checkRevision(row, req.body.revision);
    checkState(row, ["pending"]);
    ensure(
      !terminalStates.includes(topic.status),
      409,
      "INVALID_TRANSITION",
      "Đề tài đã kết thúc.",
    );
    const result = await tx.topicCancellationRequest.update({
      where: { id: row.id },
      data: {
        status: req.body.decision === "approve" ? "approved" : "rejected",
        decidedBy: req.user.id,
        decisionReason: req.body.reason,
        decidedAt: new Date(),
        revision: { increment: 1 },
      },
    });
    if (req.body.decision === "approve")
      await cancelTopic(tx, req.user, topic, req.body.reason, req);
    else
      await event(tx, req.user, "cancellation.rejected", topic, req, {
        reason: req.body.reason,
      });
    return result;
  },
  { idempotency: true },
);
read(topicsRouter, "/topics/:id/audit-logs", async (req, tx) => {
  const topic = await topicAccess(tx, req.user, req.params.id);
  const result = await paged(
      tx,
      "auditLog",
      { entityId: topic.id, ...(await temporalWhere(tx, req.user, topic)) },
      req.query,
    ),
    actors = await tx.user.findMany({
      where: { id: { in: result.data.map((r) => r.actorId).filter(Boolean) } },
      select: { id: true, fullName: true },
    });
  return {
    ...result,
    data: result.data.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      actorName:
        actors.find((a) => a.id === row.actorId)?.fullName ?? "Hệ thống",
      action: row.action,
      reason: row.reason,
      createdAt: row.createdAt,
    })),
  };
});
write(
  topicsRouter,
  "post",
  "/team-access-grants/:id/revoke",
  z.object({ reason }).strict(),
  async (req, tx) => {
    const grant = await found("teamAccessGrant", req.params.id, tx),
      member = await found("teamMember", grant.membershipId, tx),
      topic = await tx.topic.findUnique({ where: { teamId: member.teamId } });
    ensure(topic, 404, "RESOURCE_NOT_FOUND", "Không tìm thấy hồ sơ.");
    await staffFor(tx, req.user, topic);
    const result = await tx.teamAccessGrant.update({
      where: { id: grant.id },
      data: { revokedAt: new Date(), revokeReason: req.body.reason },
    });
    await event(tx, req.user, "access.revoked", topic, req, {
      reason: req.body.reason,
    });
    return result;
  },
);
read(topicsRouter, "/topics/:id/access-grants", async (req, tx) => {
  const topic = await topicAccess(tx, req.user, req.params.id);
  await staffFor(tx, req.user, topic);
  const members = await tx.teamMember.findMany({
      where: { teamId: topic.teamId },
    }),
    rows = [];
  for (const m of members) {
    const user = await tx.user.findUnique({
      where: { id: m.studentId },
      select: { fullName: true, accountCode: true },
    });
    const grants = await tx.teamAccessGrant.findMany({
      where: { membershipId: m.id },
      orderBy: { readableFrom: "asc" },
    });
    for (const grant of grants)
      rows.push({ ...grant, student: user, activeMembership: m.active });
  }
  return rows;
});
