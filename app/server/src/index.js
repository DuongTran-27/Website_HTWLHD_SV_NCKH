import { createApp } from "./app.js";
import { db } from "./core.js";
const port = Number(process.env.PORT ?? 4000);
const server = createApp().listen(port, () =>
  console.log(`NCKH API: http://localhost:${port}/api/v1/health`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(async () => {
      await db.$disconnect();
      process.exit(0);
    }),
  );
