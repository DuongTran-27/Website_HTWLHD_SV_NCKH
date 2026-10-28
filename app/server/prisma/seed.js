import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { normalize } from "../src/similarity.js";
import { academicHash, pickAcademic } from "../src/core.js";
const db = new PrismaClient();
export const demoTitles = [
  "Ứng dụng học máy dự báo kết quả học tập của sinh viên",
  "Hệ thống tưới cây thông minh sử dụng cảm biến độ ẩm",
  "Website hỗ trợ quản lý hoạt động nghiên cứu khoa học sinh viên",
  "Phân tích chất lượng không khí trong khuôn viên trường học",
  "Nền tảng chia sẻ tài liệu học tập theo học phần",
  "Mô hình phân loại rác thải phục vụ trường học xanh",
  "Ứng dụng đặt lịch sử dụng phòng thí nghiệm trực tuyến",
  "Khảo sát hành vi sử dụng thư viện số của sinh viên",
  "Thiết kế hệ thống theo dõi tiêu thụ điện trong giảng đường",
];
export function demoAcademic(title, index = 0) {
  const subject = [
    "dữ liệu học tập và các chỉ số đánh giá",
    "cảm biến độ ẩm và thiết bị điều khiển",
    "quy trình đăng ký, xét duyệt và báo cáo nghiên cứu",
    "cảm biến bụi mịn và dữ liệu môi trường",
    "học liệu, người học và học phần",
    "hình ảnh rác thải và mô hình nhận dạng",
    "lịch phòng, thiết bị và nhu cầu thực hành",
    "thói quen tra cứu và trải nghiệm thư viện",
    "công tơ điện và mức sử dụng năng lượng",
  ][index % 9];
  return {
    title,
    abstract: `Nghiên cứu tập trung vào ${subject}. Nhóm xây dựng giải pháp thử nghiệm trong phạm vi một cơ sở giáo dục, thu thập dữ liệu hư cấu phục vụ kiểm thử và đánh giá tính khả thi bằng các tiêu chí được định nghĩa trước. Đây là dữ liệu minh họa cho hệ thống.`,
    objectives: `Xây dựng và đánh giá một giải pháp quản lý ${subject}, cải thiện khả năng theo dõi và hỗ trợ việc ra quyết định dựa trên dữ liệu.`,
    researchContent: `Khảo sát hiện trạng liên quan đến ${subject}; phân tích yêu cầu và xác định giới hạn bài toán. Thiết kế mô hình dữ liệu, thực hiện giải pháp, xây dựng các tình huống kiểm thử và đánh giá kết quả so với tiêu chí ban đầu. Các kết quả được tổng hợp thành báo cáo, nêu rõ ưu điểm, giới hạn và hướng phát triển của giải pháp nghiên cứu.`,
    methodology:
      "Khảo sát tài liệu, phân tích yêu cầu, xây dựng nguyên mẫu và đánh giá bằng các tình huống có kiểm soát.",
    expectedOutcomes:
      "Mã nguồn nguyên mẫu, bộ dữ liệu hư cấu, báo cáo đánh giá và hướng dẫn sử dụng.",
  };
}
async function seed() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seed is disabled in production.");
  if (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 12)
    throw new Error("Set DEMO_PASSWORD (12+ characters) in .env.");
  const passwordHash = await argon2.hash(process.env.DEMO_PASSWORD, {
    type: argon2.argon2id,
  });
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(72654001)`;
      const faculties = [];
      for (const [code, name] of [
        ["CNTT", "Khoa Công nghệ thông tin"],
        ["KT", "Khoa Kỹ thuật"],
      ])
        faculties.push(
          await tx.faculty.upsert({
            where: { code },
            create: { code, name },
            update: {},
          }),
        );
      const major = await tx.major.upsert({
          where: { code: "KTPM" },
          create: {
            code: "KTPM",
            name: "Kỹ thuật phần mềm",
            facultyId: faculties[0].id,
          },
          update: {},
        }),
        major2 = await tx.major.upsert({
          where: { code: "DTVT" },
          create: {
            code: "DTVT",
            name: "Điện tử viễn thông",
            facultyId: faculties[1].id,
          },
          update: {},
        });
      const cls = await tx.class.upsert({
          where: { code: "DEMO-KTPM26" },
          create: {
            code: "DEMO-KTPM26",
            name: "Lớp minh họa KTPM 2026",
            majorId: major.id,
            admissionYear: 2026,
          },
          update: {},
        }),
        cls2 = await tx.class.upsert({
          where: { code: "DEMO-DTVT26" },
          create: {
            code: "DEMO-DTVT26",
            name: "Lớp minh họa DTVT 2026",
            majorId: major2.id,
            admissionYear: 2026,
          },
          update: {},
        });
      const fields = [];
      for (const [code, name] of [
        ["AI", "Trí tuệ nhân tạo"],
        ["WEB", "Công nghệ phần mềm"],
        ["IOT", "Internet vạn vật"],
        ["DATA", "Khoa học dữ liệu"],
      ])
        fields.push(
          await tx.researchField.upsert({
            where: { code },
            create: { code, name },
            update: {},
          }),
        );
      const users = {};
      for (const [name, role, faculty] of [
        ...Array.from({ length: 16 }, (_, i) => [
          `student${i + 1}`,
          "student",
          i === 15 ? 1 : 0,
        ]),
        ["lecturer1", "lecturer", 0],
        ["lecturer2", "lecturer", 1],
        ["staff", "faculty_staff", 0],
        ["staff2", "faculty_staff", 1],
        ["admin", "admin", null],
      ]) {
        const user = await tx.user.upsert({
          where: { email: `${name}@demo.test` },
          create: {
            accountCode: name,
            email: `${name}@demo.test`,
            fullName:
              role === "student"
                ? `Sinh viên Demo ${name.replace("student", "").padStart(2, "0")}`
                : name === "lecturer1"
                  ? "TS. Giảng viên Minh họa A"
                  : name === "lecturer2"
                    ? "TS. Giảng viên Minh họa B"
                    : name === "admin"
                      ? "Quản trị viên Demo"
                      : `Cán bộ Demo ${faculty === 0 ? "CNTT" : "Kỹ thuật"}`,
            passwordHash,
            facultyId: faculty === null ? null : faculties[faculty].id,
            classId:
              role === "student" ? (faculty === 0 ? cls.id : cls2.id) : null,
            specialization:
              role === "lecturer"
                ? "Công nghệ phần mềm, dữ liệu và hệ thống thông minh"
                : null,
          },
          update: {},
        });
        users[name] = user;
        await tx.userRole.upsert({
          where: { userId_role: { userId: user.id, role } },
          create: { userId: user.id, role },
          update: {},
        });
        if (role === "faculty_staff")
          await tx.managementScope.upsert({
            where: {
              userId_facultyId: {
                userId: user.id,
                facultyId: faculties[faculty].id,
              },
            },
            create: { userId: user.id, facultyId: faculties[faculty].id },
            update: {},
          });
      }
      const now = Date.now(),
        templates = [
          "Đề cương nghiên cứu",
          "Báo cáo giữa kỳ",
          "Báo cáo tổng kết",
        ].map((name, i) => ({
          code: ["OUTLINE", "MIDTERM", "FINAL"][i],
          name,
          required: true,
          expectedOutput: `Tài liệu ${name.toLowerCase()} và kết quả thực hiện theo yêu cầu.`,
          deadline: new Date(now + (30 + i * 30) * 86400000).toISOString(),
          sortOrder: i,
        }));
      const periods = [];
      for (const [i, f] of faculties.entries()) {
        let period = await tx.researchPeriod.findFirst({
          where: { name: `Đợt nghiên cứu sinh viên 2026–2027 · ${f.code}` },
        });
        if (!period)
          period = await tx.researchPeriod.create({
            data: {
              facultyId: f.id,
              name: `Đợt nghiên cứu sinh viên 2026–2027 · ${f.code}`,
              academicYear: "2026-2027",
              registrationStart: new Date(now - 30 * 86400000),
              registrationEnd: new Date(now + 60 * 86400000),
              milestoneTemplates: templates,
            },
          });
        periods[i] = period;
      }
      if (
        !(await tx.researchPeriod.findFirst({
          where: { name: "Đợt minh họa đã đóng" },
        }))
      )
        await tx.researchPeriod.create({
          data: {
            facultyId: faculties[0].id,
            name: "Đợt minh họa đã đóng",
            academicYear: "2025-2026",
            status: "closed",
            registrationStart: new Date(now - 365 * 86400000),
            registrationEnd: new Date(now - 300 * 86400000),
            milestoneTemplates: templates,
          },
        });
      const states = [
        "draft",
        "submitted",
        "revision_required",
        "approved",
        "in_progress",
        "rejected",
        "cancelled",
      ];
      for (let i = 0; i < states.length; i++) {
        const code = `NCKH-2026-${9001 + i}`;
        if (await tx.topic.findUnique({ where: { code } })) continue;
        const state = states[i],
          student = users[`student${i + 1}`],
          past = new Date(now - 10 * 86400000),
          published = new Date(now - 8 * 86400000),
          ended = ["rejected", "cancelled"].includes(state),
          approved = ["approved", "in_progress"].includes(state);
        const team = await tx.team.create({
          data: {
            name: `Nhóm Demo ${String(i + 1).padStart(2, "0")}`,
            periodId: periods[0].id,
            facultyId: faculties[0].id,
            leaderId: student.id,
            status: ended ? "closed" : "active",
            closedReason: ended ? "Hồ sơ minh họa đã kết thúc" : null,
          },
        });
        const member = await tx.teamMember.create({
          data: {
            teamId: team.id,
            periodId: periods[0].id,
            studentId: student.id,
            joinedAt: past,
            active: !ended,
            leftAt: ended ? new Date(now - 86400000) : null,
          },
        });
        await tx.teamAccessGrant.create({
          data: {
            membershipId: member.id,
            readableFrom: past,
            readableUntil: ended ? new Date(now - 86400000) : null,
            revokedAt: ended ? new Date(now - 86400000) : null,
            grantedBy: student.id,
            revokeReason: ended ? "Kết thúc trước duyệt" : null,
          },
        });
        const academic = {
          ...demoAcademic(demoTitles[i], i),
          fieldId: fields[i % fields.length].id,
        };
        let topic = await tx.topic.create({
          data: {
            teamId: team.id,
            periodId: periods[0].id,
            facultyId: faculties[0].id,
            proposedSupervisorId: users.lecturer1.id,
            ...academic,
            code,
            normalizedTitle: normalize(academic.title),
            status: approved ? "draft" : state,
            supervisorId: approved ? users.lecturer1.id : null,
            approvedAt: approved ? published : null,
            submittedAt: state !== "draft" ? published : null,
          },
        });
        const consent = await tx.supervisionRequest.create({
          data: {
            topicId: topic.id,
            lecturerId: users.lecturer1.id,
            requestedBy: student.id,
            academicHash: academicHash(topic),
            status: i === 0 ? "pending" : "accepted",
            respondedAt: i === 0 ? null : published,
            expiresAt: periods[0].registrationEnd,
          },
        });
        if (state !== "draft") {
          const rev = await tx.topicRevision.create({
            data: {
              topicId: topic.id,
              version: 1,
              createdBy: student.id,
              publishedAt: published,
              snapshot: {
                ...pickAcademic(topic),
                teamId: team.id,
                teamName: team.name,
                leaderId: student.id,
                members: [
                  {
                    id: student.id,
                    fullName: student.fullName,
                    accountCode: student.accountCode,
                  },
                ],
                periodId: topic.periodId,
                facultyId: topic.facultyId,
                supervisorId: users.lecturer1.id,
              },
            },
          });
          topic = await tx.topic.update({
            where: { id: topic.id },
            data: {
              currentRevisionId: rev.id,
              revisionSequence: 1,
              status: state,
            },
          });
          if (
            [
              "approved",
              "in_progress",
              "revision_required",
              "rejected",
            ].includes(state)
          )
            await tx.topicDecision.create({
              data: {
                topicRevisionId: rev.id,
                decidedBy: users.staff.id,
                action: approved
                  ? "approve"
                  : state === "rejected"
                    ? "reject"
                    : "request_revision",
                reason: approved
                  ? "Hồ sơ demo được chấp thuận theo bộ yêu cầu."
                  : "Hồ sơ demo cần được điều chỉnh nội dung theo phản hồi.",
              },
            });
        }
        if (approved) {
          await tx.supervisorAssignment.create({
            data: {
              topicId: topic.id,
              lecturerId: users.lecturer1.id,
              assignedBy: users.staff.id,
              startedAt: published,
            },
          });
          for (const [index, m] of templates.entries())
            await tx.milestone.create({
              data: {
                ...m,
                topicId: topic.id,
                deadline: new Date(
                  now +
                    (i === 4 && index === 0 ? -1 : 7 + index * 30) * 86400000,
                ),
              },
            });
        }
        if (state === "in_progress") {
          await tx.progressUpdate.create({
            data: {
              topicId: topic.id,
              authorId: student.id,
              completedWork:
                "Hoàn thành khảo sát yêu cầu và thiết kế nguyên mẫu giao diện.",
              difficulties: "Cần bổ sung các tình huống thử nghiệm thực tế.",
              nextPlan:
                "Tích hợp chức năng, kiểm tra dữ liệu và hoàn thiện báo cáo.",
              selfReportedPercent: 45,
            },
          });
          await tx.topicChangeRequest.create({
            data: {
              topicId: topic.id,
              requestedBy: student.id,
              type: "members",
              beforeData: { memberIds: [student.id], leaderId: student.id },
              afterData: {
                memberIds: [student.id, users.student10.id],
                leaderId: student.id,
              },
              baseRevision: topic.revision,
              reason: "Bổ sung thành viên hỗ trợ hoàn thiện phần kiểm thử.",
            },
          });
          await tx.topicCancellationRequest.create({
            data: {
              topicId: topic.id,
              requestedBy: student.id,
              reason:
                "Yêu cầu minh họa để kiểm tra quy trình từ chối đề nghị hủy.",
              status: "rejected",
              decidedBy: users.staff.id,
              decisionReason:
                "Tiếp tục thực hiện theo kế hoạch nghiên cứu đã thống nhất.",
              decidedAt: published,
            },
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: users.admin.id,
            action: "seed.demo_created",
            entityType: "topic",
            entityId: topic.id,
            facultyId: topic.facultyId,
            requestId: randomUUID(),
            afterData: { demo: true, status: state },
          },
        });
        await tx.notification.create({
          data: {
            recipientId: student.id,
            type: "welcome",
            title: "Chào mừng đến không gian nghiên cứu",
            body: "Dữ liệu minh họa. Bạn có thể quản lý hồ sơ và theo dõi các mốc tại đây.",
            entityType: "topic",
            entityId: topic.id,
            eventKey: `demo:${topic.id}`,
          },
        });
      }
      await tx.$executeRaw`SELECT setval('topic_code_sequence', greatest((SELECT last_value FROM topic_code_sequence),9007))`;
      let cross = await tx.team.findFirst({
        where: { name: "Nhóm Demo khoa Kỹ thuật" },
      });
      if (!cross) {
        cross = await tx.team.create({
          data: {
            name: "Nhóm Demo khoa Kỹ thuật",
            facultyId: faculties[1].id,
            periodId: periods[1].id,
            leaderId: users.student16.id,
          },
        });
        const m = await tx.teamMember.create({
          data: {
            teamId: cross.id,
            studentId: users.student16.id,
            periodId: periods[1].id,
          },
        });
        await tx.teamAccessGrant.create({
          data: {
            membershipId: m.id,
            readableFrom: new Date(),
            grantedBy: users.student16.id,
          },
        });
      }
      const demoTeam = await tx.team.findFirst({
        where: { leaderId: users.student1.id, status: "active" },
      });
      if (
        !(await tx.teamInvitation.count({
          where: { teamId: demoTeam.id, inviteeId: users.student8.id },
        }))
      )
        await tx.teamInvitation.create({
          data: {
            teamId: demoTeam.id,
            inviteeId: users.student8.id,
            invitedBy: users.student1.id,
            expiresAt: periods[0].registrationEnd,
          },
        });
    },
    { timeout: 30000 },
  );
  console.log(
    "Demo seed complete (repeatable). No fake Cloudinary assets were created. Report/evaluation examples require seed:cloud after configuring Cloudinary.",
  );
}
seed()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    const { db: shared } = await import("../src/core.js");
    await shared.$disconnect();
  });
