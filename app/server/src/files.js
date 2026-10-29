import { Router } from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { v2 as cloudinary } from "cloudinary";
import { fileTypeFromBuffer } from "file-type";
import { unzipSync } from "fflate";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { extname, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  db,
  ensure,
  fail,
  found,
  uid,
  hash,
  transaction,
  ok,
  audit,
  checkState,
  editableStates,
  loadUser,
  safeUser,
  rateLimitHandler,
} from "./core.js";
import { read } from "./routes.js";
import { topicAccess, access, currentStudent } from "./permissions.js";
export const filesRouter = Router();
export const FILE_MAX = 10000000,
  IMAGE_MAX = 5000000;
const officeKinds = {
  docx: {
    root: "word/document.xml",
    rootTag: "document",
    namespace: "wordprocessingml",
    mainType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  xlsx: {
    root: "xl/workbook.xml",
    rootTag: "workbook",
    namespace: "spreadsheetml",
    mainType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  pptx: {
    root: "ppt/presentation.xml",
    rootTag: "presentation",
    namespace: "presentationml",
    mainType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
};
function checkZip(buffer, extension) {
  // Bound expansion using the central directory before inflating XML content.
  let eocd = -1;
  for (let p = buffer.length - 22; p >= Math.max(0, buffer.length - 65557); p--)
    if (buffer.readUInt32LE(p) === 0x06054b50) {
      eocd = p;
      break;
    }
  ensure(eocd >= 0, 415, "INVALID_FILE", "Cấu trúc Office không hợp lệ.");
  const count = buffer.readUInt16LE(eocd + 10);
  ensure(
    count > 0 && count <= 2000,
    415,
    "INVALID_FILE",
    "Số phần trong tệp Office vượt giới hạn.",
  );
  let offset = buffer.readUInt32LE(eocd + 16),
    total = 0;
  for (let i = 0; i < count; i++) {
    ensure(
      offset + 46 <= buffer.length &&
        buffer.readUInt32LE(offset) === 0x02014b50,
      415,
      "INVALID_FILE",
      "Cấu trúc ZIP không hợp lệ.",
    );
    const flags = buffer.readUInt16LE(offset + 8),
      packed = buffer.readUInt32LE(offset + 20),
      unpacked = buffer.readUInt32LE(offset + 24),
      nameLength = buffer.readUInt16LE(offset + 28),
      extra = buffer.readUInt16LE(offset + 30),
      comment = buffer.readUInt16LE(offset + 32);
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");
    total += unpacked;
    ensure(
      !(flags & 1) &&
        total <= 100000000 &&
        unpacked <= 30000000 &&
        (!unpacked || unpacked / Math.max(1, packed) <= 200) &&
        !name.includes("..") &&
        !name.startsWith("/") &&
        !/vbaProject|embeddings\//i.test(name),
      415,
      "INVALID_FILE",
      "Tệp Office mã hóa, nhúng hoặc giải nén quá lớn không được hỗ trợ.",
    );
    offset += 46 + nameLength + extra + comment;
  }
  const files = unzipSync(buffer, {
    filter: (file) =>
      file.name === "[Content_Types].xml" ||
      file.name === officeKinds[extension].root ||
      file.name === "_rels/.rels",
  });
  ensure(
    files["[Content_Types].xml"] &&
      files[officeKinds[extension].root] &&
      files["_rels/.rels"],
    415,
    "INVALID_FILE",
    "Tệp không có cấu trúc Office đúng định dạng.",
  );
  function xml(bytes) {
    const encoding =
      (bytes[0] === 255 && bytes[1] === 254) ||
      (bytes[0] === 60 && bytes[1] === 0)
        ? "utf-16le"
        : (bytes[0] === 254 && bytes[1] === 255) ||
            (bytes[0] === 0 && bytes[1] === 60)
          ? "utf-16be"
          : "utf-8";
    const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
    ensure(
      !/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(text) &&
        XMLValidator.validate(text) === true,
      415,
      "INVALID_FILE",
      "XML trong tệp Office bị lỗi hoặc có khai báo thực thể không được phép.",
    );
    return text;
  }
  ensure(
    files["[Content_Types].xml"].length <= 1000000 &&
      files["_rels/.rels"].length <= 1000000,
    415,
    "INVALID_FILE",
    "Cấu hình nội bộ Office vượt giới hạn xử lý.",
  );
  const types = xml(files["[Content_Types].xml"]),
    relationships = xml(files["_rels/.rels"]),
    main = xml(files[officeKinds[extension].root]),
    kind = officeKinds[extension];
  const root = main
    .replace(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>/g, "")
    .match(/<(?:(?:[\w.-]+):)?([\w.-]+)\b([^>]*)>/);
  ensure(
    root?.[1] === kind.rootTag &&
      [
        "http://schemas.openxmlformats.org/" + kind.namespace + "/2006/main",
        "http://purl.oclc.org/ooxml/" + kind.namespace + "/main",
      ].some((namespace) => root[2].includes(namespace)),
    415,
    "INVALID_FILE",
    "Nội dung chính không khớp định dạng Office.",
  );
  const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@",
      removeNSPrefix: true,
      processEntities: false,
    }),
    typeEntries = parser.parse(types).Types?.Override,
    relationEntries = parser.parse(relationships).Relationships?.Relationship;
  const array = (value) =>
    value ? (Array.isArray(value) ? value : [value]) : [];
  ensure(
    array(typeEntries).some(
      (part) =>
        part["@PartName"] === "/" + kind.root &&
        part["@ContentType"] === kind.mainType,
    ) &&
      !types.includes("macroEnabled") &&
      array(relationEntries).some(
        (relation) =>
          relation["@Type"]?.endsWith("/officeDocument") &&
          relation["@TargetMode"] !== "External" &&
          relation["@Target"]?.replace(/^\/?(?:\.\/)?/, "") === kind.root,
      ),
    415,
    "INVALID_FILE",
    "Quan hệ và kiểu nội dung Office không nhất quán.",
  );
}
export async function validateFile(buffer, originalName, purpose) {
  ensure(
    buffer.length > 0 &&
      buffer.length <= (purpose === "private_image" ? IMAGE_MAX : FILE_MAX),
    413,
    "FILE_TOO_LARGE",
    purpose === "private_image" ? "Ảnh tối đa 5 MB." : "Tài liệu tối đa 10 MB.",
  );
  const extension = extname(originalName).slice(1).toLowerCase();
  let detected;
  try {
    detected = await fileTypeFromBuffer(buffer);
  } catch {
    fail(415, "INVALID_FILE", "Không đọc được định dạng file.");
  }
  if (purpose === "private_image") {
    ensure(
      detected &&
        ["jpg", "png", "webp"].includes(detected.ext) &&
        (["jpg", "jpeg"].includes(extension)
          ? detected.ext === "jpg"
          : detected.ext === extension),
      415,
      "UNSUPPORTED_FILE_TYPE",
      "Ảnh cần đúng định dạng JPEG, PNG hoặc WebP.",
    );
    try {
      await sharp(buffer, { limitInputPixels: 25000000 }).raw().toBuffer();
    } catch {
      fail(415, "INVALID_FILE", "Ảnh lỗi hoặc có kích thước giải mã quá lớn.");
    }
    return {
      extension: detected.ext,
      mimeType: detected.mime,
      resourceType: "image",
    };
  }
  ensure(
    ["pdf", "docx", "xlsx", "pptx"].includes(extension),
    415,
    "UNSUPPORTED_FILE_TYPE",
    "Chỉ nhận PDF, DOCX, XLSX, PPTX.",
  );
  if (extension === "pdf") {
    ensure(
      detected?.ext === "pdf" &&
        buffer.subarray(-2048).toString("latin1").includes("%%EOF"),
      415,
      "INVALID_FILE",
      "Cấu trúc PDF không hợp lệ.",
    );
    try {
      const document = await PDFDocument.load(buffer, {
        updateMetadata: false,
      });
      ensure(
        document.getPageCount() > 0,
        415,
        "INVALID_FILE",
        "PDF phải có trang.",
      );
    } catch {
      fail(415, "INVALID_FILE", "PDF bị lỗi hoặc mã hóa.");
    }
    return { extension, mimeType: "application/pdf", resourceType: "raw" };
  }
  ensure(
    detected && ["zip", "docx", "xlsx", "pptx"].includes(detected.ext),
    415,
    "INVALID_FILE",
    "Nội dung không khớp định dạng Office.",
  );
  try {
    checkZip(buffer, extension);
  } catch (error) {
    if (error.status) throw error;
    fail(415, "INVALID_FILE", "Cấu trúc Office không hợp lệ.");
  }
  return {
    extension,
    mimeType: officeKinds[extension].mime,
    resourceType: "raw",
  };
}
export function configureCloud() {
  ensure(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
    503,
    "STORAGE_NOT_CONFIGURED",
    "Kho tài liệu chưa được cấu hình. Liên hệ quản trị viên.",
  );
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}
export const cloudStorage = {
  upload(buffer, options) {
    const cloud = configureCloud();
    return new Promise((resolve, reject) => {
      cloud.uploader
        .upload_stream(
          {
            ...options,
            timeout: 120000,
            overwrite: false,
            unique_filename: false,
            type: "authenticated",
            use_filename: false,
          },
          (error, result) => (error ? reject(error) : resolve(result)),
        )
        .end(buffer);
    });
  },
  async destroy(attachment) {
    return configureCloud().uploader.destroy(attachment.publicId, {
      resource_type: attachment.resourceType,
      type: attachment.deliveryType,
      invalidate: true,
    });
  },
  uploadPublicImage(buffer, publicId) {
    const cloud = configureCloud();
    return new Promise((resolve, reject) => {
      cloud.uploader
        .upload_stream(
          {
            public_id: publicId,
            resource_type: "image",
            type: "upload",
            overwrite: false,
            timeout: 120000,
          },
          (error, result) => (error ? reject(error) : resolve(result)),
        )
        .end(buffer);
    });
  },
  download(attachment, seconds = 300) {
    const cloud = configureCloud();
    return cloud.utils.private_download_url(
      attachment.publicId,
      attachment.resourceType === "raw"
        ? ""
        : extname(attachment.originalName).slice(1).replace("jpeg", "jpg"),
      {
        resource_type: attachment.resourceType,
        type: attachment.deliveryType,
        expires_at: Math.floor(Date.now() / 1000) + seconds,
        attachment: true,
      },
    );
  },
};
filesRouter.post(
  "/profile/avatar",
  rateLimit({
    windowMs: 60000,
    limit: 5,
    keyGenerator: (req) => req.user.id,
    handler: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  (req, res, next) => {
    configureCloud();
    next();
  },
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: IMAGE_MAX, files: 1, fields: 0 },
  }).single("file"),
  async (req, res) => {
    ensure(req.file, 422, "FILE_REQUIRED", "Vui lòng chọn ảnh.");
    await validateFile(req.file.buffer, req.file.originalname, "private_image");
    const buffer = await sharp(req.file.buffer, { limitInputPixels: 25000000 })
        .resize(256, 256, { fit: "cover" })
        .webp({ quality: 85 })
        .toBuffer(),
      publicId = `nckh-avatars/${randomUUID()}`;
    let result;
    try {
      result = await cloudStorage.uploadPublicImage(buffer, publicId);
    } catch {
      fail(503, "UPLOAD_FAILED", "Chưa lưu được ảnh hồ sơ. Vui lòng thử lại.");
    }
    ensure(
      result?.public_id === publicId &&
        result.asset_id &&
        result.secure_url?.startsWith("https://res.cloudinary.com/"),
      503,
      "UPLOAD_VERIFICATION_FAILED",
      "Không xác minh được ảnh đã lưu.",
    );
    const user = await transaction(async (tx) => {
      const current = await loadUser(req.user.id, tx);
      ensure(
        current.status === "active" &&
          current.authVersion === req.user.authVersion,
        401,
        "SESSION_REVOKED",
        "Phiên đã bị thu hồi.",
      );
      const row = await tx.user.update({
        where: { id: current.id },
        data: {
          avatarAssetId: result.asset_id,
          avatarPublicId: publicId,
          avatarUrl: result.secure_url,
          revision: { increment: 1 },
        },
      });
      await audit(tx, current, "user.avatar_updated", "user", row, req);
      return row;
    });
    ok(res, req, safeUser(user));
  },
);
export async function attachmentAccess(tx, user, id) {
  const file = await found("attachment", uid.parse(id), tx),
    topic = await found("topic", file.topicId, tx);
  const [proposalLinks, reportLink] = await Promise.all([
    tx.topicRevisionFile.findMany({ where: { attachmentId: file.id } }),
    tx.submissionFile.findUnique({ where: { attachmentId: file.id } }),
  ]);
  if (reportLink) {
    const sub = await found("submission", reportLink.submissionId, tx);
    ensure(
      await access(tx, user, topic, sub.submittedAt),
      404,
      "RESOURCE_NOT_FOUND",
      "Không có quyền xem phiên bản tài liệu.",
    );
  } else if (proposalLinks.length) {
    let allowed = false;
    for (const l of proposalLinks) {
      const r = await found("topicRevision", l.topicRevisionId, tx);
      if (await access(tx, user, topic, r.publishedAt)) allowed = true;
    }
    ensure(
      allowed,
      404,
      "RESOURCE_NOT_FOUND",
      "Không có quyền xem phiên bản tài liệu.",
    );
  } else {
    const mode = await access(tx, user, topic);
    ensure(
      mode &&
        mode !== "historical" &&
        (file.uploadedBy === user.id ||
          mode === "student" ||
          mode === "staff" ||
          (file.purpose === "proposal" &&
            ["lecturer", "proposal_lecturer"].includes(mode))),
      404,
      "RESOURCE_NOT_FOUND",
      "Không tìm thấy tài liệu được phép truy cập.",
    );
  }
  return file;
}
filesRouter.post(
  "/topics/:id/attachments",
  rateLimit({
    windowMs: 60000,
    limit: 10,
    keyGenerator: (req) => req.user.id,
    handler: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  async (req, res, next) => {
    // Authorize before accepting a multipart body into memory.
    const topic = await topicAccess(db, req.user, uid.parse(req.params.id));
    await currentStudent(db, req.user, topic);
    ensure(
      ["draft", "revision_required", "in_progress"].includes(topic.status),
      409,
      "INVALID_TRANSITION",
      "Không được upload ở trạng thái hiện tại.",
    );
    configureCloud();
    next();
  },
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: FILE_MAX, files: 1, fields: 1, fieldSize: 100 },
  }).single("file"),
  async (req, res) => {
    ensure(req.file, 422, "FILE_REQUIRED", "Vui lòng chọn tài liệu.");
    const purpose = z
      .enum(["proposal", "report", "private_image"])
      .parse(req.body.purpose);
    const valid = await validateFile(
      req.file.buffer,
      req.file.originalname,
      purpose,
    );
    const publicId = `nckh/${randomUUID()}${valid.resourceType === "raw" ? "." + valid.extension : ""}`;
    let attachment = await transaction(async (tx) => {
      const user = await loadUser(req.user.id, tx);
      ensure(
        user.status === "active" && user.authVersion === req.user.authVersion,
        401,
        "SESSION_REVOKED",
        "Phiên đã bị thu hồi.",
      );
      const topic = await topicAccess(tx, user, req.params.id);
      await currentStudent(tx, user, topic);
      checkState(
        topic,
        purpose === "proposal" ? editableStates : ["in_progress"],
      );
      return tx.attachment.create({
        data: {
          topicId: topic.id,
          uploadedBy: req.user.id,
          purpose,
          originalName: basename(req.file.originalname).slice(0, 200),
          mimeType: valid.mimeType,
          sizeBytes: req.file.size,
          publicId,
          resourceType: valid.resourceType,
          sha256: hash(req.file.buffer),
        },
      });
    });
    let uploaded;
    try {
      uploaded = await cloudStorage.upload(req.file.buffer, {
        public_id: publicId,
        resource_type: valid.resourceType,
      });
      ensure(
        uploaded?.asset_id &&
          uploaded.public_id === publicId &&
          uploaded.bytes === req.file.size,
        503,
        "UPLOAD_VERIFICATION_FAILED",
        "Không xác minh được tài liệu đã lưu.",
      );
      attachment = await transaction(async (tx) => {
        const result = await tx.attachment.update({
          where: { id: attachment.id },
          data: {
            status: "ready",
            assetId: uploaded.asset_id,
            verifiedAt: new Date(),
          },
        });
        await audit(
          tx,
          req.user,
          "attachment.uploaded",
          "topic",
          { id: attachment.topicId },
          req,
          {
            afterData: {
              attachmentId: attachment.id,
              sizeBytes: attachment.sizeBytes,
            },
          },
        );
        return result;
      });
    } catch (error) {
      await db.attachment
        .update({
          where: { id: attachment.id },
          data: {
            status: "failed",
            errorCode: "UPLOAD_FAILED",
            ...(uploaded?.asset_id ? { assetId: uploaded.asset_id } : {}),
          },
        })
        .catch(() => {});
      fail(
        503,
        "UPLOAD_FAILED",
        "Không lưu được tài liệu. Bản báo cáo chưa được nộp; vui lòng thử lại.",
      );
    }
    ok(
      res,
      req,
      {
        id: attachment.id,
        topicId: attachment.topicId,
        originalName: attachment.originalName,
        sizeBytes: attachment.sizeBytes,
        mimeType: attachment.mimeType,
        status: attachment.status,
        purpose: attachment.purpose,
      },
      201,
    );
  },
);
read(filesRouter, "/topics/:id/attachments", async (req, tx) => {
  const topic = await topicAccess(tx, req.user, req.params.id),
    files = await tx.attachment.findMany({
      where: { topicId: topic.id },
      orderBy: { createdAt: "desc" },
    }),
    visible = [];
  for (const f of files) {
    try {
      await attachmentAccess(tx, req.user, f.id);
      visible.push({
        id: f.id,
        originalName: f.originalName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        status: f.status,
        purpose: f.purpose,
        createdAt: f.createdAt,
      });
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  }
  return visible;
});
read(filesRouter, "/attachments/:id", async (req, tx) => {
  const f = await attachmentAccess(tx, req.user, req.params.id);
  return {
    id: f.id,
    originalName: f.originalName,
    sizeBytes: f.sizeBytes,
    mimeType: f.mimeType,
    status: f.status,
    purpose: f.purpose,
  };
});
filesRouter.post("/attachments/:id/download-links", async (req, res) => {
  const file = await attachmentAccess(db, req.user, req.params.id);
  ensure(
    file.status === "ready",
    409,
    "FILE_NOT_READY",
    "Tài liệu chưa sẵn sàng.",
  );
  const url = cloudStorage.download(file);
  res.set("Cache-Control", "no-store");
  ok(res, req, { url, expiresAt: new Date(Date.now() + 300000).toISOString() });
});
filesRouter.delete("/attachments/:id", async (req, res) => {
  const pending = await transaction(async (tx) => {
    const file = await attachmentAccess(tx, req.user, req.params.id);
    ensure(
      file.uploadedBy === req.user.id,
      403,
      "ACTION_FORBIDDEN",
      "Chỉ người upload được xóa file chưa nộp.",
    );
    const topic = await found("topic", file.topicId, tx);
    await currentStudent(tx, req.user, topic);
    ensure(
      !(await tx.topicRevisionFile.count({
        where: { attachmentId: file.id },
      })) &&
        !(await tx.submissionFile.count({ where: { attachmentId: file.id } })),
      409,
      "FILE_ALREADY_SUBMITTED",
      "Tài liệu đã nộp được giữ trong lịch sử.",
    );
    return tx.attachment.update({
      where: { id: file.id },
      data: { status: "failed", errorCode: "DELETE_PENDING" },
    });
  });
  let result;
  try {
    result = await cloudStorage.destroy(pending);
  } catch {
    fail(
      503,
      "DELETE_FAILED",
      "Chưa xóa được tài liệu khỏi kho. Hệ thống sẽ thử dọn lại.",
    );
  }
  ensure(
    ["ok", "not found"].includes(result.result),
    503,
    "DELETE_FAILED",
    "Chưa xóa được tài liệu.",
  );
  await transaction(async (tx) => {
    await tx.attachment.delete({ where: { id: pending.id } });
    await audit(
      tx,
      req.user,
      "attachment.deleted",
      "topic",
      { id: pending.topicId },
      req,
      { afterData: { attachmentId: pending.id } },
    );
  });
  res.status(204).end();
});
