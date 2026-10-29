import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  normalize,
  terms,
  fitTfidf,
  vectorize,
  cosine,
} from "../server/src/similarity.js";
import { csvCell } from "../server/src/reporting.js";
import { validateFile } from "../server/src/files.js";
import { PDFDocument } from "pdf-lib";
import { zipSync, strToU8 } from "fflate";
describe("Thuật toán, file và định dạng", () => {
  it("TC33: NFC, chữ thường, dấu câu, giữ dấu tiếng Việt", () => {
    expect(normalize("  ĐỀ TÀI: Nghiên cứu! ")).toBe("đề tài nghiên cứu");
    expect(normalize("nghiên")).toBe(normalize("nghiên"));
    expect(normalize("đề tài")).not.toBe(normalize("de tai"));
  });
  it("TC33: unigram/bigram và loại stopwords có phiên bản", () => {
    expect(terms("dữ liệu và học máy")).toEqual([
      "dữ",
      "liệu",
      "học",
      "máy",
      "dữ liệu",
      "liệu học",
      "học máy",
    ]);
  });
  it("TC33: cosine đúng biên, zero vector và nội dung giống nhau", () => {
    const model = fitTfidf(["học máy dữ liệu", "cảm biến nhiệt độ"]),
      a = vectorize("học máy dữ liệu", model),
      b = vectorize("cảm biến nhiệt độ", model);
    expect(cosine(a, a)).toBeCloseTo(1);
    expect(cosine(a, b)).toBe(0);
    expect(cosine(new Map(), a)).toBe(0);
  });
  it("TC33: 60 cặp, nhãn cân bằng và không giao nguồn giữa hiệu chỉnh/test", () => {
    const { pairs } = JSON.parse(
      readFileSync("app/tests/fixtures/similarity-pairs.json"),
    );
    expect(pairs).toHaveLength(60);
    for (const label of ["duplicate", "near", "different"])
      expect(pairs.filter((p) => p.label === label)).toHaveLength(20);
    const left = new Set(
      pairs.filter((p) => p.split === "calibration").map((p) => p.sourceId),
    );
    expect(
      pairs
        .filter((p) => p.split === "test")
        .every((p) => !left.has(p.sourceId)),
    ).toBe(true);
  });
  it("TC30: CSV vô hiệu hóa công thức và giữ nguyên văn bản thông thường", () => {
    for (const value of ['=HYPERLINK("x")', " +SUM(1,2)", "-1", "@cmd", "\t=1"])
      expect(csvCell(value).startsWith("'")).toBe(true);
    expect(csvCell("Nghiên cứu 2026")).toBe("Nghiên cứu 2026");
  });
  it("TC14: không tin đuôi và MIME, file PDF lỗi bị chặn", async () => {
    await expect(
      validateFile(Buffer.from("hello"), "bao-cao.pdf", "report"),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      validateFile(Buffer.from("%PDF-1.7\n%%EOF"), "bao-cao.pdf", "report"),
    ).rejects.toMatchObject({ status: 415 });
  });
  it("TC14: nhận PDF thật, từ chối đổi đuôi sang Office", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const buffer = Buffer.from(await pdf.save());
    expect(await validateFile(buffer, "report.pdf", "report")).toMatchObject({
      resourceType: "raw",
      mimeType: "application/pdf",
    });
    await expect(
      validateFile(buffer, "report.docx", "report"),
    ).rejects.toMatchObject({ status: 415 });
  });
  it("TC14: xác minh cấu trúc OOXML, chặn ZIP đổi đuôi và macro", async () => {
    const files = {
      "[Content_Types].xml": strToU8(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
      "word/document.xml": strToU8(
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>',
      ),
      "_rels/.rels": strToU8(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      ),
    };
    const buffer = Buffer.from(zipSync(files));
    expect(await validateFile(buffer, "report.docx", "report")).toMatchObject({
      extension: "docx",
    });
    await expect(
      validateFile(
        Buffer.from(zipSync({ "hello.txt": strToU8("hello") })),
        "report.xlsx",
        "report",
      ),
    ).rejects.toMatchObject({ status: 415 });
    files["word/vbaProject.bin"] = strToU8("macro");
    await expect(
      validateFile(Buffer.from(zipSync(files)), "report.docx", "report"),
    ).rejects.toMatchObject({ status: 415 });
    delete files["word/vbaProject.bin"];
    files["word/document.xml"] = strToU8(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><broken></w:document>',
    );
    await expect(
      validateFile(Buffer.from(zipSync(files)), "report.docx", "report"),
    ).rejects.toMatchObject({ status: 415 });
    files["word/document.xml"] = strToU8(
      '<!DOCTYPE document [<!ENTITY external SYSTEM "file:///private">]><document>&external;</document>',
    );
    await expect(
      validateFile(Buffer.from(zipSync(files)), "report.docx", "report"),
    ).rejects.toMatchObject({ status: 415 });
  });
  it("TC14: dung lượng MB thập phân", async () => {
    await expect(
      validateFile(Buffer.alloc(4000001), "report.pdf", "report"),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      validateFile(Buffer.alloc(4000001), "photo.png", "private_image"),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      validateFile(Buffer.alloc(4000000), "report.pdf", "report"),
    ).rejects.toMatchObject({ status: 415 });
  });
});
