import argon2 from "argon2";
import { z } from "zod";
import { db, transaction, audit } from "../server/src/core.js";
try {
  const input = z
    .object({
      email: z.email(),
      fullName: z.string().min(2).max(200),
      password: z.string().min(16).max(128),
      accountCode: z.string().regex(/^[a-z0-9._-]{3,50}$/),
    })
    .parse({
      email: process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase(),
      fullName: process.env.BOOTSTRAP_ADMIN_NAME,
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
      accountCode: process.env.BOOTSTRAP_ADMIN_CODE ?? "administrator",
    });
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
  });
  const result = await transaction(async (tx) => {
    if (await tx.userRole.count({ where: { role: "admin" } }))
      return {
        created: false,
        reason:
          "An administrator already exists. Use account management to add another.",
      };
    const { password, ...profile } = input,
      user = await tx.user.create({ data: { ...profile, passwordHash } });
    await tx.userRole.create({ data: { userId: user.id, role: "admin" } });
    await audit(tx, null, "user.bootstrap_admin", "user", user);
    return { created: true, accountCode: user.accountCode };
  });
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(
    error instanceof z.ZodError
      ? "Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_PASSWORD (16+ chars), optional BOOTSTRAP_ADMIN_CODE in the protected server environment."
      : "Administrator bootstrap failed. No credentials are logged.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
