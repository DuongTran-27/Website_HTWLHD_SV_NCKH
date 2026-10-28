import { transaction, db } from "../server/src/core.js";
import { publishCorpus } from "../server/src/similarity.js";
try {
  const result = await transaction((tx) => publishCorpus(tx));
  console.log(
    JSON.stringify({
      version: result.version,
      corpusSize: result.corpusSize,
      configVersion: result.config.calibrationHash,
    }),
  );
} finally {
  await db.$disconnect();
}
