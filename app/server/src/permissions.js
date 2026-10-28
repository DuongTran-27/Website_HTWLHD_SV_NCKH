import {
  ensure,
  found,
  has,
  scoped,
  checkState,
  editableStates,
  terminalStates,
} from "./core.js";

export async function access(tx, user, topic, at = null) {
  if (scoped(user, topic.facultyId)) return "staff";
  if (has(user, "lecturer") && topic.supervisorId === user.id)
    return "lecturer";
  // Initial assignees may inspect the proposal to decide whether to accept.
  if (
    !topic.approvedAt &&
    !terminalStates.includes(topic.status) &&
    has(user, "lecturer")
  ) {
    const request = await tx.supervisionRequest.findFirst({
      where: {
        topicId: topic.id,
        lecturerId: user.id,
        purpose: "initial",
        status: { in: ["pending", "accepted"] },
      },
    });
    if (request) return "proposal_lecturer";
  }
  const member = await tx.teamMember.findUnique({
    where: { teamId_studentId: { teamId: topic.teamId, studentId: user.id } },
  });
  if (!member) return null;
  const grants = await tx.teamAccessGrant.findMany({
    where: { membershipId: member.id, revokedAt: null },
  });
  if (at)
    return grants.some(
      (g) =>
        g.readableFrom <= at &&
        (!g.readableUntil || g.readableUntil > at) &&
        (member.active || g.retainedAfterLeave),
    )
      ? member.active
        ? "student"
        : "historical"
      : null;
  if (member.active && !terminalStates.includes(topic.status)) return "student";
  return grants.some((g) => g.retainedAfterLeave) ? "historical" : null;
}
export async function topicAccess(tx, user, id, at = null) {
  const topic = await found("topic", id, tx);
  const mode = await access(tx, user, topic, at);
  ensure(
    mode,
    404,
    "RESOURCE_NOT_FOUND",
    "Không tìm thấy hồ sơ được phép truy cập.",
  );
  return { ...topic, accessMode: mode };
}
export async function temporalWhere(tx, user, topic, field = "createdAt") {
  if (
    scoped(user, topic.facultyId) ||
    (has(user, "lecturer") && topic.supervisorId === user.id)
  )
    return {};
  if (
    !topic.approvedAt &&
    (await access(tx, user, topic)) === "proposal_lecturer"
  )
    return {};
  const member = await tx.teamMember.findUnique({
    where: { teamId_studentId: { teamId: topic.teamId, studentId: user.id } },
  });
  if (!member) return { id: { in: [] } };
  const grants = await tx.teamAccessGrant.findMany({
    where: {
      membershipId: member.id,
      revokedAt: null,
      ...(!member.active ? { retainedAfterLeave: true } : {}),
    },
  });
  return {
    OR: grants.map((g) => ({
      [field]: {
        gte: g.readableFrom,
        ...(g.readableUntil ? { lt: g.readableUntil } : {}),
      },
    })),
  };
}
export async function currentStudent(tx, user, topic, leader = false) {
  ensure(
    has(user, "student"),
    403,
    "ACTION_FORBIDDEN",
    "Thao tác dành cho sinh viên trong nhóm.",
  );
  const [team, member] = await Promise.all([
    found("team", topic.teamId, tx),
    tx.teamMember.findUnique({
      where: { teamId_studentId: { teamId: topic.teamId, studentId: user.id } },
    }),
  ]);
  ensure(
    team.status === "active" &&
      member?.active &&
      (!leader || team.leaderId === user.id),
    403,
    "ACTION_FORBIDDEN",
    leader
      ? "Chỉ trưởng nhóm hiện hành được thao tác."
      : "Bạn không phải thành viên hiện hành.",
  );
  return team;
}
export async function staffFor(tx, user, topic) {
  ensure(
    scoped(user, topic.facultyId),
    403,
    "ACTION_FORBIDDEN",
    "Thao tác nằm ngoài phạm vi khoa được cấp.",
  );
  const member = await tx.teamMember.findUnique({
    where: { teamId_studentId: { teamId: topic.teamId, studentId: user.id } },
  });
  ensure(
    !member,
    403,
    "CONFLICT_OF_INTEREST",
    "Không được quyết định hồ sơ mà mình tham gia.",
  );
}
export const lecturerFor = (user, topic) =>
  ensure(
    has(user, "lecturer") && topic.supervisorId === user.id,
    403,
    "ACTION_FORBIDDEN",
    "Chỉ giảng viên hướng dẫn hiện hành được thao tác.",
  );
export async function teamAccess(tx, user, id) {
  const team = await found("team", id, tx);
  const member = await tx.teamMember.findUnique({
    where: { teamId_studentId: { teamId: id, studentId: user.id } },
  });
  ensure(
    scoped(user, team.facultyId) ||
      member?.active ||
      (await tx.teamAccessGrant.count({
        where: {
          membershipId: member?.id ?? "00000000-0000-0000-0000-000000000000",
          retainedAfterLeave: true,
          revokedAt: null,
        },
      })) > 0,
    404,
    "RESOURCE_NOT_FOUND",
    "Không tìm thấy nhóm được phép truy cập.",
  );
  return team;
}
export async function editableTeam(tx, user, id, rev) {
  const team = await teamAccess(tx, user, id);
  ensure(
    team.leaderId === user.id && team.status === "active",
    403,
    "ACTION_FORBIDDEN",
    "Chỉ trưởng nhóm hiện hành được thao tác.",
  );
  const topic = await tx.topic.findUnique({ where: { teamId: id } });
  if (topic) checkState(topic, editableStates);
  if (rev !== undefined)
    ensure(
      team.revision === rev,
      409,
      "REVISION_CONFLICT",
      "Nhóm đã thay đổi, vui lòng tải lại.",
    );
  return team;
}
export async function closeTeam(tx, topic, reason) {
  const now = new Date();
  await tx.team.update({
    where: { id: topic.teamId },
    data: {
      status: "closed",
      closedReason: reason,
      revision: { increment: 1 },
    },
  });
  const members = await tx.teamMember.findMany({
    where: { teamId: topic.teamId, active: true },
  });
  for (const member of members) {
    await tx.teamMember.update({
      where: { id: member.id },
      data: {
        active: false,
        leftAt: now,
        leftReason: reason,
        revision: { increment: 1 },
      },
    });
    await tx.teamAccessGrant.updateMany({
      where: { membershipId: member.id, readableUntil: null, revokedAt: null },
      data: {
        readableUntil: now,
        retainedAfterLeave: !!topic.approvedAt,
        ...(!topic.approvedAt ? { revokedAt: now, revokeReason: reason } : {}),
      },
    });
  }
  await tx.teamInvitation.updateMany({
    where: { teamId: topic.teamId, status: "pending" },
    data: { status: "cancelled", respondedAt: now },
  });
}
