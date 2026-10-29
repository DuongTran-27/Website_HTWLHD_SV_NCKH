// Vercel Function entry: every /api/* request is rewritten here and handled by the Express app.
import { createApp } from "../app/server/src/app.js";

export default createApp();
