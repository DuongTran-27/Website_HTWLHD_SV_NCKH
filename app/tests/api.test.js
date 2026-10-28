import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { createApp } from "../server/src/app.js";
import { db, transaction, academicHash } from "../server/src/core.js";
import { cloudStorage } from "../server/src/files.js";
import { reminders, cleanup } from "../server/src/jobs.js";
import { normalize } from "../server/src/similarity.js";

const app = createApp(),
  origin = "http://localhost:5173",
  sessions = {},
  fixtures = {},
  assets = new Map();
let pdfBuffer;
function call(method, path, auth, body, key = randomUUID()) {
  const agent = request(app);
  let req = agent[method]("/api/v1" + path)
    .set("Origin", origin)
    .set("X-CSRF-Protection", "1")
    .set("Idempotency-Key", key);
  if (auth)
    req = req.set(
      "Authorization",
      `Bearer ${typeof auth === "string" ? auth : auth.token}`,
    );
  if (body !== undefined) req = req.send(body);
  return req;
}
async function login(name) {
  const response = await call("post", "/auth/login", null, {
    email: `${name}@demo.test`,
    password: process.env.DEMO_PASSWORD,
  });
  expect(response.status, response.text).toBe(200);
  return {
    token: response.body.data.accessToken,
    user: response.body.data.user,
    cookie: response.headers["set-cookie"][0].split(";")[0],
  };
}
async function workspace(topic, auth = sessions.staff) {
  const r = await call("get", `/topics/${topic.id}/workspace`, auth);
  expect(r.status, r.text).toBe(200);
  return r.body.data;
}
async function makeStudent(faculty = fixtures.faculty) {
  const id = randomUUID(),
    suffix = id.slice(0, 8),
    base = await db.user.findUnique({
      where: { id: sessions.student1.user.id },
    });
  const user = await db.user.create({
    data: {
      id,
      accountCode: `t${suffix}`,
      email: `t${suffix}@demo.test`,
      fullName: `Sinh viên thử ${suffix}`,
      facultyId: faculty.id,
      classId:
        faculty.id === fixtures.faculty.id
          ? base.classId
          : fixtures.crossStudent.classId,
      passwordHash: base.passwordHash,
    },
  });
  await db.userRole.create({ data: { userId: id, role: "student" } });
  return login(user.accountCode);
}
async function makeTeam(auth, maxMembers = 3) {
  const id = randomUUID(),
    period = await db.researchPeriod.create({
      data: {
        facultyId: auth.user.facultyId,
        name: `Đợt thử ${id}`,
        academicYear: "2026-2027",
        registrationStart: new Date(Date.now() - 86400000),
        registrationEnd: new Date(Date.now() + 20 * 86400000),
        maxMembers,
        milestoneTemplates: fixtures.period.milestoneTemplates,
      },
    });
  const r = await call("post", "/teams", auth, {
    periodId: period.id,
    name: `Nhóm thử ${id.slice(0, 5)}`,
  });
  expect(r.status, r.text).toBe(201);
  return r.body.data;
}
async function makeTopic(auth, state = "draft") {
  const team = await makeTeam(auth),
    base = fixtures.draft;
  let r = await call("post", "/topics", auth, {
    teamId: team.id,
    fieldId: base.fieldId,
    title: `Đề tài thử nghiệm ${randomUUID()} về dữ liệu học thuật`,
    abstract: base.abstract,
    objectives: base.objectives,
    researchContent: base.researchContent,
    methodology: base.methodology,
    expectedOutcomes: base.expectedOutcomes,
  });
  expect(r.status, r.text).toBe(201);
  let topic = r.body.data;
  if (state === "draft") return topic;
  r = await call("post", `/topics/${topic.id}/supervision-requests`, auth, {
    revision: topic.revision,
    lecturerId: sessions.lecturer1.user.id,
  });
  expect(r.status, r.text).toBe(201);
  const consent = await call(
    "post",
    `/supervision-requests/${r.body.data.id}/respond`,
    sessions.lecturer1,
    { revision: r.body.data.revision, decision: "accept" },
  );
  expect(consent.status, consent.text).toBe(200);
  topic = await workspace(topic, auth);
  r = await call("post", `/topics/${topic.id}/submit`, auth, {
    revision: topic.revision,
  });
  expect(r.status, r.text).toBe(200);
  topic = r.body.data;
  if (state === "submitted") return topic;
  r = await call("post", `/topics/${topic.id}/decisions`, sessions.staff, {
    revision: topic.revision,
    topicRevisionId: topic.currentRevisionId,
    action: "approve",
    warningJustification:
      "Nội dung minh họa được chấp thuận trong kiểm thử có kiểm soát.",
  });
  expect(r.status, r.text).toBe(201);
  topic = r.body.data.topic;
  if (state === "approved") return topic;
  r = await call("post", `/topics/${topic.id}/start`, sessions.lecturer1, {
    revision: topic.revision,
  });
  expect(r.status, r.text).toBe(200);
  return r.body.data;
}
async function upload(
  topic,
  auth,
  purpose = "report",
  buffer = pdfBuffer,
  name = "report.pdf",
) {
  const r = await request(app)
    .post(`/api/v1/topics/${topic.id}/attachments`)
    .set("Origin", origin)
    .set("X-CSRF-Protection", "1")
    .set("Authorization", `Bearer ${auth.token}`)
    .field("purpose", purpose)
    .attach("file", buffer, name);
  return r;
}
async function readyMilestones(topic, auth) {
  const milestones = await db.milestone.findMany({
    where: { topicId: topic.id },
    orderBy: { sortOrder: "asc" },
  });
  for (const milestone of milestones) {
    const file = await upload(topic, auth);
    expect(file.status, file.text).toBe(201);
    let r = await call(
      "post",
      `/milestones/${milestone.id}/submissions`,
      auth,
      {
        milestoneRevision: milestone.revision,
        attachmentIds: [file.body.data.id],
      },
    );
    expect(r.status, r.text).toBe(201);
    const s = r.body.data;
    r = await call("post", `/submissions/${s.id}/reviews`, sessions.lecturer1, {
      submissionRevision: s.revision,
      decision: "accepted",
      comment: "Báo cáo đáp ứng yêu cầu kiểm thử và được chấp nhận.",
    });
    expect(r.status, r.text).toBe(201);
  }
}
beforeAll(async () => {
  for (const name of [
    "student1",
    "student2",
    "student3",
    "student4",
    "student5",
    "student8",
    "student9",
    "student10",
    "lecturer1",
    "lecturer2",
    "staff",
    "staff2",
    "admin",
  ])
    sessions[name] = await login(name);
  fixtures.faculty = await db.faculty.findUnique({ where: { code: "CNTT" } });
  fixtures.crossFaculty = await db.faculty.findUnique({
    where: { code: "KT" },
  });
  fixtures.crossStudent = await db.user.findUnique({
    where: { accountCode: "student16" },
  });
  fixtures.period = await db.researchPeriod.findFirst({
    where: { facultyId: fixtures.faculty.id, status: "open" },
  });
  fixtures.draft = await db.topic.findFirst({ where: { status: "draft" } });
  fixtures.submitted = await db.topic.findFirst({
    where: { status: "submitted" },
  });
  fixtures.approved = await db.topic.findFirst({
    where: { status: "approved" },
  });
  fixtures.progress = await db.topic.findFirst({
    where: { status: "in_progress" },
  });
  const pdf = await PDFDocument.create();
  pdf.addPage();
  pdfBuffer = Buffer.from(await pdf.save());
  // Only the Cloudinary transport is mocked. Every API operation uses real PostgreSQL.
  process.env.CLOUDINARY_CLOUD_NAME = "mock-cloudinary-test";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
  vi.spyOn(cloudStorage, "upload").mockImplementation(
    async (buffer, options) => {
      const asset = {
        asset_id: randomUUID(),
        public_id: options.public_id,
        bytes: buffer.length,
      };
      assets.set(options.public_id, buffer);
      return asset;
    },
  );
  vi.spyOn(cloudStorage, "destroy").mockImplementation(async (file) => {
    assets.delete(file.publicId);
    return { result: "ok" };
  });
});
afterAll(async () => {
  vi.restoreAllMocks();
  await db.$disconnect();
});
describe.sequential(
  "API / PostgreSQL thực; Cloudinary transport mock trong test",
  () => {
    it("TC01: đăng nhập sai, cookie HttpOnly và access token hoạt động", async () => {
      const bad = await call("post", "/auth/login", null, {
        email: "student1@demo.test",
        password: "incorrect-password",
      });
      expect(bad.status).toBe(401);
      const good = await call("get", "/auth/me", sessions.student1);
      expect(good.body.data.roles).toContain("student");
      expect(good.body.data.passwordHash).toBeUndefined();
      const session = await login("student9");
      expect(session.cookie).toMatch(/^nckh_refresh=/);
    });
    it("TC02: rotation nguyên tử, reuse thu hồi family và JWT còn hạn", async () => {
      const auth = await login("student9"),
        first = await call("post", "/auth/refresh", null, {}).set(
          "Cookie",
          auth.cookie,
        );
      expect(first.status).toBe(200);
      const reused = await call("post", "/auth/refresh", null, {}).set(
        "Cookie",
        auth.cookie,
      );
      expect(reused.status).toBe(401);
      expect(
        (await call("get", "/auth/me", first.body.data.accessToken)).status,
      ).toBe(401);
    });
    it("TC02: refresh đồng thời không sinh hai token hợp lệ cùng từ một token", async () => {
      const auth = await login("student9"),
        results = await Promise.all([
          call("post", "/auth/refresh", null, {}).set("Cookie", auth.cookie),
          call("post", "/auth/refresh", null, {}).set("Cookie", auth.cookie),
        ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
      expect(
        (
          await call(
            "get",
            "/auth/me",
            results.find((r) => r.status === 200).body.data.accessToken,
          )
        ).status,
      ).toBe(401);
    });
    it("TC03: logout vô hiệu JWT ngay", async () => {
      const auth = await login("student9");
      expect((await call("post", "/auth/logout", auth, {})).status).toBe(204);
      expect((await call("get", "/auth/me", auth)).status).toBe(401);
    });
    it("TC03: đổi/reset mật khẩu và khóa tài khoản thu hồi phiên", async () => {
      const auth = await makeStudent();
      const changed = await call("patch", "/auth/password", auth, {
        currentPassword: process.env.DEMO_PASSWORD,
        newPassword: "New-test-password-2026!",
      });
      expect(changed.status).toBe(200);
      expect((await call("get", "/auth/me", auth)).status).toBe(401);
      const row = await db.user.findUnique({ where: { id: auth.user.id } });
      const reset = await call(
        "post",
        `/users/${row.id}/reset-password`,
        sessions.admin,
        { reason: "Đặt lại mật khẩu trong bài kiểm thử bảo mật." },
      );
      expect(reset.status).toBe(200);
      expect(
        (await db.user.findUnique({ where: { id: row.id } }))
          .mustChangePassword,
      ).toBe(true);
      const other = await makeStudent();
      const lock = await call(
        "patch",
        `/users/${other.user.id}`,
        sessions.admin,
        { revision: 1, status: "locked" },
      );
      expect(lock.status, lock.text).toBe(200);
      expect((await call("get", "/auth/me", other)).status).toBe(401);
    });
    it("TC04: cán bộ không tự cấp admin/scope, admin cuối được giữ", async () => {
      expect(
        (
          await call(
            "put",
            `/users/${sessions.staff.user.id}/roles`,
            sessions.staff,
            { revision: 1, roles: ["admin"] },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await call(
            "put",
            `/users/${sessions.staff.user.id}/management-scopes`,
            sessions.staff,
            { revision: 1, facultyIds: [fixtures.crossFaculty.id] },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await call(
            "put",
            `/users/${sessions.admin.user.id}/roles`,
            sessions.admin,
            { revision: 1, roles: ["student"] },
          )
        ).status,
      ).toBeGreaterThanOrEqual(400);
    });
    it("TC05: hai lời mời cùng đợt nhận đồng thời chỉ có một membership", async () => {
      const leader1 = await makeStudent(),
        leader2 = await makeStudent(),
        invitee = await makeStudent(),
        team1 = await makeTeam(leader1);
      const team2 = await call("post", "/teams", leader2, {
        periodId: team1.periodId,
        name: "Nhóm cạnh tranh chỗ sinh viên",
      });
      expect(team2.status).toBe(201);
      const invitations = await Promise.all([
        call("post", `/teams/${team1.id}/invitations`, leader1, {
          revision: 1,
          inviteeId: invitee.user.id,
        }),
        call("post", `/teams/${team2.body.data.id}/invitations`, leader2, {
          revision: 1,
          inviteeId: invitee.user.id,
        }),
      ]);
      expect(invitations.map((i) => i.status)).toEqual([201, 201]);
      const responses = await Promise.all(
        invitations.map((i) =>
          call("post", `/team-invitations/${i.body.data.id}/respond`, invitee, {
            revision: 1,
            decision: "accept",
          }),
        ),
      );
      expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        await db.teamMember.count({
          where: {
            periodId: team1.periodId,
            studentId: invitee.user.id,
            active: true,
          },
        }),
      ).toBe(1);
    });
    it("TC06: hai lời mời vào nhóm còn một chỗ không vượt max", async () => {
      const leader = await makeStudent(),
        a = await makeStudent(),
        b = await makeStudent(),
        team = await makeTeam(leader, 2);
      const ia = await call("post", `/teams/${team.id}/invitations`, leader, {
          revision: 1,
          inviteeId: a.user.id,
        }),
        ib = await call("post", `/teams/${team.id}/invitations`, leader, {
          revision: 2,
          inviteeId: b.user.id,
        });
      const results = await Promise.all([
        call("post", `/team-invitations/${ia.body.data.id}/respond`, a, {
          revision: 1,
          decision: "accept",
        }),
        call("post", `/team-invitations/${ib.body.data.id}/respond`, b, {
          revision: 1,
          decision: "accept",
        }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        await db.teamMember.count({ where: { teamId: team.id, active: true } }),
      ).toBe(2);
    });
    it("TC07/08: trưởng nhóm không được rời, đóng nhóm trống hồ sơ giải phóng chỗ", async () => {
      const leader = await makeStudent(),
        team = await makeTeam(leader);
      expect(
        (await call("post", `/teams/${team.id}/leave`, leader, { revision: 1 }))
          .body.error.code,
      ).toBe("LEADER_MUST_TRANSFER");
      expect(
        (
          await call("post", `/teams/${team.id}/close`, leader, {
            revision: 1,
            reason: "Đóng nhóm chưa có hồ sơ để tạo nhóm mới.",
          })
        ).status,
      ).toBe(200);
      expect(
        await db.teamMember.count({ where: { teamId: team.id, active: true } }),
      ).toBe(0);
      expect(
        (
          await call("post", "/topics", leader, {
            teamId: team.id,
            fieldId: fixtures.draft.fieldId,
            title: "Đề tài không được tái dùng nhóm",
            abstract: "",
            objectives: "",
            researchContent: "",
            methodology: "",
            expectedOutcomes: "",
          })
        ).status,
      ).toBeGreaterThanOrEqual(400);
    });
    it("TC09: chưa nhận hướng dẫn/thiếu nội dung không được gửi", async () => {
      const r = await call(
        "post",
        `/topics/${fixtures.draft.id}/submit`,
        sessions.student1,
        { revision: fixtures.draft.revision },
      );
      expect(r.status).toBe(422);
      expect(r.body.error.code).toBe("SUPERVISOR_NOT_CONFIRMED");
      expect(
        (await db.topic.findUnique({ where: { id: fixtures.draft.id } }))
          .status,
      ).toBe("draft");
    });
    it("TC10: gửi/retry chỉ tạo một snapshot, khác payload cùng khóa bị chặn", async () => {
      const auth = await makeStudent(),
        topic = await makeTopic(auth),
        consent = await call(
          "post",
          `/topics/${topic.id}/supervision-requests`,
          auth,
          { revision: topic.revision, lecturerId: sessions.lecturer1.user.id },
        );
      await call(
        "post",
        `/supervision-requests/${consent.body.data.id}/respond`,
        sessions.lecturer1,
        { revision: 1, decision: "accept" },
      );
      const current = await workspace(topic, auth),
        key = randomUUID(),
        payload = { revision: current.revision };
      const [a, b] = await Promise.all([
        call("post", `/topics/${topic.id}/submit`, auth, payload, key),
        call("post", `/topics/${topic.id}/submit`, auth, payload, key),
      ]);
      expect(a.status, a.text).toBe(200);
      expect(b.status, b.text).toBe(200);
      expect(a.body.data.currentRevisionId).toBe(b.body.data.currentRevisionId);
      expect(
        await db.topicRevision.count({ where: { topicId: topic.id } }),
      ).toBe(1);
      const conflict = await call(
        "post",
        `/topics/${topic.id}/submit`,
        auth,
        { revision: 999 },
        key,
      );
      expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
    });
    it("TC11/12: nháp nhóm khác, cán bộ khác khoa và admin kỹ thuật bị chặn", async () => {
      for (const auth of [sessions.student2, sessions.staff2, sessions.admin])
        expect(
          (await call("get", `/topics/${fixtures.draft.id}/workspace`, auth))
            .status,
        ).toBe(404);
      const r = await call(
        "post",
        `/topics/${fixtures.submitted.id}/decisions`,
        sessions.staff2,
        {
          revision: fixtures.submitted.revision,
          topicRevisionId: fixtures.submitted.currentRevisionId,
          action: "reject",
          reason: "Không được phép duyệt ngoài phạm vi khoa.",
        },
      );
      expect([403, 404]).toContain(r.status);
    });
    it("TC13: duyệt snapshot sai bị chặn, mỗi phê duyệt tăng corpus và chạy lại kiểm tra", async () => {
      const auth = await makeStudent(),
        topic = await makeTopic(auth, "submitted");
      let r = await call(
        "post",
        `/topics/${topic.id}/decisions`,
        sessions.staff,
        {
          revision: topic.revision,
          topicRevisionId: randomUUID(),
          action: "approve",
        },
      );
      expect(r.body.error.code).toBe("SNAPSHOT_CONFLICT");
      const before = await db.similarityCorpus.findFirst({
        where: { isActive: true },
      });
      r = await call("post", `/topics/${topic.id}/decisions`, sessions.staff, {
        revision: topic.revision,
        topicRevisionId: topic.currentRevisionId,
        action: "approve",
        warningJustification:
          "Nội dung kiểm thử được xem xét và chấp thuận có lý do.",
      });
      expect(r.status, r.text).toBe(201);
      expect(r.body.data.similarity.corpusVersion).toBe(before.version);
      expect(
        (await db.similarityCorpus.findFirst({ where: { isActive: true } }))
          .version,
      ).toBe(before.version + 1);
      expect(await db.milestone.count({ where: { topicId: topic.id } })).toBe(
        3,
      );
    });
    it("TC14/15: file lỗi không upload; Cloudinary lỗi không tạo bản nộp", async () => {
      const bad = await upload(
        fixtures.progress,
        sessions.student5,
        "report",
        Buffer.from("not pdf"),
      );
      expect(bad.status).toBe(415);
      cloudStorage.upload.mockRejectedValueOnce(
        new Error("simulated transport failure"),
      );
      const failed = await upload(fixtures.progress, sessions.student5);
      expect(failed.status).toBe(503);
      expect(
        await db.attachment.count({
          where: { topicId: fixtures.progress.id, status: "failed" },
        }),
      ).toBe(1);
      expect(
        await db.submission.count({ where: { topicId: fixtures.progress.id } }),
      ).toBe(0);
    });
    it("TC16: finalize chặn pending, file topic khác và client tự gán thời điểm", async () => {
      const m = await db.milestone.findFirst({
          where: { topicId: fixtures.progress.id },
        }),
        file = await upload(fixtures.progress, sessions.student5);
      expect(file.status, file.text).toBe(201);
      const fake = await db.attachment.create({
        data: {
          topicId: fixtures.progress.id,
          uploadedBy: sessions.student5.user.id,
          purpose: "report",
          originalName: "pending.pdf",
          mimeType: "application/pdf",
          sizeBytes: 100,
          publicId: randomUUID(),
        },
      });
      expect(
        (
          await call(
            "post",
            `/milestones/${m.id}/submissions`,
            sessions.student5,
            { milestoneRevision: m.revision, attachmentIds: [fake.id] },
          )
        ).body.error.code,
      ).toBe("FILE_NOT_READY");
      const other = await makeStudent(),
        otherTopic = await makeTopic(other, "in_progress"),
        otherMilestone = await db.milestone.findFirst({
          where: { topicId: otherTopic.id },
        });
      expect(
        (
          await call(
            "post",
            `/milestones/${otherMilestone.id}/submissions`,
            other,
            {
              milestoneRevision: otherMilestone.revision,
              attachmentIds: [file.body.data.id],
            },
          )
        ).body.error.code,
      ).toBe("FILE_NOT_READY");
      expect(
        (
          await call(
            "post",
            `/milestones/${m.id}/submissions`,
            sessions.student5,
            {
              milestoneRevision: m.revision,
              attachmentIds: [file.body.data.id],
              submittedAt: new Date().toISOString(),
            },
          )
        ).status,
      ).toBe(422);
    });
    it("TC17/18: finalize đồng thời retry, version mới, deadline snapshot và nhãn muộn", async () => {
      const auth = await makeStudent(),
        topic = await makeTopic(auth, "in_progress"),
        milestone = await db.milestone.findFirst({
          where: { topicId: topic.id },
        });
      await db.milestone.update({
        where: { id: milestone.id },
        data: { deadline: new Date(Date.now() - 10000) },
      });
      const file = await upload(topic, auth),
        key = randomUUID(),
        body = {
          milestoneRevision: milestone.revision,
          attachmentIds: [file.body.data.id],
        };
      const results = await Promise.all([
        call(
          "post",
          `/milestones/${milestone.id}/submissions`,
          auth,
          body,
          key,
        ),
        call(
          "post",
          `/milestones/${milestone.id}/submissions`,
          auth,
          body,
          key,
        ),
      ]);
      for (const r of results) expect(r.status, r.text).toBe(201);
      expect(results[0].body.data.id).toBe(results[1].body.data.id);
      expect(results[0].body.data.isLate).toBe(true);
      const originalDeadline = results[0].body.data.deadlineSnapshot;
      await db.milestone.update({
        where: { id: milestone.id },
        data: { deadline: new Date(Date.now() + 100000) },
      });
      const next = await upload(topic, auth),
        latest = await db.milestone.findUnique({ where: { id: milestone.id } }),
        resubmitted = await call(
          "post",
          `/milestones/${milestone.id}/submissions`,
          auth,
          {
            milestoneRevision: latest.revision,
            attachmentIds: [next.body.data.id],
          },
        );
      expect(resubmitted.status, resubmitted.text).toBe(201);
      expect(resubmitted.body.data.version).toBe(2);
      expect(resubmitted.body.data.isLate).toBe(false);
      expect(
        (
          await db.submission.findUnique({
            where: { id: results[0].body.data.id },
          })
        ).deadlineSnapshot.toISOString(),
      ).toBe(originalDeadline);
      fixtures.versionTest = {
        auth,
        topic,
        milestone,
        old: results[0].body.data,
        current: resubmitted.body.data,
      };
    });
    it("TC19/20: không nhận xét bản cũ, không nộp mốc accepted khi chưa mở lại", async () => {
      const f = fixtures.versionTest;
      const wrong = await call(
        "post",
        `/submissions/${f.current.id}/reviews`,
        sessions.lecturer2,
        {
          submissionRevision: 1,
          comment: "Nhận xét sai giảng viên cần bị từ chối.",
          decision: "accepted",
        },
      );
      expect([403, 404]).toContain(wrong.status);
      expect(
        (
          await call(
            "post",
            `/submissions/${f.old.id}/reviews`,
            sessions.lecturer1,
            {
              submissionRevision: 1,
              comment: "Nhận xét bản cũ cần bị từ chối.",
              decision: "accepted",
            },
          )
        ).body.error.code,
      ).toBe("SUBMISSION_NOT_CURRENT");
      const accepted = await call(
        "post",
        `/submissions/${f.current.id}/reviews`,
        sessions.lecturer1,
        {
          submissionRevision: 1,
          comment: "Báo cáo hiện hành đáp ứng các yêu cầu đề ra.",
          decision: "accepted",
        },
      );
      expect(accepted.status).toBe(201);
      let m = await db.milestone.findUnique({ where: { id: f.milestone.id } });
      const file = await upload(f.topic, f.auth);
      expect(
        (
          await call("post", `/milestones/${m.id}/submissions`, f.auth, {
            milestoneRevision: m.revision,
            attachmentIds: [file.body.data.id],
          })
        ).body.error.code,
      ).toBe("MILESTONE_ACCEPTED");
      expect(
        (
          await call("post", `/milestones/${m.id}/reopen`, sessions.lecturer1, {
            revision: m.revision,
            reason: "Mở lại để bổ sung nội dung theo yêu cầu mới.",
          })
        ).status,
      ).toBe(200);
      m = await db.milestone.findUnique({ where: { id: m.id } });
      expect(
        (
          await call("post", `/milestones/${m.id}/submissions`, f.auth, {
            milestoneRevision: m.revision,
            attachmentIds: [file.body.data.id],
          })
        ).status,
      ).toBe(201);
    });
    it("TC21: nghiệm thu không dựa % tự khai, mở lại mốc làm mất điều kiện", async () => {
      const auth = await makeStudent(),
        topic = await makeTopic(auth, "in_progress");
      await call("post", `/topics/${topic.id}/progress-updates`, auth, {
        completedWork: "Khai báo hoàn thành nhưng chưa có báo cáo đạt.",
        difficulties: "",
        nextPlan: "Hoàn thiện các báo cáo còn thiếu để nộp.",
        selfReportedPercent: 100,
      });
      expect(
        (
          await call("post", `/topics/${topic.id}/request-evaluation`, auth, {
            revision: topic.revision,
          })
        ).body.error.code,
      ).toBe("REQUIRED_MILESTONE_NOT_ACCEPTED");
      await readyMilestones(topic, auth);
      let current = await workspace(topic, auth),
        m = await db.milestone.findFirst({ where: { topicId: topic.id } });
      const results = await Promise.all([
        call("post", `/milestones/${m.id}/reopen`, sessions.lecturer1, {
          revision: m.revision,
          reason: "Mở lại mốc nhằm kiểm tra điều kiện nghiệm thu.",
        }),
        call("post", `/topics/${topic.id}/request-evaluation`, auth, {
          revision: current.revision,
        }),
      ]);
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      const after = await db.topic.findUnique({ where: { id: topic.id } });
      expect(after.status).toBe(
        results[0].status === 200 ? "in_progress" : "pending_evaluation",
      );
      if (after.status === "pending_evaluation")
        expect(
          (await db.milestone.findUnique({ where: { id: m.id } }))
            .resubmissionAllowed,
        ).toBe(false);
    });
    it("TC22/23: kết quả độc lập điểm, hoàn thành giải phóng chỗ; sửa sai append-only", async () => {
      const auth = await makeStudent(),
        topic = await makeTopic(auth, "in_progress");
      await readyMilestones(topic, auth);
      let current = await workspace(topic, auth),
        r = await call("post", `/topics/${topic.id}/request-evaluation`, auth, {
          revision: current.revision,
        });
      expect(r.status, r.text).toBe(200);
      r = await call(
        "post",
        `/topics/${topic.id}/evaluations`,
        sessions.lecturer1,
        {
          revision: r.body.data.revision,
          result: "failed",
          score: 9.5,
          comment: "Điểm tham khảo cao nhưng kết quả do giảng viên quyết định.",
        },
      );
      expect(r.status, r.text).toBe(201);
      expect(r.body.data.result).toBe("failed");
      expect(
        await db.teamMember.count({
          where: { teamId: topic.teamId, active: true },
        }),
      ).toBe(0);
      current = await workspace(topic);
      const corrected = await call(
        "post",
        `/topics/${topic.id}/evaluation-corrections`,
        sessions.staff,
        {
          revision: current.revision,
          result: "passed",
          score: 2,
          comment: "Kết quả được sửa sai theo hồ sơ kiểm tra bổ sung.",
          correctionReason:
            "Sửa nhầm kết luận khi nhập liệu ở phiên bản đánh giá đầu.",
        },
      );
      expect(corrected.status, corrected.text).toBe(201);
      expect(corrected.body.data.version).toBe(2);
      expect(await db.evaluation.count({ where: { topicId: topic.id } })).toBe(
        2,
      );
      await expect(
        db.evaluation.update({
          where: { id: r.body.data.id },
          data: { result: "passed" },
        }),
      ).rejects.toThrow();
      fixtures.completed = { topic, auth };
    });
    it("TC24: thay giảng viên cần đồng ý, giảng viên cũ mất quyền workspace và file", async () => {
      const auth = await makeStudent(),
        topic = await makeTopic(auth, "in_progress"),
        uploaded = await upload(topic, auth);
      let r = await call("post", `/topics/${topic.id}/change-requests`, auth, {
        revision: topic.revision,
        type: "supervisor",
        afterData: { supervisorId: sessions.lecturer2.user.id },
        reason: "Đổi giảng viên phù hợp chuyên môn nghiên cứu mới.",
      });
      expect(r.status, r.text).toBe(201);
      const change = r.body.data;
      const premature = await call(
        "post",
        `/change-requests/${change.id}/decisions`,
        sessions.staff,
        {
          revision: 1,
          topicRevision: topic.revision,
          decision: "approve",
          reason: "Chấp thuận thay giảng viên khi đầy đủ xác nhận.",
        },
      );
      expect(premature.body.error.code).toBe("SUPERVISOR_NOT_CONFIRMED");
      r = await call("post", `/topics/${topic.id}/supervision-requests`, auth, {
        revision: topic.revision,
        lecturerId: sessions.lecturer2.user.id,
        changeRequestId: change.id,
      });
      expect(r.status, r.text).toBe(201);
      await call(
        "post",
        `/supervision-requests/${r.body.data.id}/respond`,
        sessions.lecturer2,
        { revision: 1, decision: "accept" },
      );
      r = await call(
        "post",
        `/change-requests/${change.id}/decisions`,
        sessions.staff,
        {
          revision: 1,
          topicRevision: topic.revision,
          decision: "approve",
          reason: "Giảng viên mới đã đồng ý và cán bộ chấp thuận.",
        },
      );
      expect(r.status, r.text).toBe(200);
      expect(
        (await call("get", `/topics/${topic.id}/workspace`, sessions.lecturer1))
          .status,
      ).toBe(404);
      expect(
        (
          await call(
            "post",
            `/attachments/${uploaded.body.data.id}/download-links`,
            sessions.lecturer1,
            {},
          )
        ).status,
      ).toBe(404);
      expect(
        (await call("get", `/topics/${topic.id}/workspace`, sessions.lecturer2))
          .status,
      ).toBe(200);
    });
    it("TC25: rời trước duyệt mất quyền hồ sơ, khoảng quyền sau duyệt chỉ đọc phiên bản cũ", async () => {
      const leader = await makeStudent(),
        member = await makeStudent(),
        topic = await makeTopic(leader);
      let team = await db.team.findUnique({ where: { id: topic.teamId } }),
        invite = await call("post", `/teams/${team.id}/invitations`, leader, {
          revision: team.revision,
          inviteeId: member.user.id,
        });
      await call(
        "post",
        `/team-invitations/${invite.body.data.id}/respond`,
        member,
        { revision: 1, decision: "accept" },
      );
      team = await db.team.findUnique({ where: { id: team.id } });
      expect(
        (
          await call("post", `/teams/${team.id}/leave`, member, {
            revision: team.revision,
          })
        ).status,
      ).toBe(200);
      expect(
        (await call("get", `/topics/${topic.id}/workspace`, member)).status,
      ).toBe(404);
      const f = fixtures.completed;
      const before = await call(
        "get",
        `/topics/${f.topic.id}/revisions`,
        f.auth,
      );
      expect(before.status).toBe(200);
      expect(before.body.data.length).toBeGreaterThan(0);
      const grant = await db.teamAccessGrant.findFirst({
        where: {
          membershipId: (
            await db.teamMember.findUnique({
              where: {
                teamId_studentId: {
                  teamId: f.topic.teamId,
                  studentId: f.auth.user.id,
                },
              },
            })
          ).id,
        },
      });
      const beyond = await db.topicRevision.create({
        data: {
          topicId: f.topic.id,
          version: 99,
          kind: "approved_change",
          snapshot: { title: "Phiên bản sau khoảng quyền" },
          createdBy: sessions.staff.user.id,
          publishedAt: new Date(grant.readableUntil.getTime() + 10000),
        },
      });
      expect(
        (await call("get", `/topics/${f.topic.id}/revisions/99`, f.auth))
          .status,
      ).toBe(404);
      expect(
        (await call("get", `/topics/${f.topic.id}/workspace`, f.auth)).body.data
          .historicalOnly,
      ).toBe(true);
    });
    it("TC26/27 partial: admin kỹ thuật/CB khác khoa không cấp link, link ký hạn đúng 300s", async () => {
      const file = await upload(fixtures.progress, sessions.student5);
      for (const auth of [sessions.admin, sessions.staff2, sessions.student1])
        expect(
          (
            await call(
              "post",
              `/attachments/${file.body.data.id}/download-links`,
              auth,
              {},
            )
          ).status,
        ).toBe(404);
      const link = await call(
        "post",
        `/attachments/${file.body.data.id}/download-links`,
        sessions.student5,
        {},
      );
      expect(link.status).toBe(200);
      const url = new URL(link.body.data.url);
      expect(
        Number(url.searchParams.get("expires_at")) -
          Math.floor(Date.now() / 1000),
      ).toBeGreaterThanOrEqual(299);
      expect(url.searchParams.get("type")).toBe("authenticated");
      expect(link.headers["cache-control"]).toBe("no-store");
    });
    it("TC28: pending hủy không đóng nhóm, quyết định mới hủy và giải phóng", async () => {
      const auth = await makeStudent(),
        topic = await makeTopic(auth),
        r = await call(
          "post",
          `/topics/${topic.id}/cancellation-requests`,
          auth,
          {
            revision: topic.revision,
            reason: "Không tiếp tục được nghiên cứu theo kế hoạch đã đề ra.",
          },
        );
      expect(r.status).toBe(201);
      expect(
        (await db.team.findUnique({ where: { id: topic.teamId } })).status,
      ).toBe("active");
      const decided = await call(
        "post",
        `/cancellation-requests/${r.body.data.id}/decisions`,
        sessions.staff,
        {
          revision: 1,
          decision: "approve",
          reason: "Cán bộ chấp thuận hủy hồ sơ theo đề nghị hợp lệ.",
        },
      );
      expect(decided.status, decided.text).toBe(200);
      expect(
        (await db.topic.findUnique({ where: { id: topic.id } })).status,
      ).toBe("cancelled");
      expect(
        await db.teamMember.count({
          where: { teamId: topic.teamId, active: true },
        }),
      ).toBe(0);
    });
    it("TC29: thống kê và CSV cùng bộ lọc, không lộ scope khoa khác", async () => {
      const report = await call(
          "get",
          `/reports/topics?status=in_progress&facultyId=${fixtures.faculty.id}`,
          sessions.staff,
        ),
        csv = await call(
          "get",
          `/reports/topics/export?status=in_progress&facultyId=${fixtures.faculty.id}`,
          sessions.staff,
        );
      expect(report.status).toBe(200);
      expect(csv.status).toBe(200);
      const codes = csv.text.match(/NCKH-\d{4}-\d+/g) ?? [];
      expect(codes.length).toBe(report.body.data.total);
      expect(new Set(codes).size).toBe(codes.length);
      expect(
        (
          await call(
            "get",
            `/reports/topics?facultyId=${fixtures.crossFaculty.id}`,
            sessions.staff,
          )
        ).body.data.total,
      ).toBe(0);
    });
    it("TC31: nhắc hạn chạy lại không trùng; cleanup không xóa asset được tham chiếu", async () => {
      const before = await db.notification.count();
      await reminders();
      const once = await db.notification.count();
      await reminders();
      expect(await db.notification.count()).toBe(once);
      expect(once).toBeGreaterThanOrEqual(before);
      const f = fixtures.versionTest,
        linked = await db.submissionFile.findFirst({
          where: { submissionId: f.old.id },
        });
      await db.attachment.update({
        where: { id: linked.attachmentId },
        data: { createdAt: new Date(Date.now() - 3 * 86400000) },
      });
      const orphan = await db.attachment.create({
        data: {
          topicId: f.topic.id,
          uploadedBy: f.auth.user.id,
          purpose: "report",
          originalName: "orphan.pdf",
          mimeType: "application/pdf",
          sizeBytes: 100,
          publicId: `nckh/${randomUUID()}`,
          createdAt: new Date(Date.now() - 3 * 86400000),
        },
      });
      // Uploaded but not yet submitted: must survive while the student waits to submit.
      const waiting = await db.attachment.create({
        data: {
          topicId: f.topic.id,
          uploadedBy: f.auth.user.id,
          purpose: "report",
          originalName: "waiting.pdf",
          mimeType: "application/pdf",
          sizeBytes: 100,
          publicId: `nckh/${randomUUID()}`,
          status: "ready",
          assetId: randomUUID(),
          sha256: "0".repeat(64),
          verifiedAt: new Date(),
          createdAt: new Date(Date.now() - 3 * 86400000),
        },
      });
      const { v2 } = await import("cloudinary");
      vi.spyOn(v2.api, "resources").mockResolvedValue({ resources: [] });
      await cleanup();
      expect(
        await db.attachment.findUnique({ where: { id: linked.attachmentId } }),
      ).not.toBeNull();
      expect(
        await db.attachment.findUnique({ where: { id: waiting.id } }),
      ).not.toBeNull();
      expect(
        await db.attachment.findUnique({ where: { id: orphan.id } }),
      ).toBeNull();
    });
    it("TC32: corpus rỗng thành công; lỗi SELECT giữ nháp, không giả điểm 0", async () => {
      const auth = await makeStudent(),
        topic = await makeTopic(auth);
      const original = db.topic.findMany.bind(db.topic);
      const spy = vi.spyOn(db.topic, "findMany");
      spy.mockRejectedValueOnce(new Error("corpus unavailable"));
      const { checkSimilarity } = await import("../server/src/similarity.js");
      await expect(checkSimilarity(db, auth.user, topic)).rejects.toMatchObject(
        { code: "SIMILARITY_UNAVAILABLE", status: 503 },
      );
      expect(
        (await db.topic.findUnique({ where: { id: topic.id } })).status,
      ).toBe("draft");
      spy.mockImplementationOnce(() => Promise.resolve([]));
      const result = await transaction((tx) =>
        checkSimilarity(
          {
            ...tx,
            topic: { ...tx.topic, findMany: () => Promise.resolve([]) },
          },
          auth.user,
          topic,
        ),
      );
      expect(result.corpusSize).toBe(0);
      expect(result.matches).toEqual([]);
      spy.mockRestore();
    });
    it("CSRF: thiếu header, Origin khác và không Origin bị chặn", async () => {
      for (const originValue of ["http://evil.test", undefined]) {
        let r = request(app)
          .post("/api/v1/auth/refresh")
          .set("X-CSRF-Protection", "1");
        if (originValue) r = r.set("Origin", originValue);
        expect((await r.send({})).status).toBe(403);
      }
      expect(
        (
          await request(app)
            .post("/api/v1/auth/refresh")
            .set("Origin", origin)
            .send({})
        ).status,
      ).toBe(403);
    });
    it("Validation: từ chối status, scope, giờ nộp và trường write không hỗ trợ", async () => {
      const r = await call(
        "patch",
        `/topics/${fixtures.draft.id}`,
        sessions.student1,
        {
          revision: 1,
          status: "approved",
          facultyId: fixtures.crossFaculty.id,
        },
      );
      expect(r.status).toBe(422);
      const user = await call("get", "/auth/me", sessions.student1);
      expect(user.body.data.refreshSessions).toBeUndefined();
    });
    it("Quản trị: CSV lỗi toàn bộ không ghi dở, mã khoa/lớp và CSV hợp lệ tạo thật", async () => {
      const suffix = randomUUID().slice(0, 8),
        head =
          "accountCode,email,fullName,password,facultyCode,classCode,roles\n",
        valid = `csv${suffix},csv${suffix}@demo.test,Sinh viên CSV,Strong-csv-password-2026!,CNTT,DEMO-KTPM26,student`,
        bad = await call("post", "/users/import", sessions.admin, {
          csv:
            head + valid + "\nbad,bad-email,Bad,short,CNTT,DEMO-KTPM26,student",
        });
      expect(bad.status, bad.text).toBe(422);
      expect(
        await db.user.count({ where: { email: `csv${suffix}@demo.test` } }),
      ).toBe(0);
      const good = await call("post", "/users/import", sessions.admin, {
        csv: head + valid,
      });
      expect(good.status, good.text).toBe(201);
      expect(good.body.data.created).toBe(1);
      // Password is hashed before the transaction; the CSV password must still log in.
      const imported = await call("post", "/auth/login", null, {
        email: `csv${suffix}@demo.test`,
        password: "Strong-csv-password-2026!",
      });
      expect(imported.status, imported.text).toBe(200);
    });
    it("DB: snapshot bất biến, partial unique và composite FK được thực thi", async () => {
      const rev = await db.topicRevision.findFirst();
      await expect(
        db.topicRevision.update({
          where: { id: rev.id },
          data: { snapshot: {} },
        }),
      ).rejects.toThrow();
      const member = await db.teamMember.findFirst({ where: { active: true } });
      await expect(
        db.teamMember.create({
          data: {
            teamId: fixtures.draft.teamId,
            studentId: member.studentId,
            periodId: randomUUID(),
          },
        }),
      ).rejects.toThrow();
    });
    it("TC24/25: đổi thành viên và trưởng nhóm, rời rồi tham gia lại không đọc khoảng vắng", async () => {
      const old = await makeStudent(),
        next = await makeStudent(),
        topic = await makeTopic(old, "in_progress");
      let change = await call(
        "post",
        `/topics/${topic.id}/change-requests`,
        old,
        {
          revision: topic.revision,
          type: "members",
          afterData: { memberIds: [next.user.id], leaderId: next.user.id },
          reason:
            "Chuyển người thực hiện và trưởng nhóm theo đề nghị đã thống nhất.",
        },
      );
      expect(change.status, change.text).toBe(201);
      let team = await db.team.findUnique({ where: { id: topic.teamId } }),
        invite = await call("post", `/teams/${team.id}/invitations`, old, {
          revision: team.revision,
          inviteeId: next.user.id,
          changeRequestId: change.body.data.id,
        });
      expect(invite.status, invite.text).toBe(201);
      expect(
        (
          await call(
            "post",
            `/team-invitations/${invite.body.data.id}/respond`,
            next,
            { revision: 1, decision: "accept" },
          )
        ).status,
      ).toBe(200);
      const decision = await call(
        "post",
        `/change-requests/${change.body.data.id}/decisions`,
        sessions.staff,
        {
          revision: 1,
          topicRevision: topic.revision,
          decision: "approve",
          reason: "Thành viên mới đã đồng ý; cập nhật nhóm theo hồ sơ hợp lệ.",
        },
      );
      expect(decision.status, decision.text).toBe(200);
      expect(
        (await call("get", `/topics/${topic.id}/revisions/2`, old)).status,
      ).toBe(404);
      expect(
        (await call("get", `/topics/${topic.id}/revisions/2`, next)).status,
      ).toBe(200);
      expect(
        (await call("get", `/topics/${topic.id}/revisions/1`, next)).status,
      ).toBe(404);
      let current = await workspace(topic, next);
      change = await call("post", `/topics/${topic.id}/change-requests`, next, {
        revision: current.revision,
        type: "members",
        afterData: {
          memberIds: [next.user.id, old.user.id],
          leaderId: next.user.id,
        },
        reason:
          "Mời thành viên cũ tham gia lại sau khoảng tạm dừng nghiên cứu.",
      });
      expect(change.status, change.text).toBe(201);
      team = await db.team.findUnique({ where: { id: topic.teamId } });
      invite = await call("post", `/teams/${team.id}/invitations`, next, {
        revision: team.revision,
        inviteeId: old.user.id,
        changeRequestId: change.body.data.id,
      });
      expect(invite.status, invite.text).toBe(201);
      await call(
        "post",
        `/team-invitations/${invite.body.data.id}/respond`,
        old,
        { revision: 1, decision: "accept" },
      );
      const returned = await call(
        "post",
        `/change-requests/${change.body.data.id}/decisions`,
        sessions.staff,
        {
          revision: 1,
          topicRevision: current.revision,
          decision: "approve",
          reason: "Đồng ý bổ sung lại thành viên với khoảng quyền mới.",
        },
      );
      expect(returned.status, returned.text).toBe(200);
      expect(
        (await call("get", `/topics/${topic.id}/revisions/1`, old)).status,
      ).toBe(200);
      expect(
        (await call("get", `/topics/${topic.id}/revisions/2`, old)).status,
      ).toBe(404);
      expect(
        (await call("get", `/topics/${topic.id}/revisions/3`, old)).status,
      ).toBe(200);
    });
    it("TC24: đổi nội dung sau duyệt tạo snapshot và kiểm tra lại tương tự", async () => {
      const auth = await makeStudent(),
        topic = await makeTopic(auth, "in_progress"),
        afterData = {
          title:
            "Nghiên cứu hoàn thiện hệ thống quản lý dữ liệu sinh viên phiên bản mới",
          fieldId: topic.fieldId,
          abstract: topic.abstract,
          objectives: topic.objectives,
          researchContent: topic.researchContent,
          methodology: topic.methodology,
          expectedOutcomes: topic.expectedOutcomes,
        };
      const requested = await call(
        "post",
        `/topics/${topic.id}/change-requests`,
        auth,
        {
          revision: topic.revision,
          type: "academic",
          afterData,
          reason:
            "Điều chỉnh phạm vi học thuật đã được nhóm và giảng viên thống nhất.",
        },
      );
      expect(requested.status, requested.text).toBe(201);
      const r = await call(
        "post",
        `/change-requests/${requested.body.data.id}/decisions`,
        sessions.staff,
        {
          revision: 1,
          topicRevision: topic.revision,
          decision: "approve",
          reason: "Chấp thuận nội dung điều chỉnh theo đề nghị hợp lệ.",
          warningJustification:
            "Đã rà soát cảnh báo tương tự trong dữ liệu thử nghiệm.",
        },
      );
      expect(r.status, r.text).toBe(200);
      expect(r.body.data.similarity.status).toBe("succeeded");
      expect(
        await db.topicRevision.count({ where: { topicId: topic.id } }),
      ).toBe(2);
      expect(
        (await db.topic.findUnique({ where: { id: topic.id } })).title,
      ).toBe(afterData.title);
    });
    it("TC09/16: sửa nội dung làm mất xác nhận hướng dẫn cũ và stale revision trả 409", async () => {
      const auth = await makeStudent(),
        topic = await makeTopic(auth),
        consent = await call(
          "post",
          `/topics/${topic.id}/supervision-requests`,
          auth,
          { revision: topic.revision, lecturerId: sessions.lecturer1.user.id },
        );
      await call(
        "post",
        `/supervision-requests/${consent.body.data.id}/respond`,
        sessions.lecturer1,
        { revision: 1, decision: "accept" },
      );
      const current = await workspace(topic, auth);
      const edit = await call("patch", `/topics/${topic.id}`, auth, {
        revision: current.revision,
        title: "Đề tài thay đổi nội dung sau khi giảng viên đồng ý",
      });
      expect(edit.status, edit.text).toBe(200);
      expect(
        (
          await call("post", `/topics/${topic.id}/submit`, auth, {
            revision: edit.body.data.revision,
          })
        ).body.error.code,
      ).toBe("SUPERVISOR_NOT_CONFIRMED");
      expect(
        (
          await call("patch", `/topics/${topic.id}`, auth, {
            revision: current.revision,
            title: "Cập nhật với revision cũ phải bị từ chối",
          })
        ).body.error.code,
      ).toBe("REVISION_CONFLICT");
    });
    it("TC18: finalize đúng deadline không muộn; sau đúng 1 ms có nhãn muộn", async () => {
      const auth = await makeStudent(),
        topic = await makeTopic(auth, "in_progress"),
        m = await db.milestone.findFirst({ where: { topicId: topic.id } }),
        a = await upload(topic, auth),
        b = await upload(topic, auth),
        deadline = new Date();
      await db.milestone.update({ where: { id: m.id }, data: { deadline } });
      vi.useFakeTimers({ toFake: ["Date"] });
      try {
        vi.setSystemTime(deadline);
        const exact = await call(
          "post",
          `/milestones/${m.id}/submissions`,
          auth,
          { milestoneRevision: m.revision, attachmentIds: [a.body.data.id] },
        );
        expect(exact.status, exact.text).toBe(201);
        expect(exact.body.data.isLate).toBe(false);
        vi.setSystemTime(new Date(deadline.getTime() + 1));
        const current = await db.milestone.findUnique({ where: { id: m.id } }),
          late = await call("post", `/milestones/${m.id}/submissions`, auth, {
            milestoneRevision: current.revision,
            attachmentIds: [b.body.data.id],
          });
        expect(late.status, late.text).toBe(201);
        expect(late.body.data.isLate).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
    it("Ảnh hồ sơ: decode ảnh thật, lưu public asset và chặn file giả", async () => {
      const { default: sharp } = await import("sharp"),
        buffer = await sharp({
          create: { width: 20, height: 20, channels: 3, background: "#123456" },
        })
          .png()
          .toBuffer();
      vi.spyOn(cloudStorage, "uploadPublicImage").mockImplementation(
        async (_buffer, publicId) => ({
          public_id: publicId,
          asset_id: randomUUID(),
          secure_url: `https://res.cloudinary.com/mock-cloudinary-test/image/upload/${publicId}.webp`,
        }),
      );
      const response = await request(app)
        .post("/api/v1/profile/avatar")
        .set("Origin", origin)
        .set("X-CSRF-Protection", "1")
        .set("Authorization", `Bearer ${sessions.student9.token}`)
        .attach("file", buffer, "avatar.png");
      expect(response.status, response.text).toBe(200);
      expect(
        (await db.user.findUnique({ where: { id: sessions.student9.user.id } }))
          .avatarUrl,
      ).toBe(response.body.data.avatarUrl);
      const bad = await request(app)
        .post("/api/v1/profile/avatar")
        .set("Origin", origin)
        .set("X-CSRF-Protection", "1")
        .set("Authorization", `Bearer ${sessions.student9.token}`)
        .attach("file", Buffer.from("fake"), "avatar.png");
      expect(bad.status).toBe(415);
    });
    it("TC31: đổi hạn rồi quay lại hạn cũ có deadlineVersion mới, không mất nhắc hạn", async () => {
      const auth = await makeStudent(),
        topic = await makeTopic(auth, "in_progress"),
        m = await db.milestone.findFirst({ where: { topicId: topic.id } }),
        deadline = new Date(Date.now() + 86400000);
      let updated = await db.milestone.update({
        where: { id: m.id },
        data: { deadline },
      });
      const firstVersion = updated.deadlineVersion;
      await reminders();
      const once = await db.notification.count({
        where: { entityId: topic.id, type: "deadline" },
      });
      await db.milestone.update({
        where: { id: m.id },
        data: { deadline: new Date(Date.now() + 10 * 86400000) },
      });
      updated = await db.milestone.update({
        where: { id: m.id },
        data: { deadline },
      });
      expect(updated.deadlineVersion).toBe(firstVersion + 2);
      await reminders();
      expect(
        await db.notification.count({
          where: { entityId: topic.id, type: "deadline" },
        }),
      ).toBeGreaterThan(once);
    });
    it("TC15/16: xóa file và finalize đồng thời không gắn asset đang bị xóa", async () => {
      const auth = await makeStudent(),
        topic = await makeTopic(auth, "in_progress"),
        m = await db.milestone.findFirst({ where: { topicId: topic.id } }),
        uploaded = await upload(topic, auth);
      let release, entered;
      const waiting = new Promise((resolve) => {
        entered = resolve;
      });
      cloudStorage.destroy.mockImplementationOnce(() => {
        entered();
        return new Promise((resolve) => {
          release = resolve;
        });
      });
      const deletion = call(
        "delete",
        `/attachments/${uploaded.body.data.id}`,
        auth,
      ).then((r) => r);
      await waiting;
      const finalize = await call(
        "post",
        `/milestones/${m.id}/submissions`,
        auth,
        {
          milestoneRevision: m.revision,
          attachmentIds: [uploaded.body.data.id],
        },
      );
      expect(finalize.body.error.code).toBe("FILE_NOT_READY");
      release({ result: "ok" });
      expect((await deletion).status).toBe(204);
      expect(
        await db.attachment.findUnique({
          where: { id: uploaded.body.data.id },
        }),
      ).toBeNull();
    });
    it("Ảnh nghiên cứu: ảnh riêng được gắn phiên bản cùng tài liệu báo cáo; không thay báo cáo bằng ảnh", async () => {
      const auth = await makeStudent(),
        topic = await makeTopic(auth, "in_progress"),
        m = await db.milestone.findFirst({ where: { topicId: topic.id } }),
        { default: sharp } = await import("sharp"),
        image = await sharp({
          create: { width: 20, height: 20, channels: 3, background: "#abcdef" },
        })
          .png()
          .toBuffer(),
        photo = await upload(
          topic,
          auth,
          "private_image",
          image,
          "evidence.png",
        ),
        pdf = await upload(topic, auth);
      expect(photo.status, photo.text).toBe(201);
      expect(
        (
          await call("post", `/milestones/${m.id}/submissions`, auth, {
            milestoneRevision: m.revision,
            attachmentIds: [photo.body.data.id],
          })
        ).body.error.code,
      ).toBe("REPORT_REQUIRED");
      const finalized = await call(
        "post",
        `/milestones/${m.id}/submissions`,
        auth,
        {
          milestoneRevision: m.revision,
          attachmentIds: [pdf.body.data.id, photo.body.data.id],
        },
      );
      expect(finalized.status, finalized.text).toBe(201);
      expect(
        await db.submissionFile.count({
          where: { submissionId: finalized.body.data.id },
        }),
      ).toBe(2);
    });
    it("TC04/25: không gỡ hoặc khóa admin hoạt động cuối cùng", async () => {
      let admin = await db.user.findUnique({
        where: { id: sessions.admin.user.id },
      });
      const locked = await call("patch", `/users/${admin.id}`, sessions.admin, {
        revision: admin.revision,
        status: "locked",
      });
      expect(locked.body.error.code).toBe("LAST_ADMIN");
      const student = await db.user.findUnique({
        where: { id: sessions.student1.user.id },
      });
      await db.user.update({
        where: { id: admin.id },
        data: { facultyId: student.facultyId, classId: student.classId },
      });
      try {
        const removed = await call(
          "put",
          `/users/${admin.id}/roles`,
          sessions.admin,
          { revision: admin.revision, roles: ["student"] },
        );
        expect(removed.body.error.code).toBe("LAST_ADMIN");
      } finally {
        await db.user.update({
          where: { id: admin.id },
          data: { facultyId: null, classId: null },
        });
      }
    });
    it("TC25: phân trang tiến độ và audit không lộ số sự kiện ngoài khoảng quyền", async () => {
      const f = fixtures.completed,
        member = await db.teamMember.findUnique({
          where: {
            teamId_studentId: {
              teamId: f.topic.teamId,
              studentId: f.auth.user.id,
            },
          },
        }),
        grant = await db.teamAccessGrant.findFirst({
          where: { membershipId: member.id, retainedAfterLeave: true },
        }),
        future = new Date(grant.readableUntil.getTime() + 86400000);
      await db.progressUpdate.create({
        data: {
          topicId: f.topic.id,
          authorId: f.auth.user.id,
          completedWork:
            "Dữ liệu sau khoảng quyền không được trả cho thành viên đã rời.",
          difficulties: "",
          nextPlan: "Không nằm trong phạm vi đọc của thành viên cũ.",
          selfReportedPercent: 100,
          createdAt: future,
        },
      });
      const progress = await call(
        "get",
        `/topics/${f.topic.id}/progress-updates`,
        f.auth,
      );
      expect(progress.status, progress.text).toBe(200);
      expect(progress.body.data).toEqual([]);
      expect(progress.body.meta.totalItems).toBe(0);
      const marker = randomUUID();
      await db.auditLog.create({
        data: {
          actorId: sessions.staff.user.id,
          action: "test.future_event",
          entityType: "topic",
          entityId: f.topic.id,
          facultyId: f.topic.facultyId,
          requestId: marker,
          reason: marker,
          createdAt: future,
        },
      });
      const logs = await call(
          "get",
          `/topics/${f.topic.id}/audit-logs`,
          f.auth,
        ),
        count = await db.auditLog.count({
          where: {
            entityId: f.topic.id,
            createdAt: { gte: grant.readableFrom, lt: grant.readableUntil },
          },
        });
      expect(logs.body.meta.totalItems).toBe(count);
      expect(logs.body.data.some((r) => r.reason === marker)).toBe(false);
      expect(logs.body.data.every((r) => r.actorName)).toBe(true);
    });
    it("TC05/09: đóng đợt chặn nhận lời mời ban đầu, không chiếm chỗ", async () => {
      const leader = await makeStudent(),
        member = await makeStudent(),
        team = await makeTeam(leader),
        invitation = await call(
          "post",
          `/teams/${team.id}/invitations`,
          leader,
          { revision: team.revision, inviteeId: member.user.id },
        );
      expect(invitation.status).toBe(201);
      const closed = await call(
        "patch",
        `/research-periods/${team.periodId}`,
        sessions.staff,
        { revision: 1, status: "closed" },
      );
      expect(closed.status, closed.text).toBe(200);
      const accepted = await call(
        "post",
        `/team-invitations/${invitation.body.data.id}/respond`,
        member,
        { revision: 1, decision: "accept" },
      );
      expect(accepted.body.error.code).toBe("REGISTRATION_CLOSED");
      expect(
        await db.teamMember.count({ where: { teamId: team.id, active: true } }),
      ).toBe(1);
    });
    it("TC01/02: JWT sai thuật toán, issuer, audience, chữ ký hoặc exp không hợp lệ", async () => {
      const { default: jwt } = await import("jsonwebtoken"),
        payload = jwt.decode(sessions.student1.token),
        options = {
          subject: payload.sub,
          issuer: process.env.JWT_ISSUER ?? "nckh-api",
          audience: process.env.JWT_AUDIENCE ?? "nckh-web",
          algorithm: "HS256",
          expiresIn: "15m",
        };
      for (const override of [
        { algorithm: "HS512" },
        { issuer: "wrong-issuer" },
        { audience: "wrong-audience" },
        { expiresIn: -1 },
      ]) {
        const token = jwt.sign(
          { sid: payload.sid, av: payload.av },
          process.env.JWT_SECRET,
          { ...options, ...override },
        );
        expect((await call("get", "/auth/me", token)).status).toBe(401);
      }
      const wrongSignature = jwt.sign(
        { sid: payload.sid, av: payload.av },
        "different-secret-with-at-least-32-bytes",
        { ...options },
      );
      expect((await call("get", "/auth/me", wrongSignature)).status).toBe(401);
    });
  },
);
