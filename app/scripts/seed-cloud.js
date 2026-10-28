// Optional demo enrichment. Every stored file is actually uploaded and downloaded from Cloudinary.
import { PDFDocument } from "pdf-lib";
import { randomUUID } from "node:crypto";
import {
  db,
  transaction,
  ensure,
  found,
  academicHash,
  pickAcademic,
  event,
  hash,
} from "../server/src/core.js";
import {
  cloudStorage,
  configureCloud,
  validateFile,
} from "../server/src/files.js";
import { activateMember } from "../server/src/teams.js";
import { snapshot, readyForEvaluation } from "../server/src/topics.js";
import { closeTeam } from "../server/src/permissions.js";
import { normalize, publishCorpus } from "../server/src/similarity.js";
async function scenario(name, studentCode, target) {
  let topic = await transaction(async (tx) => {
    const oldTeam = await tx.team.findFirst({ where: { name } });
    if (oldTeam) return tx.topic.findUnique({ where: { teamId: oldTeam.id } });
    const base = await tx.topic.findUnique({
        where: { code: "NCKH-2026-9005" },
      }),
      student = await tx.user.findUnique({
        where: { accountCode: studentCode },
      }),
      staff = await tx.user.findUnique({ where: { accountCode: "staff" } }),
      lecturer = await tx.user.findUnique({
        where: { accountCode: "lecturer1" },
      });
    ensure(
      base && student && staff && lecturer,
      422,
      "SEED_REQUIRED",
      "Chạy seed local trước.",
    );
    const team = await tx.team.create({
      data: {
        name,
        periodId: base.periodId,
        facultyId: base.facultyId,
        leaderId: student.id,
      },
    });
    await activateMember(tx, team, student.id, student.id);
    const seq =
        await tx.$queryRaw`SELECT nextval('topic_code_sequence') AS value`,
      title = `${name}: ứng dụng dữ liệu hỗ trợ hoạt động học thuật`,
      academic = { ...pickAcademic(base), title };
    let row = await tx.topic.create({
      data: {
        ...academic,
        teamId: team.id,
        periodId: base.periodId,
        facultyId: base.facultyId,
        proposedSupervisorId: lecturer.id,
        normalizedTitle: normalize(title),
        code: `NCKH-${new Date().getUTCFullYear()}-${String(seq[0].value).padStart(4, "0")}`,
      },
    });
    await tx.supervisionRequest.create({
      data: {
        topicId: row.id,
        lecturerId: lecturer.id,
        requestedBy: student.id,
        academicHash: academicHash(row),
        status: "accepted",
        respondedAt: new Date(),
      },
    });
    const rev = await snapshot(tx, row, student);
    await tx.topicDecision.create({
      data: {
        topicRevisionId: rev.id,
        decidedBy: staff.id,
        action: "approve",
        reason: "Dữ liệu demo có tài liệu thật phục vụ kiểm thử tích hợp.",
        warningJustification:
          "Nội dung minh họa được tạo có chủ đích; không phải kết quả nghiên cứu thực.",
      },
    });
    await tx.supervisorAssignment.create({
      data: { topicId: row.id, lecturerId: lecturer.id, assignedBy: staff.id },
    });
    row = await tx.topic.update({
      where: { id: row.id },
      data: {
        status: "in_progress",
        supervisorId: lecturer.id,
        approvedAt: new Date(),
        revision: { increment: 1 },
      },
    });
    const period = await found("researchPeriod", row.periodId, tx);
    for (const [i, m] of period.milestoneTemplates.entries())
      await tx.milestone.create({
        data: {
          ...m,
          topicId: row.id,
          deadline: new Date(
            Date.now() + (i === 0 ? -1 : 14 + i * 14) * 86400000,
          ),
        },
      });
    await event(tx, staff, "seed.cloud_topic_created", row, null);
    await publishCorpus(tx);
    return row;
  });
  if (topic.status === target && target !== "in_progress") return;
  const student = await db.user.findUnique({
      where: { accountCode: studentCode },
    }),
    lecturer = await db.user.findUnique({
      where: { accountCode: "lecturer1" },
    }),
    milestones = await db.milestone.findMany({
      where: { topicId: topic.id },
      orderBy: { sortOrder: "asc" },
    });
  for (const [i, milestone] of milestones.entries()) {
    const planned = i === 0 && target === "in_progress" ? 2 : 1;
    for (let version = 1; version <= planned; version++) {
      if (
        await db.submission.findUnique({
          where: {
            milestoneId_version: { milestoneId: milestone.id, version },
          },
        })
      )
        continue;
      const pdf = await PDFDocument.create(),
        page = pdf.addPage();
      page.drawText(
        `Synthetic research report: ${studentCode}, stage ${i + 1}, version ${version}`,
      );
      page.drawText("Demo data only. Not an academic research result.", {
        x: 30,
        y: 700,
      });
      const buffer = Buffer.from(await pdf.save());
      await validateFile(buffer, "report.pdf", "report");
      const publicId = `nckh/${randomUUID()}.pdf`;
      let file = await transaction((tx) =>
        tx.attachment.create({
          data: {
            topicId: topic.id,
            uploadedBy: student.id,
            purpose: "report",
            originalName: `bao-cao-moc-${i + 1}-v${version}.pdf`,
            mimeType: "application/pdf",
            sizeBytes: buffer.length,
            sha256: hash(buffer),
            publicId,
          },
        }),
      );
      try {
        const uploaded = await cloudStorage.upload(buffer, {
          public_id: publicId,
          resource_type: "raw",
        });
        ensure(
          uploaded.asset_id &&
            uploaded.public_id === publicId &&
            uploaded.bytes === buffer.length,
          503,
          "UPLOAD_FAILED",
          "Không xác minh được tài liệu demo.",
        );
        file = await transaction((tx) =>
          tx.attachment.update({
            where: { id: file.id },
            data: {
              status: "ready",
              assetId: uploaded.asset_id,
              verifiedAt: new Date(),
            },
          }),
        );
        const response = await fetch(cloudStorage.download(file));
        ensure(
          response.ok &&
            hash(Buffer.from(await response.arrayBuffer())) === file.sha256,
          503,
          "DOWNLOAD_FAILED",
          "Tải lại tài liệu demo không đúng checksum.",
        );
      } catch (error) {
        await db.attachment.update({
          where: { id: file.id },
          data: { status: "failed", errorCode: "SEED_UPLOAD_FAILED" },
        });
        throw error;
      }
      await transaction(async (tx) => {
        const current = await found("milestone", milestone.id, tx),
          submittedAt = new Date(),
          updated = await tx.milestone.update({
            where: { id: current.id },
            data: {
              submissionSequence: { increment: 1 },
              revision: { increment: 1 },
            },
          });
        ensure(
          updated.submissionSequence === version,
          409,
          "SEED_CONFLICT",
          "Dữ liệu demo đã được chỉnh sửa; không ghi đè.",
        );
        const accepted = !(
            i === 0 &&
            target === "in_progress" &&
            version === 1
          ),
          submission = await tx.submission.create({
            data: {
              topicId: topic.id,
              milestoneId: current.id,
              submittedBy: student.id,
              version,
              submittedAt,
              deadlineSnapshot: current.deadline,
              isLate: submittedAt > current.deadline,
              status: accepted ? "accepted" : "changes_requested",
              note: "Tài liệu demo đã upload và kiểm tra tải lại từ Cloudinary.",
            },
          });
        await tx.submissionFile.create({
          data: {
            submissionId: submission.id,
            attachmentId: file.id,
            topicId: topic.id,
          },
        });
        await tx.review.create({
          data: {
            submissionId: submission.id,
            reviewerId: lecturer.id,
            decision: accepted ? "accepted" : "changes_requested",
            comment: accepted
              ? "Bản báo cáo minh họa đáp ứng các đầu ra thử nghiệm."
              : "Bổ sung nội dung và nộp lại thành phiên bản mới để đánh giá.",
          },
        });
        await event(tx, student, "submission.finalized", topic, null, {
          afterData: {
            submissionId: submission.id,
            version,
            isLate: submission.isLate,
          },
        });
      });
    }
  }
  if (target !== "in_progress")
    await transaction(async (tx) => {
      let current = await found("topic", topic.id, tx);
      if (current.status === "completed") return;
      await readyForEvaluation(tx, current);
      current = await tx.topic.update({
        where: { id: current.id },
        data: { status: "pending_evaluation", revision: { increment: 1 } },
      });
      if (target === "completed") {
        const updated = await tx.topic.update({
          where: { id: current.id },
          data: {
            status: "completed",
            evaluationSequence: { increment: 1 },
            completedAt: new Date(),
            revision: { increment: 1 },
          },
        });
        await tx.evaluation.create({
          data: {
            topicId: current.id,
            version: updated.evaluationSequence,
            evaluatorId: lecturer.id,
            result: "passed",
            score: 8.6,
            comment:
              "Kết quả minh họa được ghi nhận sau khi mọi báo cáo hiện hành đã đạt.",
          },
        });
        await event(tx, lecturer, "topic.evaluated", updated, null);
        await closeTeam(tx, updated, "Đề tài demo đã hoàn thành");
      }
      await publishCorpus(tx);
    });
}
try {
  ensure(
    process.env.NODE_ENV !== "production",
    403,
    "SEED_DISABLED",
    "Không seed demo vào production.",
  );
  configureCloud();
  await scenario("Nhóm Demo Cloudinary tiến độ", "student12", "in_progress");
  await scenario(
    "Nhóm Demo Cloudinary nghiệm thu",
    "student13",
    "pending_evaluation",
  );
  await scenario("Nhóm Demo Cloudinary hoàn thành", "student14", "completed");
  console.log(
    "Cloud demo reports, versions, late submissions and evaluation created using real stored/downloaded files.",
  );
} catch (error) {
  console.error(
    error.status
      ? error.message
      : "Cloud demo enrichment failed. Existing data is preserved; check Cloudinary and retry.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
