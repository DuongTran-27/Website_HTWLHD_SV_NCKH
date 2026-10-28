import { writeFileSync, mkdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  normalize,
  fitTfidf,
  vectorize,
  cosine,
  algorithmVersion,
} from "../server/src/similarity.js";
import { hash } from "../server/src/core.js";
const db = new PrismaClient();
const subjects = [
  ["phân loại bệnh trên lá cây", "ảnh lá và mạng tích chập"],
  ["dự báo mực nước sông", "dữ liệu thủy văn theo thời gian"],
  ["quản lý ký túc xá", "hồ sơ cư trú và phòng ở"],
  ["nhận diện biển số xe", "ảnh xe và nhận dạng ký tự"],
  ["đặt lịch khám bệnh", "lịch bác sĩ và hồ sơ bệnh nhân"],
  ["theo dõi chất lượng nước", "cảm biến pH và độ đục"],
  ["tư vấn chọn học phần", "chương trình học và sở thích sinh viên"],
  ["tối ưu tuyến thu gom rác", "đồ thị đường phố và thùng rác"],
  ["phân tích cảm xúc bình luận", "văn bản tiếng Việt và nhãn cảm xúc"],
  ["giám sát năng lượng mặt trời", "điện áp tấm pin và thời tiết"],
  ["đăng ký câu lạc bộ sinh viên", "thành viên và sự kiện ngoại khóa"],
  ["quản lý mượn thiết bị", "phiếu mượn và tồn kho"],
  ["phát hiện gian lận giao dịch", "dữ liệu giao dịch và luật bất thường"],
  ["nhận dạng tiếng nói vùng miền", "tín hiệu âm thanh và phiên âm"],
  ["đo chất lượng giấc ngủ", "thiết bị đeo và nhịp tim"],
  ["bảo tồn di sản văn hóa", "hiện vật và tư liệu lịch sử"],
  ["đánh giá ô nhiễm tiếng ồn", "cường độ âm và vị trí đo"],
  ["tìm kiếm tài liệu pháp luật", "văn bản luật và chỉ mục từ khóa"],
  ["quản lý hoạt động tình nguyện", "chiến dịch và đăng ký tham gia"],
  ["dự đoán nhu cầu xe buýt", "lưu lượng hành khách và giờ cao điểm"],
];
const source = (subject, id) => ({
  id: `source-${id}`,
  title: `Xây dựng hệ thống ${subject[0]} tại địa phương`,
  text: `Bài toán ${subject[0]} được nghiên cứu bằng ${subject[1]}. Thu thập ${subject[1]} để thiết kế giải pháp ${subject[0]}. Mục tiêu đánh giá độ chính xác và tính khả thi thông qua thử nghiệm có kiểm soát với ${subject[1]}.`,
});
const sources = subjects.map(source),
  pairs = [];
for (let i = 0; i < 20; i++) {
  const split = i < 13 ? "calibration" : "test",
    s = sources[i],
    pool = split === "calibration" ? sources.slice(0, 13) : sources.slice(13),
    other = pool[(pool.findIndex((p) => p.id === s.id) + 1) % pool.length];
  pairs.push({
    sourceId: s.id,
    split,
    label: "duplicate",
    positive: true,
    left: s,
    right: { title: `  ${s.title.toUpperCase()}!  `, text: s.text },
  });
  pairs.push({
    sourceId: s.id,
    split,
    label: "near",
    positive: true,
    left: s,
    right: {
      title: `Nghiên cứu giải pháp ${subjects[i][0]} ứng dụng trong thực tiễn`,
      text: `Đề xuất giải pháp ${subjects[i][0]} dựa trên ${subjects[i][1]}. Phân tích và thu thập ${subjects[i][1]}, xây dựng nguyên mẫu và đánh giá độ chính xác trên dữ liệu kiểm thử. Mục tiêu hỗ trợ ${subjects[i][0]} thông qua thử nghiệm thực tế.`,
    },
  });
  pairs.push({
    sourceId: s.id,
    split,
    label: "different",
    positive: false,
    left: s,
    right: { title: other.title, text: other.text },
  });
}
const datasetHash = hash(pairs);
mkdirSync("app/tests/fixtures", { recursive: true });
writeFileSync(
  "app/tests/fixtures/similarity-pairs.json",
  JSON.stringify(
    {
      provenance:
        "Synthetic engineering fixtures, labels assigned by construction; not independently annotated academic data.",
      pairs,
    },
    null,
    2,
  ),
);
async function score(split) {
  const pool = pairs.filter((p) => p.split === split),
    documents = [
      ...new Map(pool.map((p) => [p.sourceId, p.left.text])).values(),
    ],
    model = fitTfidf(documents),
    out = [];
  for (const p of pool) {
    const result =
      await db.$queryRaw`SELECT similarity(${normalize(p.left.title)},${normalize(p.right.title)}) AS score`;
    out.push({
      ...p,
      titleScore: Number(result[0].score),
      contentScore: cosine(
        vectorize(p.left.text, model),
        vectorize(p.right.text, model),
      ),
      exact: normalize(p.left.title) === normalize(p.right.title),
    });
  }
  return out;
}
function metrics(rows, titleThreshold, contentThreshold) {
  let tp = 0,
    tn = 0,
    fp = 0,
    fn = 0;
  const errors = [];
  for (const r of rows) {
    const predicted =
      r.exact ||
      r.titleScore >= titleThreshold ||
      r.contentScore >= contentThreshold;
    if (predicted && r.positive) tp++;
    else if (predicted) {
      fp++;
      errors.push({ sourceId: r.sourceId, label: r.label, predicted });
    } else if (r.positive) {
      fn++;
      errors.push({ sourceId: r.sourceId, label: r.label, predicted });
    } else tn++;
  }
  return {
    tp,
    tn,
    fp,
    fn,
    precision: tp / (tp + fp) || 0,
    recall: tp / (tp + fn) || 0,
    falsePositiveRate: fp / (fp + tn) || 0,
    errors,
  };
}
try {
  const start = performance.now(),
    calibration = await score("calibration");
  let best;
  // Fit using calibration only; maximize precision among recall>=.90, then conservative thresholds.
  for (let t = 10; t <= 95; t += 5)
    for (let c = 10; c <= 95; c += 5) {
      const titleThreshold = t / 100,
        contentThreshold = c / 100,
        m = metrics(calibration, titleThreshold, contentThreshold),
        rank = [
          m.recall >= 0.9 ? 1 : 0,
          m.recall >= 0.9 ? m.precision : m.recall,
          m.recall,
          titleThreshold + contentThreshold,
        ];
      if (
        !best ||
        rank.some(
          (v, i) =>
            v !== best.rank[i] &&
            rank.slice(0, i).every((x, j) => x === best.rank[j]) &&
            v > best.rank[i],
        )
      )
        best = { rank, titleThreshold, contentThreshold, metrics: m };
    }
  const config = {
    algorithmVersion,
    titleThreshold: best.titleThreshold,
    contentThreshold: best.contentThreshold,
    calibrationHash: hash({
      datasetHash,
      split: "source-0..12",
      thresholds: [best.titleThreshold, best.contentThreshold],
    }),
    datasetHash,
    calibratedAt: new Date().toISOString(),
    sourceSplit:
      "13 source groups calibration (39 pairs), 7 disjoint source groups test (21 pairs)",
  };
  writeFileSync(
    "app/server/similarity-thresholds.json",
    JSON.stringify(config, null, 2),
  );
  // Test set is read only AFTER thresholds are locked to disk.
  const test = await score("test"),
    testMetrics = metrics(test, config.titleThreshold, config.contentThreshold),
    report = {
      ...config,
      calibration: best.metrics,
      test: testMetrics,
      pairs: 60,
      labels: { duplicate: 20, near: 20, different: 20 },
      elapsedMs: performance.now() - start,
      limitation:
        "Synthetic labels assigned by construction; these metrics only establish engineering behavior. Academic quality needs independently labeled real proposals.",
    };
  writeFileSync(
    "app/docs/SIMILARITY_RESULTS.json",
    JSON.stringify(report, null, 2),
  );
  writeFileSync(
    "app/docs/SIMILARITY_REPORT.md",
    `# Đánh giá thuật toán tương tự\n\n${config.calibratedAt}\n\n60 cặp tổng hợp có nhãn theo cách sinh: 20 trùng, 20 gần, 20 khác. Chia theo đề tài nguồn: 39 cặp hiệu chỉnh / 21 cặp kiểm thử, không giao nguồn hoặc biến thể. Ngưỡng được ghi trước khi đọc tập test.\n\nTên: pg_trgm sau NFC/giữ dấu. Nội dung: TF-IDF unigram/bigram, cosine; fit riêng trên corpus tham chiếu của mỗi phần.\n\nNgưỡng tên ${config.titleThreshold}, nội dung ${config.contentThreshold}.\n\n| Tập | Precision | Recall | TP | TN | FP | FN |\n|---|---|---|---|---|---|---|\n| Hiệu chỉnh | ${best.metrics.precision} | ${best.metrics.recall} | ${best.metrics.tp} | ${best.metrics.tn} | ${best.metrics.fp} | ${best.metrics.fn} |\n| Kiểm thử | ${testMetrics.precision} | ${testMetrics.recall} | ${testMetrics.tp} | ${testMetrics.tn} | ${testMetrics.fp} | ${testMetrics.fn} |\n\nGiới hạn: dữ liệu do chương trình sinh, nhãn chưa được người chuyên môn gán độc lập; kết quả không chứng minh độ chính xác học thuật. Cảnh báo hỗ trợ xét duyệt, không kết luận đạo văn. Chi tiết và ví dụ lỗi (nếu có): SIMILARITY_RESULTS.json.\n`,
  );
  console.log(
    JSON.stringify({
      thresholds: [config.titleThreshold, config.contentThreshold],
      calibration: best.metrics,
      test: testMetrics,
    }),
  );
} finally {
  await db.$disconnect();
  const { db: shared } = await import("../server/src/core.js");
  await shared.$disconnect();
}
