import { Router } from "express";
import { z } from "zod";
import { read, write } from "./routes.js";
import {
  ensure,
  found,
  has,
  scoped,
  requireRole,
  uid,
  revision,
  reason,
  checkRevision,
  checkState,
  editableStates,
  audit,
  notify,
  loadUser,
  transaction,
} from "./core.js";
import { teamAccess, editableTeam } from "./permissions.js";
export const teamsRouter = Router();

export async function activateMember(tx, team, studentId, actorId) {
  const period = await found("researchPeriod", team.periodId, tx),
    student = await loadUser(studentId, tx);
  ensure(
    student?.status === "active" &&
      student.roles.includes("student") &&
      student.facultyId === team.facultyId,
    422,
    "FACULTY_MISMATCH",
    "Thành viên phải là sinh viên hoạt động cùng khoa.",
  );
  ensure(
    !(await tx.teamMember.count({
      where: { periodId: team.periodId, studentId, active: true },
    })),
    409,
    "MEMBER_ALREADY_ACTIVE",
    "Sinh viên đã tham gia một nhóm hoạt động trong đợt.",
  );
  ensure(
    (await tx.teamMember.count({ where: { teamId: team.id, active: true } })) <
      period.maxMembers,
    409,
    "TEAM_FULL",
    "Nhóm đã đủ số thành viên.",
  );
  const now = new Date();
  const member = await tx.teamMember.upsert({
    where: { teamId_studentId: { teamId: team.id, studentId } },
    create: {
      teamId: team.id,
      studentId,
      periodId: team.periodId,
      joinedAt: now,
    },
    update: {
      active: true,
      joinedAt: now,
      leftAt: null,
      leftReason: null,
      revision: { increment: 1 },
    },
  });
  await tx.teamAccessGrant.create({
    data: { membershipId: member.id, readableFrom: now, grantedBy: actorId },
  });
  return member;
}
export async function removeMember(
  tx,
  team,
  studentId,
  actorId,
  why,
  retained = false,
) {
  ensure(
    team.leaderId !== studentId,
    409,
    "LEADER_MUST_TRANSFER",
    "Cần chuyển trưởng nhóm trước khi rời hoặc bị loại.",
  );
  const member = await tx.teamMember.findUnique({
    where: { teamId_studentId: { teamId: team.id, studentId } },
  });
  ensure(
    member?.active,
    409,
    "MEMBER_NOT_ACTIVE",
    "Thành viên không còn hoạt động.",
  );
  const now = new Date();
  await tx.teamMember.update({
    where: { id: member.id },
    data: {
      active: false,
      leftAt: now,
      leftReason: why,
      revision: { increment: 1 },
    },
  });
  await tx.teamAccessGrant.updateMany({
    where: { membershipId: member.id, readableUntil: null, revokedAt: null },
    data: {
      readableUntil: now,
      retainedAfterLeave: retained,
      ...(!retained ? { revokedAt: now, revokeReason: why } : {}),
    },
  });
  if (!retained)
    await tx.teamAccessGrant.updateMany({
      where: { membershipId: member.id, revokedAt: null },
      data: { revokedAt: now, revokeReason: why },
    });
  await tx.team.update({
    where: { id: team.id },
    data: { revision: { increment: 1 } },
  });
}
async function teamDetails(tx, team, user) {
  const members = await tx.teamMember.findMany({ where: { teamId: team.id } });
  const current =
    members.some((m) => m.studentId === user.id && m.active) ||
    scoped(user, team.facultyId);
  // Former members use the version-controlled topic workspace instead of current roster.
  if (!current)
    return { ...team, members: [], invitations: [], historicalOnly: true };
  const users = await tx.user.findMany({
    where: { id: { in: members.map((m) => m.studentId) } },
    select: { id: true, fullName: true, accountCode: true },
  });
  const invitations =
    team.leaderId === user.id || scoped(user, team.facultyId)
      ? await tx.teamInvitation.findMany({
          where: { teamId: team.id },
          orderBy: { createdAt: "desc" },
        })
      : [];
  return {
    ...team,
    members: members.map((m) => ({
      ...m,
      user: users.find((u) => u.id === m.studentId),
    })),
    invitations,
    topic: await tx.topic.findUnique({
      where: { teamId: team.id },
      select: { id: true, title: true, status: true },
    }),
  };
}
read(teamsRouter, "/teams", async (req, tx) => {
  requireRole(req.user, "student", "faculty_staff");
  let where;
  if (has(req.user, "faculty_staff"))
    where = { facultyId: { in: req.user.scopes } };
  else {
    const ms = await tx.teamMember.findMany({
      where: { studentId: req.user.id },
    });
    const grants = await tx.teamAccessGrant.findMany({
      where: { membershipId: { in: ms.map((m) => m.id) }, revokedAt: null },
    });
    where = {
      id: {
        in: ms
          .filter(
            (m) =>
              m.active ||
              grants.some(
                (g) => g.membershipId === m.id && g.retainedAfterLeave,
              ),
          )
          .map((m) => m.teamId),
      },
    };
  }
  const teams = await tx.team.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return Promise.all(teams.map((t) => teamDetails(tx, t, req.user)));
});
read(teamsRouter, "/teams/:id", async (req, tx) =>
  teamDetails(
    tx,
    await teamAccess(tx, req.user, uid.parse(req.params.id)),
    req.user,
  ),
);
write(
  teamsRouter,
  "post",
  "/teams",
  z.object({ periodId: uid, name: z.string().trim().min(3).max(200) }).strict(),
  async (req, tx) => {
    requireRole(req.user, "student");
    const period = await found("researchPeriod", req.body.periodId, tx),
      now = new Date();
    ensure(
      period.facultyId === req.user.facultyId &&
        period.status === "open" &&
        period.registrationStart <= now &&
        period.registrationEnd >= now,
      422,
      "REGISTRATION_CLOSED",
      "Đợt không thuộc khoa hoặc ngoài thời gian đăng ký.",
    );
    const team = await tx.team.create({
      data: {
        name: req.body.name,
        periodId: period.id,
        facultyId: period.facultyId,
        leaderId: req.user.id,
      },
    });
    await activateMember(tx, team, req.user.id, req.user.id);
    await audit(tx, req.user, "team.created", "team", team, req);
    return team;
  },
  { status: 201, idempotency: true },
);
write(
  teamsRouter,
  "patch",
  "/teams/:id",
  z.object({ revision, name: z.string().trim().min(3).max(200) }).strict(),
  async (req, tx) => {
    const team = await editableTeam(
      tx,
      req.user,
      req.params.id,
      req.body.revision,
    );
    const result = await tx.team.update({
      where: { id: team.id },
      data: { name: req.body.name, revision: { increment: 1 } },
    });
    await audit(tx, req.user, "team.renamed", "team", result, req);
    return result;
  },
);
write(
  teamsRouter,
  "post",
  "/teams/:id/invitations",
  z
    .object({ revision, inviteeId: uid, changeRequestId: uid.optional() })
    .strict(),
  async (req, tx) => {
    const team = await teamAccess(tx, req.user, req.params.id);
    ensure(
      team.leaderId === req.user.id && team.status === "active",
      403,
      "ACTION_FORBIDDEN",
      "Chỉ trưởng nhóm hiện hành được mời.",
    );
    checkRevision(team, req.body.revision);
    const topic = await tx.topic.findUnique({ where: { teamId: team.id } });
    let purpose = "initial";
    if (topic && !editableStates.includes(topic.status)) {
      checkState(topic, ["approved", "in_progress"]);
      ensure(
        req.body.changeRequestId,
        422,
        "CHANGE_REQUIRED",
        "Cần yêu cầu thay đổi thành viên.",
      );
      const change = await found(
        "topicChangeRequest",
        req.body.changeRequestId,
        tx,
      );
      ensure(
        change.topicId === topic.id &&
          change.type === "members" &&
          change.status === "pending" &&
          change.afterData.memberIds.includes(req.body.inviteeId),
        422,
        "INVALID_CHANGE",
        "Lời mời không thuộc yêu cầu thay đổi.",
      );
      purpose = "approved_change";
    }
    const student = await loadUser(req.body.inviteeId, tx);
    ensure(
      student?.roles.includes("student") &&
        student.status === "active" &&
        student.facultyId === team.facultyId,
      422,
      "FACULTY_MISMATCH",
      "Cần sinh viên hoạt động cùng khoa.",
    );
    ensure(
      !(await tx.teamMember.count({
        where: { teamId: team.id, studentId: student.id, active: true },
      })),
      409,
      "ALREADY_MEMBER",
      "Sinh viên đã ở trong nhóm.",
    );
    const period = await found("researchPeriod", team.periodId, tx);
    if (purpose === "initial")
      ensure(
        period.status === "open" &&
          period.registrationStart <= new Date() &&
          period.registrationEnd > new Date(),
        422,
        "REGISTRATION_CLOSED",
        "Đợt không trong thời gian nhận thành viên.",
      );
    const expiresAt =
      purpose === "initial"
        ? period.registrationEnd
        : new Date(Date.now() + 7 * 86400000);
    ensure(
      expiresAt > new Date(),
      422,
      "INVITATION_EXPIRED",
      "Đã hết thời hạn mời thành viên.",
    );
    const invitation = await tx.teamInvitation.create({
      data: {
        teamId: team.id,
        inviteeId: student.id,
        invitedBy: req.user.id,
        purpose,
        changeRequestId: req.body.changeRequestId,
        expiresAt,
      },
    });
    await tx.team.update({
      where: { id: team.id },
      data: { revision: { increment: 1 } },
    });
    await audit(tx, req.user, "team.invited", "team", team, req, {
      afterData: { inviteeId: student.id },
    });
    await notify(
      tx,
      [student.id],
      "invitation",
      "Lời mời tham gia nhóm",
      `Bạn được mời vào ${team.name}.`,
      team,
      `invitation:${invitation.id}`,
    );
    return invitation;
  },
  { status: 201 },
);
read(teamsRouter, "/team-invitations", async (req, tx) => {
  const teams = await tx.team.findMany({ where: { leaderId: req.user.id } });
  const invites = await tx.teamInvitation.findMany({
    where: {
      OR: [
        { inviteeId: req.user.id },
        { teamId: { in: teams.map((t) => t.id) } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  return Promise.all(
    invites.map(async (i) => ({
      ...i,
      team: await tx.team.findUnique({
        where: { id: i.teamId },
        select: { id: true, name: true },
      }),
    })),
  );
});
write(
  teamsRouter,
  "post",
  "/team-invitations/:id/respond",
  z
    .object({
      revision,
      decision: z.enum(["accept", "decline"]),
      reason: reason.optional(),
    })
    .strict(),
  async (req, tx) => {
    const invite = await found("teamInvitation", req.params.id, tx);
    ensure(
      invite.inviteeId === req.user.id,
      403,
      "ACTION_FORBIDDEN",
      "Lời mời không dành cho bạn.",
    );
    checkRevision(invite, req.body.revision);
    checkState(invite, ["pending"]);
    ensure(
      invite.expiresAt > new Date(),
      409,
      "INVITATION_EXPIRED",
      "Lời mời đã hết hạn.",
    );
    const team = await found("team", invite.teamId, tx);
    checkState(team, ["active"]);
    if (req.body.decision === "accept") {
      if (invite.purpose === "initial") {
        const period = await found("researchPeriod", team.periodId, tx);
        ensure(
          period.status === "open" &&
            period.registrationStart <= new Date() &&
            period.registrationEnd > new Date(),
          422,
          "REGISTRATION_CLOSED",
          "Đợt không trong thời gian nhận thành viên.",
        );
        const topic = await tx.topic.findUnique({ where: { teamId: team.id } });
        if (topic) checkState(topic, editableStates);
        await activateMember(tx, team, req.user.id, req.user.id);
      } else {
        const change = await found(
          "topicChangeRequest",
          invite.changeRequestId,
          tx,
        );
        checkState(change, ["pending"]);
        ensure(
          req.user.facultyId === team.facultyId,
          422,
          "FACULTY_MISMATCH",
          "Sinh viên đã đổi khoa.",
        );
      }
    }
    const result = await tx.teamInvitation.update({
      where: { id: invite.id },
      data: {
        status: req.body.decision === "accept" ? "accepted" : "declined",
        respondedAt: new Date(),
        responseReason: req.body.reason,
        revision: { increment: 1 },
      },
    });
    await tx.team.update({
      where: { id: team.id },
      data: { revision: { increment: 1 } },
    });
    await audit(tx, req.user, "team.invitation_responded", "team", team, req, {
      afterData: { invitationId: invite.id, status: result.status },
    });
    await notify(
      tx,
      [team.leaderId],
      "invitation",
      "Lời mời đã được phản hồi",
      `${req.user.fullName}: ${result.status === "accepted" ? "đồng ý" : "từ chối"}.`,
      team,
      `invitation-response:${invite.id}`,
    );
    return result;
  },
  { idempotency: true },
);
write(
  teamsRouter,
  "post",
  "/team-invitations/:id/cancel",
  z.object({ revision }).strict(),
  async (req, tx) => {
    const invite = await found("teamInvitation", req.params.id, tx),
      team = await found("team", invite.teamId, tx);
    ensure(
      team.leaderId === req.user.id,
      403,
      "ACTION_FORBIDDEN",
      "Chỉ trưởng nhóm được thu hồi.",
    );
    checkRevision(invite, req.body.revision);
    checkState(invite, ["pending"]);
    return tx.teamInvitation.update({
      where: { id: invite.id },
      data: {
        status: "cancelled",
        respondedAt: new Date(),
        revision: { increment: 1 },
      },
    });
  },
);
write(
  teamsRouter,
  "post",
  "/teams/:id/transfer-leadership",
  z.object({ revision, newLeaderId: uid }).strict(),
  async (req, tx) => {
    const team = await editableTeam(
      tx,
      req.user,
      req.params.id,
      req.body.revision,
    );
    ensure(
      await tx.teamMember.count({
        where: {
          teamId: team.id,
          studentId: req.body.newLeaderId,
          active: true,
        },
      }),
      422,
      "INVALID_LEADER",
      "Trưởng nhóm mới phải là thành viên hiện hành.",
    );
    const result = await tx.team.update({
      where: { id: team.id },
      data: { leaderId: req.body.newLeaderId, revision: { increment: 1 } },
    });
    await audit(tx, req.user, "team.leader_transferred", "team", result, req, {
      beforeData: { leaderId: team.leaderId },
      afterData: { leaderId: result.leaderId },
    });
    return result;
  },
);
write(
  teamsRouter,
  "post",
  "/teams/:id/leave",
  z.object({ revision, reason: reason.optional() }).strict(),
  async (req, tx) => {
    const team = await teamAccess(tx, req.user, req.params.id);
    checkRevision(team, req.body.revision);
    checkState(team, ["active"]);
    const topic = await tx.topic.findUnique({ where: { teamId: team.id } });
    if (topic) checkState(topic, editableStates);
    await removeMember(
      tx,
      team,
      req.user.id,
      req.user.id,
      req.body.reason ?? "Thành viên tự rời nhóm trước duyệt",
    );
    await audit(tx, req.user, "team.member_left", "team", team, req);
    return { left: true };
  },
);
teamsRouter.delete("/teams/:id/members/:studentId", async (req, res) => {
  const id = uid.parse(req.params.id),
    rev = revision.parse(Number(req.query.revision)),
    why = reason.parse(req.query.reason);
  await transaction(async (tx) => {
    const team = await editableTeam(tx, req.user, id, rev);
    await removeMember(
      tx,
      team,
      uid.parse(req.params.studentId),
      req.user.id,
      why,
    );
    await audit(tx, req.user, "team.member_removed", "team", team, req, {
      reason: why,
    });
  });
  res.status(204).end();
});
write(
  teamsRouter,
  "post",
  "/teams/:id/close",
  z.object({ revision, reason }).strict(),
  async (req, tx) => {
    const team = await editableTeam(
      tx,
      req.user,
      req.params.id,
      req.body.revision,
    );
    ensure(
      !(await tx.topic.count({ where: { teamId: team.id } })),
      409,
      "TOPIC_EXISTS",
      "Nhóm đã có hồ sơ; cần đi qua quy trình hủy.",
    );
    const now = new Date();
    await tx.team.update({
      where: { id: team.id },
      data: {
        status: "closed",
        closedReason: req.body.reason,
        revision: { increment: 1 },
      },
    });
    const members = await tx.teamMember.findMany({
      where: { teamId: team.id, active: true },
    });
    await tx.teamMember.updateMany({
      where: { teamId: team.id, active: true },
      data: { active: false, leftAt: now, leftReason: req.body.reason },
    });
    await tx.teamAccessGrant.updateMany({
      where: { membershipId: { in: members.map((m) => m.id) } },
      data: {
        revokedAt: now,
        readableUntil: now,
        revokeReason: req.body.reason,
      },
    });
    await tx.teamInvitation.updateMany({
      where: { teamId: team.id, status: "pending" },
      data: { status: "cancelled", respondedAt: now },
    });
    await audit(tx, req.user, "team.closed", "team", team, req, {
      reason: req.body.reason,
    });
    return { closed: true };
  },
);
