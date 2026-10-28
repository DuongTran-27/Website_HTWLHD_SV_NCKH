import { Router } from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { randomBytes, randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  db,
  ensure,
  fail,
  hash,
  loadUser,
  safeUser,
  transaction,
  ok,
  audit,
  rateLimitHandler,
} from "./core.js";

export const authRouter = Router();
const cookieName = "nckh_refresh";
const issuer = () => process.env.JWT_ISSUER ?? "nckh-api",
  audience = () => process.env.JWT_AUDIENCE ?? "nckh-web";
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: "strict",
  path: "/api/v1/auth",
});
const credentials = z
  .object({
    email: z.email().transform((s) => s.trim().toLowerCase()),
    password: z.string().min(1).max(200),
  })
  .strict();
const dummyHash = argon2.hash(randomBytes(32).toString("hex"), {
  type: argon2.argon2id,
});
export const passwordSchema = z
  .string()
  .min(12, "Mật khẩu tối thiểu 12 ký tự")
  .max(128);
const publicUser = (user) => ({
  ...safeUser(user),
  roles: user.roles,
  scopes: user.scopes,
});
function sign(user, session) {
  return jwt.sign(
    { sid: session.id, av: user.authVersion },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      subject: user.id,
      issuer: issuer(),
      audience: audience(),
      expiresIn: "15m",
    },
  );
}
async function newSession(
  tx,
  user,
  familyId = randomUUID(),
  expires = new Date(Date.now() + 7 * 86400000),
) {
  const token = randomBytes(48).toString("base64url");
  const session = await tx.refreshSession.create({
    data: {
      userId: user.id,
      familyId,
      tokenHash: hash(token),
      absoluteExpiresAt: expires,
    },
  });
  return { token, session };
}
export async function revokeUser(tx, userId, why) {
  await tx.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: why },
  });
}
export async function authenticate(req, _res, next) {
  try {
    const token = req.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
    ensure(token, 401, "UNAUTHENTICATED", "Vui lòng đăng nhập.");
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: issuer(),
        audience: audience(),
      });
    } catch {
      fail(
        401,
        "UNAUTHENTICATED",
        "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
      );
    }
    const [user, session] = await Promise.all([
      loadUser(payload.sub),
      db.refreshSession.findUnique({ where: { id: payload.sid } }),
    ]);
    ensure(
      user?.status === "active" &&
        session?.userId === user.id &&
        !session.revokedAt &&
        session.absoluteExpiresAt > new Date() &&
        payload.av === user.authVersion,
      401,
      "SESSION_REVOKED",
      "Phiên đăng nhập đã bị thu hồi.",
    );
    req.user = user;
    req.session = session;
    next();
  } catch (e) {
    next(e);
  }
}
export function originGuard(req, _res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("Origin");
  const allowed = (
    process.env.APP_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((s) => s.trim());
  // All writes, including cookie refresh, require the same-origin custom header.
  if (!allowed.includes(origin) || req.get("X-CSRF-Protection") !== "1")
    return next(
      Object.assign(new Error("Nguồn yêu cầu không hợp lệ."), {
        status: 403,
        code: "CSRF_REJECTED",
      }),
    );
  next();
}
authRouter.post(
  "/login",
  rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    skipSuccessfulRequests: true,
    handler: rateLimitHandler,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: {
        code: "RATE_LIMITED",
        message: "Thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.",
      },
    },
  }),
  async (req, res) => {
    const body = credentials.parse(req.body);
    const user = await db.user.findUnique({ where: { email: body.email } });
    const valid = await argon2.verify(
      user?.passwordHash ?? (await dummyHash),
      body.password,
    );
    ensure(
      valid && user?.status === "active",
      401,
      "INVALID_CREDENTIALS",
      "Email hoặc mật khẩu không đúng, hoặc tài khoản đã khóa.",
    );
    const result = await transaction(async (tx) => {
      const current = await loadUser(user.id, tx);
      ensure(
        current.status === "active" &&
          current.passwordHash === user.passwordHash,
        401,
        "INVALID_CREDENTIALS",
        "Thông tin đăng nhập đã thay đổi.",
      );
      const session = await newSession(tx, current);
      await audit(tx, current, "auth.login", "user", current, req);
      return { ...session, user: current };
    });
    res.set("Cache-Control", "no-store");
    res.cookie(cookieName, result.token, {
      ...cookieOptions(),
      expires: result.session.absoluteExpiresAt,
    });
    ok(res, req, {
      accessToken: sign(result.user, result.session),
      expiresIn: 900,
      user: publicUser(result.user),
    });
  },
);
authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies[cookieName];
  ensure(token, 401, "UNAUTHENTICATED", "Vui lòng đăng nhập.");
  // Reuse revocation must COMMIT, not roll back with the rejected response.
  const result = await transaction(async (tx) => {
    const old = await tx.refreshSession.findUnique({
      where: { tokenHash: hash(token) },
    });
    if (!old) return { error: true };
    if (old.rotatedAt || old.revokedAt) {
      await tx.refreshSession.updateMany({
        where: { familyId: old.familyId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: "refresh_reuse" },
      });
      return { error: true };
    }
    const user = await loadUser(old.userId, tx);
    if (user?.status !== "active" || old.absoluteExpiresAt <= new Date())
      return { error: true };
    const session = await newSession(
      tx,
      user,
      old.familyId,
      old.absoluteExpiresAt,
    );
    await tx.refreshSession.update({
      where: { id: old.id },
      data: { rotatedAt: new Date(), replacedBy: session.session.id },
    });
    return { ...session, user };
  });
  if (result.error) {
    res.clearCookie(cookieName, cookieOptions());
    fail(
      401,
      "SESSION_REVOKED",
      "Phiên đã hết hạn hoặc token được sử dụng lại.",
    );
  }
  res.set("Cache-Control", "no-store");
  res.cookie(cookieName, result.token, {
    ...cookieOptions(),
    expires: result.session.absoluteExpiresAt,
  });
  ok(res, req, {
    accessToken: sign(result.user, result.session),
    expiresIn: 900,
    user: publicUser(result.user),
  });
});
authRouter.post("/logout", authenticate, async (req, res) => {
  await transaction((tx) =>
    tx.refreshSession.updateMany({
      where: { familyId: req.session.familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "logout" },
    }),
  );
  res.clearCookie(cookieName, cookieOptions());
  res.status(204).end();
});
authRouter.get("/me", authenticate, (req, res) =>
  ok(res, req, publicUser(req.user)),
);
authRouter.patch("/password", authenticate, async (req, res) => {
  const body = z
    .object({ currentPassword: z.string(), newPassword: passwordSchema })
    .strict()
    .parse(req.body);
  ensure(
    await argon2.verify(req.user.passwordHash, body.currentPassword),
    422,
    "PASSWORD_INCORRECT",
    "Mật khẩu hiện tại không đúng.",
  );
  const passwordHash = await argon2.hash(body.newPassword, {
    type: argon2.argon2id,
  });
  await transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: req.user.id } });
    ensure(
      current.passwordHash === req.user.passwordHash,
      409,
      "REVISION_CONFLICT",
      "Mật khẩu đã thay đổi.",
    );
    await tx.user.update({
      where: { id: current.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        authVersion: { increment: 1 },
        revision: { increment: 1 },
      },
    });
    await revokeUser(tx, current.id, "password_change");
    await audit(tx, req.user, "auth.password_changed", "user", current, req);
  });
  res.clearCookie(cookieName, cookieOptions());
  ok(res, req, { requiresLogin: true });
});
