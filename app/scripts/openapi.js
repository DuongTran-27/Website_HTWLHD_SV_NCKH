import { writeFileSync } from "node:fs";
import { z } from "zod";
import "../server/src/app.js";
import { registry } from "../server/src/routes.js";

const uuid = { type: "string", format: "uuid" },
  dateTime = { type: "string", format: "date-time" },
  revision = { type: "integer", minimum: 1 },
  string = { type: "string" },
  object = { type: "object", additionalProperties: true };
const schemas = {
  Error: {
    type: "object",
    required: ["error", "requestId"],
    properties: {
      error: {
        type: "object",
        required: ["code", "message"],
        properties: { code: string, message: string, details: object },
      },
      requestId: uuid,
    },
  },
  Metadata: {
    type: "object",
    required: [
      "id",
      "code",
      "title",
      "status",
      "facultyId",
      "periodId",
      "fieldId",
    ],
    properties: {
      id: uuid,
      code: { type: "string", pattern: "^NCKH-[0-9]{4}-[0-9]{4,}$" },
      title: string,
      status: { $ref: "#/components/schemas/TopicStatus" },
      facultyId: uuid,
      periodId: uuid,
      fieldId: uuid,
      supervisorId: { ...uuid, nullable: true },
      facultyName: string,
      fieldName: string,
      periodName: string,
      supervisorName: { ...string, nullable: true },
      createdAt: dateTime,
      approvedAt: { ...dateTime, nullable: true },
      completedAt: { ...dateTime, nullable: true },
    },
  },
  TopicStatus: {
    type: "string",
    enum: [
      "draft",
      "submitted",
      "revision_required",
      "approved",
      "in_progress",
      "pending_evaluation",
      "completed",
      "rejected",
      "cancelled",
    ],
  },
  User: {
    type: "object",
    required: ["id", "accountCode", "email", "fullName"],
    properties: {
      id: uuid,
      accountCode: string,
      email: { type: "string", format: "email" },
      fullName: string,
      facultyId: { ...uuid, nullable: true },
      classId: { ...uuid, nullable: true },
      avatarUrl: { type: ["string", "null"], format: "uri" },
      roles: {
        type: "array",
        items: {
          type: "string",
          enum: ["student", "lecturer", "faculty_staff", "admin"],
        },
      },
      scopes: { type: "array", items: uuid },
      status: { type: "string", enum: ["active", "locked"] },
      mustChangePassword: { type: "boolean" },
      revision,
    },
  },
  Session: {
    type: "object",
    required: ["accessToken", "expiresIn", "user"],
    properties: {
      accessToken: string,
      expiresIn: { type: "integer", const: 900 },
      user: { $ref: "#/components/schemas/User" },
    },
  },
  Attachment: {
    type: "object",
    required: ["id", "originalName", "sizeBytes", "mimeType", "status"],
    properties: {
      id: uuid,
      topicId: uuid,
      originalName: string,
      sizeBytes: { type: "integer", minimum: 1, maximum: 4000000 },
      mimeType: string,
      status: { type: "string", enum: ["pending", "ready", "failed"] },
      purpose: {
        type: "string",
        enum: ["proposal", "report", "private_image"],
      },
      createdAt: dateTime,
    },
  },
  Submission: {
    type: "object",
    required: [
      "id",
      "topicId",
      "milestoneId",
      "version",
      "status",
      "submittedAt",
      "deadlineSnapshot",
      "isLate",
      "revision",
    ],
    properties: {
      id: uuid,
      topicId: uuid,
      milestoneId: uuid,
      submittedBy: uuid,
      version: revision,
      status: {
        type: "string",
        enum: ["pending_review", "changes_requested", "accepted"],
      },
      submittedAt: dateTime,
      deadlineSnapshot: dateTime,
      isLate: { type: "boolean" },
      note: { ...string, nullable: true },
      revision,
      files: {
        type: "array",
        items: { $ref: "#/components/schemas/Attachment" },
      },
      reviews: {
        type: "array",
        items: { $ref: "#/components/schemas/Review" },
      },
    },
  },
  Review: {
    type: "object",
    required: [
      "id",
      "submissionId",
      "reviewerId",
      "comment",
      "decision",
      "createdAt",
    ],
    properties: {
      id: uuid,
      submissionId: uuid,
      reviewerId: uuid,
      comment: string,
      decision: {
        type: "string",
        enum: ["comment_only", "changes_requested", "accepted"],
      },
      supersedesReviewId: { ...uuid, nullable: true },
      createdAt: dateTime,
    },
  },
  Evaluation: {
    type: "object",
    required: [
      "id",
      "topicId",
      "version",
      "evaluatorId",
      "result",
      "comment",
      "createdAt",
    ],
    properties: {
      id: uuid,
      topicId: uuid,
      version: revision,
      evaluatorId: uuid,
      result: { type: "string", enum: ["passed", "failed"] },
      score: { type: ["string", "number", "null"] },
      comment: string,
      correctionReason: { ...string, nullable: true },
      supersedesId: { ...uuid, nullable: true },
      createdAt: dateTime,
    },
  },
  Milestone: {
    type: "object",
    properties: {
      id: uuid,
      topicId: uuid,
      code: string,
      name: string,
      expectedOutput: string,
      required: { type: "boolean" },
      deadline: dateTime,
      sortOrder: { type: "integer" },
      resubmissionAllowed: { type: "boolean" },
      revision,
      submissions: {
        type: "array",
        items: { $ref: "#/components/schemas/Submission" },
      },
    },
  },
  TopicRevision: {
    type: "object",
    properties: {
      id: uuid,
      topicId: uuid,
      version: revision,
      kind: { type: "string", enum: ["submission", "approved_change"] },
      snapshot: object,
      similarityCheckId: { ...uuid, nullable: true },
      publishedAt: dateTime,
      files: {
        type: "array",
        items: { $ref: "#/components/schemas/Attachment" },
      },
    },
  },
  Similarity: {
    type: "object",
    required: ["id", "status", "hasWarning", "matches"],
    properties: {
      id: uuid,
      status: { type: "string", enum: ["succeeded", "failed", "pending"] },
      hasWarning: { type: "boolean", nullable: true },
      exactTitleMatch: { type: "boolean", nullable: true },
      corpusVersion: { type: "integer" },
      corpusSize: { type: "integer" },
      algorithmVersion: string,
      configVersion: string,
      titleThreshold: { type: "number", minimum: 0, maximum: 1 },
      contentThreshold: { type: "number", minimum: 0, maximum: 1 },
      matches: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            topicId: uuid,
            code: string,
            title: string,
            titleScore: { type: "number", minimum: 0, maximum: 1 },
            contentScore: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
    },
  },
  Team: {
    type: "object",
    properties: {
      id: uuid,
      name: string,
      periodId: uuid,
      facultyId: uuid,
      leaderId: uuid,
      status: { type: "string", enum: ["active", "closed"] },
      revision,
      members: { type: "array", items: object },
      invitations: { type: "array", items: object },
    },
  },
  ResearchPeriod: {
    type: "object",
    properties: {
      id: uuid,
      name: string,
      facultyId: uuid,
      academicYear: string,
      status: { type: "string", enum: ["open", "closed"] },
      registrationStart: dateTime,
      registrationEnd: dateTime,
      minMembers: { type: "integer" },
      maxMembers: { type: "integer" },
      milestoneTemplates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            code: string,
            name: string,
            expectedOutput: string,
            deadline: dateTime,
            required: { type: "boolean" },
            sortOrder: { type: "integer" },
          },
        },
      },
      revision,
    },
  },
  Notification: {
    type: "object",
    properties: {
      id: uuid,
      title: string,
      body: string,
      type: string,
      entityType: string,
      entityId: { ...uuid, nullable: true },
      eventKey: string,
      readAt: { ...dateTime, nullable: true },
      createdAt: dateTime,
    },
  },
  Catalog: {
    type: "object",
    properties: {
      id: uuid,
      code: string,
      name: string,
      isActive: { type: "boolean" },
      revision,
      facultyId: uuid,
      majorId: uuid,
      admissionYear: { type: "integer" },
    },
  },
  Audit: {
    type: "object",
    properties: {
      id: uuid,
      actorId: { ...uuid, nullable: true },
      action: string,
      entityType: string,
      entityId: uuid,
      facultyId: { ...uuid, nullable: true },
      reason: { ...string, nullable: true },
      createdAt: dateTime,
    },
  },
  Report: {
    type: "object",
    required: ["total", "groupBy", "breakdown", "rows"],
    properties: {
      total: { type: "integer" },
      groupBy: string,
      breakdown: {
        type: "array",
        items: {
          type: "object",
          properties: { name: string, value: { type: "integer" } },
        },
      },
      rows: { type: "array", items: { $ref: "#/components/schemas/Metadata" } },
    },
  },
  Dashboard: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["student", "lecturer", "staff", "admin"] },
      cards: {
        type: "array",
        items: {
          type: "object",
          properties: { label: string, value: { type: "integer" } },
        },
      },
      breakdown: {
        type: "array",
        items: {
          type: "object",
          properties: { name: string, value: { type: "integer" } },
        },
      },
      recentTopics: {
        type: "array",
        items: { $ref: "#/components/schemas/Metadata" },
      },
      deadlines: {
        type: "array",
        items: { $ref: "#/components/schemas/Milestone" },
      },
      pending: { type: "integer" },
    },
  },
  Progress: {
    type: "object",
    properties: {
      id: uuid,
      topicId: uuid,
      milestoneId: { ...uuid, nullable: true },
      authorId: uuid,
      completedWork: string,
      difficulties: string,
      nextPlan: string,
      selfReportedPercent: { type: "integer", minimum: 0, maximum: 100 },
      createdAt: dateTime,
    },
  },
};
schemas.Topic = {
  allOf: [
    { $ref: "#/components/schemas/Metadata" },
    {
      type: "object",
      properties: {
        teamId: uuid,
        title: string,
        abstract: string,
        objectives: string,
        researchContent: string,
        methodology: string,
        expectedOutcomes: string,
        proposedSupervisorId: { ...uuid, nullable: true },
        currentRevisionId: { ...uuid, nullable: true },
        revision,
        team: { $ref: "#/components/schemas/Team" },
        historicalOnly: { type: "boolean" },
        accessMode: {
          type: "string",
          enum: [
            "staff",
            "lecturer",
            "proposal_lecturer",
            "student",
            "historical",
          ],
        },
      },
    },
  ],
};
schemas.AcademicSnapshot = {
  type: "object",
  required: [
    "title",
    "fieldId",
    "abstract",
    "objectives",
    "researchContent",
    "methodology",
    "expectedOutcomes",
  ],
  properties: {
    title: string,
    fieldId: uuid,
    abstract: string,
    objectives: string,
    researchContent: string,
    methodology: string,
    expectedOutcomes: string,
    teamId: uuid,
    teamName: string,
    leaderId: uuid,
    facultyId: uuid,
    periodId: uuid,
    supervisorId: { ...uuid, nullable: true },
    members: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "fullName", "accountCode"],
        properties: { id: uuid, fullName: string, accountCode: string },
      },
    },
  },
};
schemas.TopicRevision.properties.snapshot = {
  $ref: "#/components/schemas/AcademicSnapshot",
};
schemas.Invitation = {
  type: "object",
  required: ["id", "teamId", "inviteeId", "status", "revision", "expiresAt"],
  properties: {
    id: uuid,
    teamId: uuid,
    inviteeId: uuid,
    invitedBy: uuid,
    changeRequestId: { ...uuid, nullable: true },
    purpose: { type: "string", enum: ["initial", "approved_change"] },
    status: {
      type: "string",
      enum: ["pending", "accepted", "declined", "cancelled", "expired"],
    },
    expiresAt: dateTime,
    respondedAt: { ...dateTime, nullable: true },
    responseReason: { ...string, nullable: true },
    revision,
    createdAt: dateTime,
    team: { type: "object", properties: { id: uuid, name: string } },
  },
};
schemas.SupervisionRequest = {
  type: "object",
  required: [
    "id",
    "topicId",
    "lecturerId",
    "requestedBy",
    "purpose",
    "status",
    "revision",
  ],
  properties: {
    id: uuid,
    topicId: uuid,
    lecturerId: uuid,
    requestedBy: uuid,
    changeRequestId: { ...uuid, nullable: true },
    purpose: { type: "string", enum: ["initial", "replacement"] },
    status: {
      type: "string",
      enum: ["pending", "accepted", "declined", "cancelled", "expired"],
    },
    expiresAt: { ...dateTime, nullable: true },
    respondedAt: { ...dateTime, nullable: true },
    responseReason: { ...string, nullable: true },
    lecturerName: string,
    revision,
    createdAt: dateTime,
    topic: {
      type: "object",
      properties: {
        id: uuid,
        code: string,
        title: string,
        abstract: string,
        objectives: string,
        researchContent: string,
        methodology: string,
        expectedOutcomes: string,
      },
    },
  },
};
schemas.Assignment = {
  type: "object",
  required: ["id", "topicId", "lecturerId", "assignedBy", "startedAt"],
  properties: {
    id: uuid,
    topicId: uuid,
    lecturerId: uuid,
    assignedBy: uuid,
    startedAt: dateTime,
    endedAt: { ...dateTime, nullable: true },
    reason: { ...string, nullable: true },
  },
};
const requestProperties = {
  id: uuid,
  topicId: uuid,
  requestedBy: uuid,
  reason: string,
  status: {
    type: "string",
    enum: ["pending", "approved", "rejected", "withdrawn", "conflicted"],
  },
  decidedBy: { ...uuid, nullable: true },
  decisionReason: { ...string, nullable: true },
  decidedAt: { ...dateTime, nullable: true },
  revision,
  createdAt: dateTime,
};
schemas.ChangeRequest = {
  type: "object",
  required: [
    "id",
    "topicId",
    "requestedBy",
    "type",
    "beforeData",
    "afterData",
    "baseRevision",
    "reason",
    "status",
    "revision",
  ],
  properties: {
    ...requestProperties,
    type: { type: "string", enum: ["academic", "members", "supervisor"] },
    beforeData: {
      oneOf: [
        { $ref: "#/components/schemas/AcademicSnapshot" },
        {
          type: "object",
          required: ["memberIds", "leaderId"],
          properties: {
            memberIds: { type: "array", items: uuid },
            leaderId: uuid,
          },
        },
        {
          type: "object",
          required: ["supervisorId"],
          properties: { supervisorId: uuid },
        },
      ],
    },
    afterData: {
      oneOf: [
        { $ref: "#/components/schemas/AcademicSnapshot" },
        {
          type: "object",
          required: ["memberIds", "leaderId"],
          properties: {
            memberIds: { type: "array", items: uuid },
            leaderId: uuid,
          },
        },
        {
          type: "object",
          required: ["supervisorId"],
          properties: { supervisorId: uuid },
        },
      ],
    },
    baseRevision: revision,
    similarityCheckId: { ...uuid, nullable: true },
    proposedMembers: {
      type: "array",
      items: {
        type: "object",
        properties: { id: uuid, fullName: string, accountCode: string },
      },
    },
    proposedSupervisor: {
      type: ["object", "null"],
      properties: { id: uuid, fullName: string, facultyId: uuid },
    },
  },
};
schemas.CancellationRequest = {
  type: "object",
  required: ["id", "topicId", "requestedBy", "reason", "status", "revision"],
  properties: requestProperties,
};
schemas.TopicDecision = {
  type: "object",
  required: ["id", "topicRevisionId", "decidedBy", "action", "createdAt"],
  properties: {
    id: uuid,
    topicRevisionId: uuid,
    decidedBy: uuid,
    action: { type: "string", enum: ["approve", "request_revision", "reject"] },
    reason: { ...string, nullable: true },
    warningJustification: { ...string, nullable: true },
    similarityCheckId: { ...uuid, nullable: true },
    createdAt: dateTime,
  },
};
schemas.AccessGrant = {
  type: "object",
  required: ["id", "membershipId", "readableFrom", "retainedAfterLeave"],
  properties: {
    id: uuid,
    membershipId: uuid,
    readableFrom: dateTime,
    readableUntil: { ...dateTime, nullable: true },
    retainedAfterLeave: { type: "boolean" },
    revokedAt: { ...dateTime, nullable: true },
    grantedBy: uuid,
    revokeReason: { ...string, nullable: true },
    student: {
      type: "object",
      properties: { fullName: string, accountCode: string },
    },
    activeMembership: { type: "boolean" },
  },
};
schemas.DecisionResult = {
  type: "object",
  required: ["topic", "decision"],
  properties: {
    topic: { $ref: "#/components/schemas/Topic" },
    decision: { $ref: "#/components/schemas/TopicDecision" },
    similarity: { $ref: "#/components/schemas/Similarity" },
  },
};
schemas.ChangeDecisionResult = {
  oneOf: [
    {
      type: "object",
      required: ["request", "topic"],
      properties: {
        request: { $ref: "#/components/schemas/ChangeRequest" },
        topic: { $ref: "#/components/schemas/Topic" },
        similarity: { $ref: "#/components/schemas/Similarity" },
      },
    },
    {
      allOf: [
        { $ref: "#/components/schemas/ChangeRequest" },
        { type: "object", properties: { conflict: { const: true } } },
      ],
    },
  ],
};
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
function envelope(data, paged = false) {
  return {
    type: "object",
    required: ["data", "requestId", ...(paged ? ["meta"] : [])],
    properties: {
      data,
      requestId: uuid,
      ...(paged
        ? {
            meta: {
              type: "object",
              required: ["page", "pageSize", "totalItems", "totalPages"],
              properties: Object.fromEntries(
                ["page", "pageSize", "totalItems", "totalPages"].map((k) => [
                  k,
                  { type: "integer" },
                ]),
              ),
            },
          }
        : {}),
    },
  };
}
function responseSchema(path, method) {
  const list =
    method === "get" &&
    !path.endsWith("/:id") &&
    !path.endsWith("/workspace") &&
    !path.includes("/:version") &&
    !["/dashboard", "/reports/topics"].includes(path);
  let name = path.includes("/users")
    ? "User"
    : path.includes("/milestones")
      ? "Milestone"
      : path.includes("/submissions")
        ? "Submission"
        : path.includes("/reviews")
          ? "Review"
          : path.includes("/evaluations") ||
              path.endsWith("/evaluation-corrections")
            ? "Evaluation"
            : path.includes("/similarity-checks")
              ? "Similarity"
              : path.includes("/revisions")
                ? "TopicRevision"
                : path.includes("/teams")
                  ? "Team"
                  : path.includes("/research-periods")
                    ? "ResearchPeriod"
                    : path.includes("/notifications")
                      ? "Notification"
                      : path.includes("/audit")
                        ? "Audit"
                        : path.includes("/progress-updates")
                          ? "Progress"
                          : path === "/reports/topics"
                            ? "Report"
                            : path === "/dashboard"
                              ? "Dashboard"
                              : path.includes("/topics")
                                ? "Topic"
                                : "Catalog";
  if (
    path === "/topics" ||
    path === "/me/topics" ||
    (path === "/topics/:id" && method === "get")
  )
    name = "Metadata";
  if (path.includes("/change-requests") && path.endsWith("/decisions"))
    return ref("ChangeDecisionResult");
  if (
    /invitations|supervision-requests|change-requests|cancellation-requests/.test(
      path,
    )
  ) {
    name = path.includes("invitations")
      ? "Invitation"
      : path.includes("supervision-requests")
        ? "SupervisionRequest"
        : path.includes("change-requests")
          ? "ChangeRequest"
          : "CancellationRequest";
    return list ? { type: "array", items: ref(name) } : ref(name);
  }
  if (path.includes("/supervisor-assignments"))
    return { type: "array", items: ref("Assignment") };
  if (path.includes("/access-grants") || path.includes("/team-access-grants"))
    return list
      ? { type: "array", items: ref("AccessGrant") }
      : ref("AccessGrant");
  if (path.includes("/attachments"))
    return list
      ? { type: "array", items: ref("Attachment") }
      : ref("Attachment");
  if (path.includes("/decisions")) return ref("DecisionResult");
  if (path === "/users/import")
    return { type: "object", properties: { created: { type: "integer" } } };
  if (path.endsWith("/reset-password"))
    return {
      type: "object",
      properties: {
        temporaryPassword: string,
        mustChangePassword: { const: true },
      },
    };
  if (path.endsWith("/read-all"))
    return { type: "object", properties: { count: { type: "integer" } } };
  if (path === "/lecturers")
    return {
      type: "array",
      items: {
        type: "object",
        required: ["id", "fullName", "facultyId"],
        properties: {
          id: uuid,
          fullName: string,
          facultyId: uuid,
          specialization: { ...string, nullable: true },
        },
      },
    };
  if (path === "/students/search")
    return {
      type: "array",
      items: {
        type: "object",
        required: ["id", "fullName", "accountCode", "facultyId"],
        properties: {
          id: uuid,
          fullName: string,
          accountCode: string,
          facultyId: uuid,
          classId: uuid,
        },
      },
    };
  return list ? { type: "array", items: ref(name) } : ref(name);
}
function permissionDescription(path, method) {
  if (path.includes("/users") || path === "/audit-logs")
    return /roles|management-scopes/.test(path)
      ? "Chỉ admin. Không loại hoặc khóa admin hoạt động cuối cùng; thay quyền thu hồi các phiên ngay."
      : "Chủ tài khoản đọc bản thân; admin quản lý kỹ thuật; faculty_staff chỉ SV/GV trong khoa được cấp. Import validate toàn bộ trước ghi. Không trả passwordHash hoặc refresh hash.";
  if (/^\/(faculties|majors|classes|research-fields)/.test(path))
    return method === "get"
      ? "Mọi tài khoản đã đăng nhập; mặc định danh mục đang dùng."
      : "Chỉ admin. Không đổi quan hệ tổ chức hoặc xóa danh mục đã tham chiếu.";
  if (path.includes("research-periods"))
    return method === "get"
      ? "Mọi tài khoản đã đăng nhập."
      : "Chỉ faculty_staff trong khoa được cấp. Hạn và min/max hợp lệ; thay hạn cần lý do.";
  if (path.includes("supervision-requests"))
    return "Trưởng nhóm đề nghị/thu hồi, đúng giảng viên nhận đề nghị mới phản hồi. Xác nhận gắn hash nội dung; replacement phải gắn yêu cầu thay đổi đang chờ. Giảng viên cũ không đọc nội dung hiện hành sau khi bị thay.";
  if (path.includes("invitations"))
    return "Trưởng nhóm mời/thu hồi; chỉ người nhận được đồng ý/từ chối. Lời mời pending không giữ chỗ. Khi accepted kiểm tra lại khoa, chỗ tham gia, giới hạn và hạn. Sau duyệt chỉ ghi consent cho change-request.";
  if (path.includes("/teams"))
    return "SV thấy nhóm có quyền, CB theo khoa. Chỉ trưởng nhóm sửa trước duyệt. Một membership active/SV/đợt; một leader hợp lệ; closed không tái dùng. Không thay roster trực tiếp khi submitted/sau duyệt.";
  if (path === "/topics")
    return method === "get"
      ? "Kho metadata chỉ approved/in_progress/pending_evaluation/completed. Không trả mô tả riêng, roster hoặc file."
      : "Chỉ trưởng nhóm của nhóm active chưa có đề tài. Khoa/đợt/code/status do server gán.";
  if (path === "/me/topics")
    return "SV theo nhóm và khoảng quyền; GV hiện hành/đề nghị ban đầu còn hợp lệ; CB theo management_scopes. Admin kỹ thuật không mặc nhiên có workspace.";
  if (path.includes("/similarity"))
    return "Chỉ trưởng nhóm hiện hành hoặc cán bộ khoa được cấp. Chạy trên dữ liệu server, khóa giao dịch với corpus publication; failed không trả điểm 0. Chỉ metadata và tối đa 5 matches.";
  if (path.includes("/reports"))
    return "Chỉ lecturer hiện hành/faculty_staff trong scope. Bộ lọc, tổng distinct topic và kết quả evaluation mới nhất dùng chung cho biểu đồ/CSV.";
  if (path.includes("notifications"))
    return "Chỉ thông báo recipientId là người đang đăng nhập. Đánh dấu đọc idempotent.";
  if (
    path.endsWith("/decisions") ||
    path.endsWith("/cancel") ||
    path.endsWith("/revoke")
  )
    return "Chỉ faculty_staff đúng khoa, không tự quyết hồ sơ mình tham gia. Kiểm tra revision, snapshot, trạng thái, consent và lý do. Các thay đổi/audit/thông báo cùng transaction.";
  if (
    path.includes("reviews") ||
    (path.endsWith("/evaluations") && method === "post") ||
    path.endsWith("/reopen") ||
    path.endsWith("/return-to-progress")
  )
    return "Chỉ giảng viên hướng dẫn hiện hành. Nhận xét đúng bản hiện hành, kết quả chỉ pending_evaluation đủ mọi mốc required. Bản accepted chỉ nộp lại sau reopen có lý do. Review/evaluation append-only.";
  if (path.endsWith("/evaluation-corrections"))
    return "Chỉ cán bộ khoa, completed, có correctionReason; tạo evaluation.version mới, không sửa bản cũ. Kết quả độc lập score.";
  if (
    path.includes("change-requests") ||
    path.includes("cancellation-requests")
  )
    return "Trưởng nhóm tạo/rút đề nghị; cán bộ đúng khoa quyết định. Pending hủy chưa đóng nhóm. Thay thành viên/GV cần consent, kiểm tra chỗ lúc áp dụng. Academic phải kiểm tra tương tự lại. Stale change được đánh dấu conflicted.";
  if (path.includes("access-grants"))
    return "Chỉ cán bộ khoa, không admin mặc định. Quyền lịch sử theo khoảng nửa mở [readableFrom,readableUntil); tái tham gia không mở khoảng vắng.";
  if (method === "get")
    return "Chỉ người có quyền hồ sơ/phiên bản: thành viên trong khoảng grant, giảng viên hiện hành, cán bộ đúng khoa. Ngoài quyền trả 404. Lịch sử trả các bản trong khoảng quyền; không đưa signed URL vào JSON metadata.";
  return "Kiểm tra quyền đối tượng và trạng thái tại server. SV hiện hành được cập nhật tiến độ/nộp báo cáo; trưởng nhóm sửa/gửi draft hoặc revision_required. Tác giả/giờ nộp/status/similarity do server gán. Revision stale trả 409.";
}
const paths = {},
  security = [{ accessToken: [] }],
  errorDescriptions = {
    400: "MALFORMED_REQUEST: JSON không hợp lệ",
    401: "UNAUTHENTICATED / SESSION_REVOKED",
    403: "ACTION_FORBIDDEN / CSRF_REJECTED / PASSWORD_CHANGE_REQUIRED",
    404: "RESOURCE_NOT_FOUND: không tồn tại hoặc không được biết",
    409: "REVISION_CONFLICT / INVALID_TRANSITION / IDEMPOTENCY_CONFLICT / UNIQUE_CONFLICT",
    413: "FILE_TOO_LARGE",
    415: "UNSUPPORTED_FILE_TYPE / INVALID_FILE",
    422: "VALIDATION_FAILED / FILE_NOT_READY / SUPERVISOR_NOT_CONFIRMED / REQUIRED_MILESTONE_NOT_ACCEPTED",
    429: "RATE_LIMITED",
    503: "DEPENDENCY_UNAVAILABLE / STORAGE_NOT_CONFIGURED / SIMILARITY_UNAVAILABLE",
  };
const listPaged = new Set([
  "/topics",
  "/me/topics",
  "/users",
  "/notifications",
  "/audit-logs",
  "/topics/:id/audit-logs",
  "/topics/:id/progress-updates",
]);
for (const item of registry) {
  const path = item.path.replace(/:([\w]+)/g, "{$1}"),
    operation = {
      operationId: `${item.method}_${item.path.replace(/[^a-z0-9]+/gi, "_")}`,
      summary: item.summary,
      tags: [item.path.split("/")[1]],
      security,
      parameters: [],
      responses: {},
    };
  operation.description = permissionDescription(item.path, item.method);
  for (const match of item.path.matchAll(/:([\w]+)/g))
    operation.parameters.push({
      name: match[1],
      in: "path",
      required: true,
      schema: match[1] === "version" ? { type: "integer", minimum: 1 } : uuid,
    });
  if (item.method !== "get")
    operation.parameters.push(
      {
        name: "Origin",
        in: "header",
        required: true,
        schema: { type: "string", format: "uri" },
        example: "http://localhost:5173",
      },
      {
        name: "X-CSRF-Protection",
        in: "header",
        required: true,
        schema: { type: "string", const: "1" },
      },
    );
  if (item.idempotency)
    operation.parameters.push({
      name: "Idempotency-Key",
      in: "header",
      required: true,
      schema: { type: "string", minLength: 8, maxLength: 128 },
      description:
        "Giữ nguyên khi retry cùng payload trong 24 giờ. Khác payload trả 409.",
    });
  if (listPaged.has(item.path))
    for (const [name, min, max, defaultValue] of [
      ["page", 1, 100000, 1],
      ["pageSize", 1, 100, 20],
    ])
      operation.parameters.push({
        name,
        in: "query",
        schema: {
          type: "integer",
          minimum: min,
          maximum: max,
          default: defaultValue,
        },
      });
  if (["/topics", "/me/topics", "/reports/topics"].includes(item.path))
    for (const name of [
      "search",
      "facultyId",
      "periodId",
      "academicYear",
      "supervisorId",
      "fieldId",
      "status",
      "result",
      "sort",
    ])
      operation.parameters.push({
        name,
        in: "query",
        schema: name.endsWith("Id") ? uuid : string,
      });
  if (item.path === "/reports/topics")
    operation.parameters.push({
      name: "groupBy",
      in: "query",
      schema: {
        type: "string",
        enum: [
          "status",
          "result",
          "faculty",
          "field",
          "period",
          "supervisor",
          "academicYear",
        ],
        default: "status",
      },
    });
  if (item.schema) {
    const schema = z.toJSONSchema(item.schema, {
      unrepresentable: "any",
      io: "input",
    });
    delete schema.$schema;
    operation.requestBody = {
      required: true,
      content: { "application/json": { schema } },
    };
  }
  const status = item.status ?? 200;
  operation.responses[status] = {
    description: "Thành công",
    ...(status !== 204
      ? {
          content: {
            "application/json": {
              schema: envelope(
                responseSchema(item.path, item.method),
                listPaged.has(item.path),
              ),
            },
          },
        }
      : {}),
  };
  for (const [code, description] of Object.entries(errorDescriptions))
    operation.responses[code] = {
      description,
      content: { "application/json": { schema: ref("Error") } },
    };
  (paths[path] ??= {})[item.method] = operation;
}
function manual(
  method,
  path,
  {
    body,
    data = object,
    status = 200,
    auth = true,
    description = "",
    contentType = "application/json",
    csrf = method !== "get",
    cookie = false,
  } = {},
) {
  const parameters = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: uuid,
  }));
  if (csrf)
    parameters.push(
      {
        name: "Origin",
        in: "header",
        required: true,
        schema: string,
        example: "http://localhost:5173",
      },
      {
        name: "X-CSRF-Protection",
        in: "header",
        required: true,
        schema: { type: "string", const: "1" },
      },
    );
  const op = {
    operationId: method + "_" + path.replace(/[^a-z0-9]/gi, "_"),
    summary: description || path,
    tags: [path.split("/")[1]],
    security: cookie ? [{ refreshCookie: [] }] : auth ? security : [],
    parameters,
    responses: {
      [status]: {
        description: "Thành công",
        ...(status !== 204
          ? {
              content: {
                [contentType]: {
                  schema:
                    contentType === "application/json"
                      ? envelope(data)
                      : { type: "string" },
                },
              },
            }
          : {}),
      },
    },
  };
  if (body)
    op.requestBody = {
      required: true,
      content: {
        [contentType === "text/csv" ? "application/json" : contentType]: {
          schema: body,
        },
      },
    };
  for (const [code, text] of Object.entries(errorDescriptions))
    op.responses[code] = {
      description: text,
      content: { "application/json": { schema: ref("Error") } },
    };
  (paths[path] ??= {})[method] = op;
}
manual("post", "/auth/login", {
  auth: false,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string", maxLength: 200 },
    },
  },
  data: ref("Session"),
  description:
    "Đăng nhập; Set-Cookie refresh HttpOnly, Secure ở production, SameSite=Strict; access JWT 15 phút.",
});
manual("post", "/auth/refresh", {
  auth: false,
  cookie: true,
  body: { type: "object" },
  data: ref("Session"),
  description:
    "Xoay refresh nguyên tử, giới hạn tuyệt đối 7 ngày từ đăng nhập; reuse thu hồi cả family.",
});
manual("post", "/auth/logout", {
  body: { type: "object" },
  status: 204,
  description: "Thu hồi family và xóa cookie; JWT cùng family bị từ chối ngay.",
});
manual("get", "/auth/me", { data: ref("User") });
manual("patch", "/auth/password", {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["currentPassword", "newPassword"],
    properties: {
      currentPassword: string,
      newPassword: { type: "string", minLength: 12, maxLength: 128 },
    },
  },
  data: { type: "object", properties: { requiresLogin: { const: true } } },
});
manual("post", "/topics/{id}/attachments", {
  status: 201,
  contentType: "multipart/form-data",
  body: {
    type: "object",
    required: ["file", "purpose"],
    properties: {
      file: { type: "string", format: "binary" },
      purpose: {
        type: "string",
        enum: ["proposal", "report", "private_image"],
      },
    },
  },
  data: ref("Attachment"),
  description:
    "Upload một file qua Express; 4 MB tài liệu, 4 MB ảnh; raw/authenticated; không đồng nghĩa đã nộp.",
});
paths["/topics/{id}/attachments"].post.responses[201].content = {
  "application/json": { schema: envelope(ref("Attachment")) },
};
manual("get", "/attachments/{id}", { data: ref("Attachment") });
manual("delete", "/attachments/{id}", {
  status: 204,
  description: "Chỉ người upload xóa file chưa được gắn vào phiên bản nào.",
});
manual("post", "/attachments/{id}/download-links", {
  body: { type: "object" },
  data: {
    type: "object",
    required: ["url", "expiresAt"],
    properties: { url: { type: "string", format: "uri" }, expiresAt: dateTime },
  },
  description:
    "Kiểm tra quyền phiên bản rồi cấp private_download_url 5 phút. Cache-Control: no-store.",
});
manual("post", "/profile/avatar", {
  status: 200,
  contentType: "multipart/form-data",
  body: {
    type: "object",
    additionalProperties: false,
    required: ["file"],
    properties: { file: { type: "string", format: "binary" } },
  },
  data: ref("User"),
  description:
    "Chủ tài khoản cập nhật ảnh công khai; JPEG/PNG/WebP tối đa 4 MB; decode và chuyển WebP 256px; image/upload trên Cloudinary.",
});
paths["/profile/avatar"].post.responses[200].content = {
  "application/json": { schema: envelope(ref("User")) },
};
manual("delete", "/teams/{id}/members/{studentId}", { status: 204 });
paths["/teams/{id}/members/{studentId}"].delete.parameters.push(
  { name: "revision", in: "query", required: true, schema: revision },
  {
    name: "reason",
    in: "query",
    required: true,
    schema: { type: "string", minLength: 10, maxLength: 2000 },
  },
);
manual("get", "/reports/topics/export", {
  contentType: "text/csv",
  description:
    "CSV UTF-8 BOM, cùng bộ lọc và scope của GET /reports/topics, chống công thức.",
});
paths["/reports/topics/export"].get.parameters = paths[
  "/reports/topics"
].get.parameters.filter((p) => p.in === "query" && p.name !== "groupBy");
manual("get", "/health", {
  auth: false,
  data: { type: "object", properties: { status: { const: "ok" } } },
});
manual("get", "/ready", {
  auth: false,
  data: { type: "object", properties: { status: { const: "ready" } } },
});
manual("post", "/internal/jobs", {
  csrf: false,
  description:
    "Scheduler máy chủ; Bearer SCHEDULER_SECRET riêng, không dùng JWT của người dùng.",
});
paths["/internal/jobs"].post.security = [{ schedulerToken: [] }];
const document = {
  openapi: "3.1.0",
  info: {
    title: "Research Hub · NCKH sinh viên",
    version: "1.0.0",
    description:
      "REST JavaScript/Express/PostgreSQL. Thời gian UTC, UUID, JSON camelCase. Backend kiểm tra quyền theo vai trò, khoa, nhóm, phân công và khoảng quyền. Admin kỹ thuật không có quyền đọc tài liệu hay xét duyệt mặc định. Một khóa advisory cho giao dịch ghi trong bản đầu. Không lưu token hoặc link tải vào idempotency.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      accessToken: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      refreshCookie: { type: "apiKey", in: "cookie", name: "nckh_refresh" },
      schedulerToken: {
        type: "http",
        scheme: "bearer",
        description: "SCHEDULER_SECRET server-only",
      },
    },
    schemas,
  },
  paths,
};
function nullableTo31(value) {
  if (!value || typeof value !== "object") return;
  if (value.nullable) {
    delete value.nullable;
    if (typeof value.type === "string") value.type = [value.type, "null"];
  }
  for (const child of Object.values(value)) nullableTo31(child);
}
nullableTo31(document);
writeFileSync("app/docs/openapi.json", JSON.stringify(document, null, 2));
console.log(
  `${Object.values(paths).reduce((n, p) => n + Object.keys(p).length, 0)} endpoints documented.`,
);
