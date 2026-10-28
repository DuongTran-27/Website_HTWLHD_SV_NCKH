import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { cloudStorage, validateFile } from "../server/src/files.js";
import { hash, db } from "../server/src/core.js";
const required = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ],
  missing = required.filter((k) => !process.env[k]),
  assets = [];
const report = {
  at: new Date().toISOString(),
  status: "not_run",
  missing,
  checks: {
    upload20MB: "not_run",
    privatePdfDownload: "not_run",
    expiresAfter5Minutes: "not_run",
    publicImage: "not_run",
  },
  notes: [],
};
try {
  if (missing.length) {
    report.status = "blocked";
    report.notes.push(
      "Configure the missing variables in .env. Never send secrets in chat.",
    );
    process.exitCode = 2;
  } else {
    const pdf = await PDFDocument.create();
    pdf
      .addPage()
      .drawText("Cloudinary capability verification - synthetic document.");
    const base = Buffer.from(await pdf.save()),
      suffix = Buffer.from("\n%%EOF\n"),
      buffer = Buffer.concat([
        base,
        Buffer.from("\n%"),
        Buffer.alloc(20000000 - base.length - 2 - suffix.length, 0x41),
        suffix,
      ]);
    await validateFile(buffer, "capability.pdf", "report");
    const publicId = `nckh-probes/${randomUUID()}.pdf`,
      result = await cloudStorage.upload(buffer, {
        public_id: publicId,
        resource_type: "raw",
      }),
      file = {
        publicId: result.public_id,
        resourceType: "raw",
        deliveryType: "authenticated",
        originalName: "capability.pdf",
      };
    assets.push(file);
    if (result.bytes !== 20000000)
      throw new Error("Uploaded byte count differs from 20 MB.");
    report.checks.upload20MB = "passed";
    const url = cloudStorage.download(file),
      response = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok)
      throw new Error(
        "Private PDF download failed. Check raw authenticated download format and PDF account delivery settings.",
      );
    if (hash(Buffer.from(await response.arrayBuffer())) !== hash(buffer))
      throw new Error("Downloaded PDF checksum differs.");
    report.checks.privatePdfDownload = "passed";
    const image = await sharp({
        create: { width: 64, height: 64, channels: 3, background: "#2954cc" },
      })
        .png()
        .toBuffer(),
      imageResult = await cloudStorage.uploadPublicImage(
        image,
        `nckh-probes/${randomUUID()}`,
      );
    assets.push({
      publicId: imageResult.public_id,
      resourceType: "image",
      deliveryType: "upload",
    });
    const imageResponse = await fetch(imageResult.secure_url);
    if (!imageResponse.ok) throw new Error("Public image download failed.");
    report.checks.publicImage = "passed";
    if (process.argv.includes("--expiry")) {
      console.log(
        "Waiting for the five-minute download link to expire; no signed URL is logged.",
      );
      const until = Date.now() + 305000;
      while (Date.now() < until)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(30000, until - Date.now())),
        );
      const expired = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (expired.ok)
        throw new Error("Expired URL still returned a successful response.");
      report.checks.expiresAfter5Minutes = "passed";
    } else
      report.notes.push(
        "Run with --expiry to verify the same link is rejected after five minutes.",
      );
    report.status = Object.values(report.checks).every((v) => v === "passed")
      ? "passed"
      : "partial";
  }
} catch (error) {
  report.status = "failed";
  report.notes.push(
    error.message?.startsWith("Private") ||
      error.message?.includes("checksum") ||
      error.message?.includes("Expired")
      ? error.message
      : "Cloudinary upload/download verification failed. Check quota, account configuration and connectivity.",
  );
  process.exitCode = 1;
} finally {
  for (const file of assets)
    try {
      await cloudStorage.destroy(file);
    } catch {
      report.notes.push(
        "Probe cleanup needs retry; inspect nckh-probes assets older than 24h.",
      );
    }
  writeFileSync(
    "app/docs/CLOUDINARY_RESULTS.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  await db.$disconnect();
}
