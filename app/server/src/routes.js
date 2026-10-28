import {
  db,
  transaction,
  loadUser,
  ensure,
  ok,
  listOk,
  idempotent,
  uid,
} from "./core.js";
export const registry = [];
export function read(router, path, fn, summary = path) {
  registry.push({ method: "get", path, summary });
  router.get(path, async (req, res) => {
    if (req.params.id) uid.parse(req.params.id);
    const result = await fn(req, db);
    if (res.headersSent) return;
    if (result?.meta) listOk(res, req, result);
    else ok(res, req, result);
  });
}
export function write(
  router,
  method,
  path,
  schema,
  fn,
  { status = 200, idempotency = false, summary = path } = {},
) {
  registry.push({ method, path, summary, schema, idempotency, status });
  router[method](path, async (req, res) => {
    if (req.params.id) uid.parse(req.params.id);
    req.body = schema.parse(req.body ?? {});
    let result;
    try {
      result = await transaction(async (tx) => {
        const current = await loadUser(req.user.id, tx);
        ensure(
          current?.status === "active" &&
            current.authVersion === req.user.authVersion,
          401,
          "SESSION_REVOKED",
          "Phiên đã thay đổi. Vui lòng đăng nhập lại.",
        );
        req.user = current;
        if (idempotency)
          return idempotent(
            req,
            tx,
            `${method}:${path}:${req.params.id ?? ""}`,
            () => fn(req, tx),
            status,
          );
        return { data: await fn(req, tx), status };
      });
    } catch (error) {
      if (error.similarityFailure) {
        try {
          await transaction(async (tx) => {
            const corpus = await tx.similarityCorpus.findFirst({
              where: { isActive: true },
            });
            if (corpus)
              await tx.similarityCheck.create({
                data: {
                  ...error.similarityFailure,
                  corpusId: corpus.id,
                  status: "failed",
                  errorCode: "SIMILARITY_UNAVAILABLE",
                  completedAt: new Date(),
                },
              });
          });
        } catch {
          /* dependency outage may prevent recording failure */
        }
      }
      throw error;
    }
    if (result.status === 204) res.status(204).end();
    else ok(res, req, result.data, result.status);
  });
}
