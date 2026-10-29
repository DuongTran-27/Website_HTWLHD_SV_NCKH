import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { db, ensure, ok, rateLimitHandler } from "./core.js";
import { authRouter, authenticate, originGuard } from "./auth.js";
import { adminRouter } from "./admin.js";
import { teamsRouter } from "./teams.js";
import { topicsRouter } from "./topics.js";
import { progressRouter } from "./progress.js";
import { filesRouter } from "./files.js";
import { reportingRouter } from "./reporting.js";
import { runJobs } from "./jobs.js";
import swaggerUi from "swagger-ui-express";
export function createApp() {
  ensure(
    process.env.JWT_SECRET?.length >= 32,
    500,
    "CONFIGURATION_ERROR",
    "JWT_SECRET phải có ít nhất 32 ký tự.",
  );
  if (process.env.NODE_ENV === "production") {
    ensure(
      !/REPLACE|CHANGE_ME/i.test(process.env.JWT_SECRET) &&
        process.env.COOKIE_SECURE === "true",
      500,
      "CONFIGURATION_ERROR",
      "Production cần JWT_SECRET riêng và cookie Secure.",
    );
    const origins = (process.env.APP_ORIGIN ?? "").split(",").filter(Boolean);
    ensure(
      origins.length &&
        origins.every((origin) => {
          try {
            return new URL(origin).protocol === "https:";
          } catch {
            return false;
          }
        }),
      500,
      "CONFIGURATION_ERROR",
      "Production cần APP_ORIGIN là địa chỉ HTTPS hợp lệ.",
    );
  }
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set("X-Request-Id", req.requestId);
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === "production"
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                connectSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                frameAncestors: ["'none'"],
              },
            }
          : false,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "1100kb" }));
  app.get("/api/v1/health", (req, res) => ok(res, req, { status: "ok" }));
  app.get("/api/v1/ready", async (req, res) => {
    await db.$queryRaw`SELECT 1`;
    ok(res, req, { status: "ready" });
  });
  app.post("/api/v1/internal/jobs", async (req, res) => {
    const expected = process.env.SCHEDULER_SECRET,
      actual = req.get("Authorization")?.replace(/^Bearer /, "");
    ensure(
      expected &&
        actual &&
        expected.length === actual.length &&
        timingSafeEqual(Buffer.from(expected), Buffer.from(actual)),
      401,
      "UNAUTHENTICATED",
      "Không có quyền chạy tác vụ.",
    );
    ok(res, req, await runJobs());
  });
  app.use("/api/v1", originGuard);
  app.use("/api/v1/auth", authRouter);
  app.get("/api/v1/openapi.json", (_req, res) => {
    const path = fileURLToPath(
      new URL("../../docs/openapi.json", import.meta.url),
    );
    res.type("json").send(readFileSync(path, "utf8"));
  });
  app.use(
    "/api/v1/docs",
    swaggerUi.serve,
    swaggerUi.setup(null, {
      swaggerOptions: { url: "/api/v1/openapi.json" },
      customSiteTitle: "Research Hub API",
    }),
  );
  app.use("/api/v1", authenticate, (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (req.user.mustChangePassword)
      return next(
        Object.assign(new Error("Vui lòng đổi mật khẩu trước khi tiếp tục."), {
          status: 403,
          code: "PASSWORD_CHANGE_REQUIRED",
        }),
      );
    next();
  });
  app.use(
    "/api/v1",
    rateLimit({
      windowMs: 60000,
      limit: 600,
      handler: rateLimitHandler,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    adminRouter,
    teamsRouter,
    topicsRouter,
    progressRouter,
    filesRouter,
    reportingRouter,
  );
  app.use("/api", (_req, _res, next) =>
    next(
      Object.assign(new Error("Không tìm thấy API."), {
        status: 404,
        code: "RESOURCE_NOT_FOUND",
      }),
    ),
  );
  const dist = resolve(
    fileURLToPath(new URL("../../client/dist", import.meta.url)),
  );
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve(dist, "index.html")),
    );
  }
  app.use((error, req, res, _next) => {
    if (error instanceof z.ZodError)
      return res.status(422).json({
        error: {
          code: "VALIDATION_FAILED",
          message: "Vui lòng kiểm tra thông tin đã nhập.",
          details: {
            fields: error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
        },
        requestId: req.requestId,
      });
    let status = error.status ?? 500,
      code = error.code ?? "INTERNAL_ERROR",
      message = error.message;
    if (error.type === "entity.parse.failed") {
      status = 400;
      code = "MALFORMED_REQUEST";
      message = "Dữ liệu yêu cầu không đúng định dạng JSON.";
    } else if (error.type === "entity.too.large") {
      status = 413;
      code = "PAYLOAD_TOO_LARGE";
      message = "Dữ liệu yêu cầu vượt giới hạn.";
    } else if (error.code === "LIMIT_FILE_SIZE") {
      status = 413;
      code = "FILE_TOO_LARGE";
      message = req.path.includes("/profile/avatar")
        ? "Ảnh tối đa 5 MB."
        : "Tài liệu tối đa 10 MB.";
    } else if (error.name === "MulterError") {
      status = 422;
      code = "INVALID_UPLOAD";
      message = "Mỗi yêu cầu chỉ nhận một file và loại tài liệu.";
    } else if (error.code === "P2002") {
      status = 409;
      code = "UNIQUE_CONFLICT";
      message = "Dữ liệu bị trùng hoặc đã được xử lý. Vui lòng tải lại.";
    } else if (["P2003", "P2004", "P2010", "P2014"].includes(error.code)) {
      status = 409;
      code = "INTEGRITY_CONFLICT";
      message =
        "Dữ liệu không thỏa điều kiện nghiệp vụ hoặc đang được tham chiếu.";
    } else if (["P1001", "P1002", "P1017", "P2024"].includes(error.code)) {
      status = 503;
      code = "DEPENDENCY_UNAVAILABLE";
      message = "Dịch vụ dữ liệu tạm thời không sẵn sàng.";
    }
    if (status >= 500 && !error.status) {
      message =
        "Không xử lý được yêu cầu. Vui lòng thử lại hoặc cung cấp mã yêu cầu cho quản trị viên.";
      console.error(
        JSON.stringify({
          requestId: req.requestId,
          code: error.code ?? error.name,
          message: "Request failed",
        }),
      );
    }
    res.status(status).json({
      error: {
        code,
        message,
        ...(error.details ? { details: error.details } : {}),
      },
      requestId: req.requestId,
    });
  });
  return app;
}
