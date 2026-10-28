import { PrismaClient } from "@prisma/client";
import { spawnSync, spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { cpus, totalmem, platform } from "node:os";
import { randomUUID } from "node:crypto";
import {
  normalize,
  fitTfidf,
  vectorize,
  cosine,
  contentText,
} from "../server/src/similarity.js";
import { hash } from "../server/src/core.js";
import jwt from "jsonwebtoken";
const url = new URL(process.env.BENCH_DATABASE_URL ?? process.env.DATABASE_URL);
url.pathname = "/nckh_bench";
process.env.DATABASE_URL = url.toString();
process.env.MIGRATION_DATABASE_URL = url.toString();
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
let server;
try {
  const migrate = spawnSync(
    process.execPath,
    ["app/scripts/prisma.js", "migrate", "deploy"],
    { stdio: "inherit", env: process.env },
  );
  if (migrate.status) throw new Error("Benchmark migration failed.");
  const already = await db.topic.count();
  if (already !== 1000) {
    if (already)
      throw new Error(
        "Benchmark database contains unrelated data; use a fresh nckh_bench database.",
      );
    const faculty = await db.faculty.create({
        data: { code: "BENCH", name: "Khoa dữ liệu hiệu năng" },
      }),
      major = await db.major.create({
        data: { code: "BENCH", name: "Ngành hiệu năng", facultyId: faculty.id },
      }),
      cls = await db.class.create({
        data: {
          code: "BENCH",
          name: "Lớp hiệu năng",
          majorId: major.id,
          admissionYear: 2026,
        },
      }),
      field = await db.researchField.create({
        data: { code: "BENCH", name: "Dữ liệu tổng hợp" },
      }),
      period = await db.researchPeriod.create({
        data: {
          facultyId: faculty.id,
          name: "Đợt hiệu năng",
          academicYear: "2026-2027",
          registrationStart: new Date("2026-01-01"),
          registrationEnd: new Date("2027-01-01"),
        },
      }),
      lecturer = await db.user.create({
        data: {
          accountCode: "benchlecturer",
          email: "benchlecturer@invalid.test",
          fullName: "Giảng viên hiệu năng",
          passwordHash: "disabled-benchmark-login",
          facultyId: faculty.id,
        },
      });
    await db.userRole.create({
      data: { userId: lecturer.id, role: "lecturer" },
    });
    for (let batch = 0; batch < 10; batch++)
      await db.$transaction(
        async (tx) => {
          for (let j = 0; j < 100; j++) {
            const i = batch * 100 + j,
              id = randomUUID(),
              teamId = randomUUID(),
              studentId = randomUUID(),
              revisionId = randomUUID(),
              title = `Nghiên cứu ứng dụng ${["học máy", "cảm biến", "dữ liệu", "quản lý", "môi trường"][i % 5]} trong trường học ${i}`,
              abstract =
                `Dữ liệu hiệu năng số ${i} với phương pháp ${i % 17} khảo sát và thực nghiệm. `.repeat(
                  5,
                ),
              objectives = `Đánh giá hiệu quả giải pháp ${i % 29} trong phạm vi xác định.`,
              researchContent =
                `Phân tích, thiết kế và triển khai hệ thống minh họa ${i}. `.repeat(
                  6,
                );
            await tx.user.create({
              data: {
                id: studentId,
                accountCode: `bench${i}`,
                email: `bench${i}@invalid.test`,
                fullName: `Sinh viên hiệu năng ${i}`,
                facultyId: faculty.id,
                classId: cls.id,
                passwordHash: "disabled-benchmark-login",
              },
            });
            await tx.userRole.create({
              data: { userId: studentId, role: "student" },
            });
            await tx.team.create({
              data: {
                id: teamId,
                periodId: period.id,
                facultyId: faculty.id,
                leaderId: studentId,
                name: `Nhóm hiệu năng ${i}`,
              },
            });
            await tx.teamMember.create({
              data: { teamId, studentId, periodId: period.id },
            });
            await tx.topic.create({
              data: {
                id,
                teamId,
                periodId: period.id,
                facultyId: faculty.id,
                fieldId: field.id,
                supervisorId: lecturer.id,
                currentRevisionId: revisionId,
                approvedAt: new Date(),
                code: `NCKH-2026-${String(i + 1).padStart(4, "0")}`,
                title,
                normalizedTitle: normalize(title),
                abstract,
                objectives,
                researchContent,
                status: "approved",
              },
            });
            await tx.topicRevision.create({
              data: {
                id: revisionId,
                topicId: id,
                version: 1,
                snapshot: { title, abstract, objectives, researchContent },
                createdBy: studentId,
              },
            });
            await tx.supervisorAssignment.create({
              data: {
                topicId: id,
                lecturerId: lecturer.id,
                assignedBy: lecturer.id,
              },
            });
          }
        },
        { timeout: 60000 },
      );
  }
  const corpus = await db.topic.findMany(),
    queryText = "Nghiên cứu ứng dụng học máy trong trường học 50",
    lookup = [],
    similarity = [];
  for (let i = 0; i < 120; i++) {
    let start = performance.now();
    await db.topic.findMany({
      where: {
        status: "approved",
        title: {
          contains: ["học máy", "cảm biến", "dữ liệu", "quản lý"][i % 4],
        },
      },
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        fieldId: true,
        facultyId: true,
      },
    });
    if (i >= 20) lookup.push(performance.now() - start);
  }
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    await db.$queryRaw`SELECT id,similarity(normalized_title,${normalize(queryText)}) AS score FROM topics WHERE status='approved' ORDER BY score DESC LIMIT 5`;
    const model = fitTfidf(corpus.map(contentText)),
      q = vectorize(contentText(corpus[i]), model);
    corpus
      .map((t) => cosine(q, vectorize(contentText(t), model)))
      .sort((a, b) => b - a)
      .slice(0, 5);
    similarity.push(performance.now() - start);
  }
  const lecturer = await db.user.findUnique({
      where: { accountCode: "benchlecturer" },
    }),
    session = await db.refreshSession.create({
      data: {
        userId: lecturer.id,
        familyId: randomUUID(),
        tokenHash: hash(randomUUID()),
        absoluteExpiresAt: new Date(Date.now() + 600000),
      },
    }),
    token = jwt.sign(
      { sid: session.id, av: lecturer.authVersion },
      process.env.JWT_SECRET,
      {
        algorithm: "HS256",
        subject: lecturer.id,
        issuer: process.env.JWT_ISSUER ?? "nckh-api",
        audience: process.env.JWT_AUDIENCE ?? "nckh-web",
        expiresIn: "10m",
      },
    );
  server = spawn(process.execPath, ["app/server/src/index.js"], {
    env: { ...process.env, PORT: "4102", NODE_ENV: "test" },
    stdio: "ignore",
    windowsHide: true,
  });
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try {
      ready = (await fetch("http://127.0.0.1:4102/api/v1/health")).ok;
      if (ready) break;
    } catch {
      /* wait for owned server */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("Benchmark HTTP server did not become ready.");
  const http = [];
  for (let i = 0; i < 120; i++) {
    const start = performance.now(),
      response = await fetch(
        `http://127.0.0.1:4102/api/v1/topics?status=approved&search=${encodeURIComponent(["học máy", "cảm biến", "dữ liệu", "quản lý"][i % 4])}&pageSize=20`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    const payload = await response.json();
    if (!response.ok || payload.data.length !== 20)
      throw new Error("Benchmark API query failed.");
    if (i >= 20) http.push(performance.now() - start);
  }
  const summarize = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      samples: sorted.length,
      p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1],
      p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
      maxMs: sorted.at(-1),
    };
  };
  const result = {
    at: new Date().toISOString(),
    datasetTopics: 1000,
    environment: {
      node: process.version,
      postgres: (await db.$queryRaw`SELECT version()`)[0].version,
      os: platform(),
      cpu: cpus()[0].model,
      logicalCpus: cpus().length,
      ramGiB: Math.round(totalmem() / 2 ** 30),
    },
    method:
      "Sequential local tests, concurrency=1; 20 warm-up + 100 measured ordinary searches. HTTP includes authentication/session validation, scope, filters, pagination count, metadata enrichment and response parsing. Similarity separately includes rebuilding TF-IDF for 1000 documents.",
    lookup: summarize(lookup),
    httpLookup: summarize(http),
    similarity: summarize(similarity),
    syntheticDataset: true,
  };
  result.httpTargetUnder2s = result.httpLookup.p95Ms < 2000;
  writeFileSync(
    "app/docs/PERFORMANCE_RESULTS.json",
    JSON.stringify(result, null, 2),
  );
  writeFileSync(
    "app/docs/PERFORMANCE_REPORT.md",
    `# Đo hiệu năng local\n\n${result.at}\n\n1.000 đề tài tổng hợp trong nckh_bench, tách dữ liệu ứng dụng và bộ nhãn. ${result.method}\n\nTra cứu HTTP p95: ${result.httpLookup.p95Ms.toFixed(2)} ms. Truy vấn PostgreSQL riêng p95: ${result.lookup.p95Ms.toFixed(2)} ms. Tương tự pg_trgm + TF-IDF p95: ${result.similarity.p95Ms.toFixed(2)} ms.\n\nMục tiêu HTTP p95 <2 giây: ${result.httpTargetUnder2s ? "đạt trong cấu hình local đã đo" : "chưa đạt"}. Chưa đo mạng/tải đồng thời trên Vercel/Render/Supabase. Cấu hình máy và số mẫu: PERFORMANCE_RESULTS.json.\n`,
  );
  console.log(JSON.stringify(result));
} finally {
  server?.kill();
  await db.$disconnect();
  const { db: shared } = await import("../server/src/core.js");
  await shared.$disconnect();
}
