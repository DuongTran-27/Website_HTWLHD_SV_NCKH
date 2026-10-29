const url = new URL(process.env.DATABASE_URL);
url.pathname = "/nckh_e2e";
process.env.DATABASE_URL = url.toString();
process.env.MIGRATION_DATABASE_URL = url.toString();
process.env.APP_ORIGIN = "http://localhost:5174";
process.env.PORT = "4101";
process.env.NODE_ENV = "test";
// Empty, not deleted: Prisma reloads missing keys from .env, which would hand E2E the real Cloudinary account.
process.env.CLOUDINARY_CLOUD_NAME = "";
process.env.CLOUDINARY_API_KEY = "";
process.env.CLOUDINARY_API_SECRET = "";
await import("../../server/src/index.js");
