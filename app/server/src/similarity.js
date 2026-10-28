import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ensure, hash, publicStates, pickAcademic, AppError } from "./core.js";

export const algorithmVersion = "tfidf-uni-bi-cosine-v1";
export const normalize = (text) =>
  String(text ?? "")
    .normalize("NFC")
    .toLocaleLowerCase("vi")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
const stopwords = new Set([
  "và",
  "của",
  "là",
  "cho",
  "các",
  "những",
  "một",
  "được",
  "trong",
  "với",
  "từ",
  "để",
  "có",
  "về",
]);
export function terms(text) {
  const words = normalize(text)
    .split(" ")
    .filter((w) => w && !stopwords.has(w));
  return [...words, ...words.slice(1).map((word, i) => `${words[i]} ${word}`)];
}
export const contentText = (t) =>
  [t.abstract, t.objectives, t.researchContent].join(" ");
export function fitTfidf(documents) {
  const df = new Map();
  for (const document of documents)
    for (const term of new Set(terms(document)))
      df.set(term, (df.get(term) ?? 0) + 1);
  return {
    documentCount: documents.length,
    idf: new Map(
      [...df].map(([term, count]) => [
        term,
        Math.log((1 + documents.length) / (1 + count)) + 1,
      ]),
    ),
  };
}
export function vectorize(text, model) {
  const tf = new Map();
  for (const term of terms(text))
    if (model.idf.has(term)) tf.set(term, (tf.get(term) ?? 0) + 1);
  const v = new Map(
    [...tf].map(([term, count]) => [
      term,
      (1 + Math.log(count)) * model.idf.get(term),
    ]),
  );
  const length = Math.sqrt([...v.values()].reduce((a, b) => a + b * b, 0));
  return length ? new Map([...v].map(([t, w]) => [t, w / length])) : v;
}
export function cosine(a, b) {
  let sum = 0;
  for (const [term, weight] of a) sum += weight * (b.get(term) ?? 0);
  return Math.max(0, Math.min(1, sum));
}
export function calibratedConfig() {
  try {
    const config = JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL("../similarity-thresholds.json", import.meta.url),
        ),
        "utf8",
      ),
    );
    ensure(
      config.calibrationHash &&
        config.titleThreshold > 0 &&
        config.contentThreshold > 0,
      503,
      "SIMILARITY_UNAVAILABLE",
      "Chưa hiệu chỉnh thuật toán tương tự.",
    );
    return config;
  } catch (error) {
    ensure(
      false,
      503,
      "SIMILARITY_UNAVAILABLE",
      error.code === "SIMILARITY_UNAVAILABLE"
        ? error.message
        : "Chưa có cấu hình thuật toán đã hiệu chỉnh.",
    );
  }
}
export async function activeCorpus(tx) {
  let corpus = await tx.similarityCorpus.findFirst({
    where: { isActive: true },
  });
  if (!corpus) {
    const refs = await tx.topic.findMany({
      where: { status: { in: publicStates } },
      select: { id: true, currentRevisionId: true },
      orderBy: { id: "asc" },
    });
    corpus = await tx.similarityCorpus.create({
      data: {
        version: 1,
        algorithmVersion,
        normalizerVersion: "nfc-vi-v1",
        stopwordsVersion: "vi-mini-v1",
        config: { ...calibratedConfig(), documentRefs: refs },
        corpusSize: refs.length,
      },
    });
  }
  return corpus;
}
export async function publishCorpus(tx) {
  const current = await activeCorpus(tx);
  await tx.similarityCorpus.update({
    where: { id: current.id },
    data: { isActive: false },
  });
  const refs = await tx.topic.findMany({
    where: { status: { in: publicStates } },
    select: { id: true, currentRevisionId: true },
    orderBy: { id: "asc" },
  });
  return tx.similarityCorpus.create({
    data: {
      version: current.version + 1,
      algorithmVersion,
      normalizerVersion: "nfc-vi-v1",
      stopwordsVersion: "vi-mini-v1",
      config: { ...calibratedConfig(), documentRefs: refs },
      corpusSize: refs.length,
    },
  });
}
export async function checkSimilarity(tx, user, topic, purpose = "preview") {
  try {
    return await performSimilarity(tx, user, topic, purpose);
  } catch (error) {
    if (error.status) throw error;
    const wrapped = new AppError(
      503,
      "SIMILARITY_UNAVAILABLE",
      "Chưa kiểm tra được dữ liệu đối chiếu. Hồ sơ được giữ nguyên; vui lòng thử lại.",
    );
    wrapped.similarityFailure = {
      topicId: topic.id,
      requestedBy: user.id,
      purpose,
      inputSnapshot: pickAcademic(topic),
      inputHash: hash(pickAcademic(topic)),
    };
    throw wrapped;
  }
}
async function performSimilarity(tx, user, topic, purpose = "preview") {
  const corpus = await activeCorpus(tx),
    config = corpus.config;
  // Failure is propagated. An empty SELECT is the only condition producing corpusSize=0.
  const candidates = await tx.topic.findMany({
    where: { id: { not: topic.id }, status: { in: publicStates } },
    orderBy: { code: "asc" },
  });
  const titleScores =
    await tx.$queryRaw`SELECT id, similarity(normalized_title, ${normalize(topic.title)}) AS score FROM topics WHERE status IN ('approved','in_progress','pending_evaluation','completed') AND id <> ${topic.id}::uuid`;
  const titleMap = new Map(titleScores.map((s) => [s.id, Number(s.score)]));
  const model = fitTfidf(candidates.map(contentText)),
    query = vectorize(contentText(topic), model);
  const scored = candidates.map((c) => ({
    topicId: c.id,
    topicRevisionId: c.currentRevisionId,
    code: c.code,
    title: c.title,
    facultyId: c.facultyId,
    fieldId: c.fieldId,
    periodId: c.periodId,
    status: c.status,
    exactTitleMatch: normalize(c.title) === normalize(topic.title),
    titleScore: titleMap.get(c.id) ?? 0,
    contentScore: cosine(query, vectorize(contentText(c), model)),
  }));
  scored.sort(
    (a, b) =>
      Math.max(b.titleScore, b.contentScore) -
        Math.max(a.titleScore, a.contentScore) || a.code.localeCompare(b.code),
  );
  const matches = scored.slice(0, 5),
    hasWarning = scored.some(
      (m) =>
        m.exactTitleMatch ||
        m.titleScore >= config.titleThreshold ||
        m.contentScore >= config.contentThreshold,
    );
  const snapshot = pickAcademic(topic);
  const check = await tx.similarityCheck.create({
    data: {
      topicId: topic.id,
      requestedBy: user.id,
      purpose,
      corpusId: corpus.id,
      inputSnapshot: snapshot,
      inputHash: hash(snapshot),
      status: "succeeded",
      exactTitleMatch: scored.some((m) => m.exactTitleMatch),
      titleThreshold: config.titleThreshold,
      contentThreshold: config.contentThreshold,
      hasWarning,
      completedAt: new Date(),
    },
  });
  for (const [index, m] of matches.entries()) {
    ensure(
      m.topicRevisionId,
      503,
      "CORPUS_INVALID",
      "Kho đối chiếu có hồ sơ chưa được xuất bản hợp lệ.",
    );
    await tx.similarityMatch.create({
      data: {
        checkId: check.id,
        candidateTopicId: m.topicId,
        candidateRevisionId: m.topicRevisionId,
        rank: index + 1,
        titleScore: m.titleScore,
        contentScore: m.contentScore,
        candidateMetadata: {
          title: m.title,
          code: m.code,
          facultyId: m.facultyId,
          fieldId: m.fieldId,
          periodId: m.periodId,
          status: m.status,
        },
      },
    });
  }
  return {
    ...check,
    inputSnapshot: undefined,
    inputHash: undefined,
    corpusVersion: corpus.version,
    corpusSize: candidates.length,
    algorithmVersion,
    configVersion: config.calibrationHash,
    matches,
  };
}
export async function similarityHistory(tx, topicId) {
  const checks = await tx.similarityCheck.findMany({
    where: { topicId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return Promise.all(
    checks.map(async (c) => ({
      ...c,
      inputSnapshot: undefined,
      inputHash: undefined,
      matches: (
        await tx.similarityMatch.findMany({
          where: { checkId: c.id },
          orderBy: { rank: "asc" },
        })
      ).map((m) => ({
        topicId: m.candidateTopicId,
        ...m.candidateMetadata,
        titleScore: m.titleScore,
        contentScore: m.contentScore,
      })),
    })),
  );
}
