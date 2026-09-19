import { defineApp } from "convex/server";
import { v } from "convex/values";
import workpool from "@convex-dev/workpool/convex.config";
import staticHosting from "@convex-dev/static-hosting/convex.config";

const app = defineApp({
  env: {
    API_KEY_ENCRYPTION_KEY: v.optional(v.string()),
  },
});
app.use(workpool, { name: "aiWorkpool" });
// Keep Convex Auth at /api/auth; static files catch everything else.
app.use(staticHosting);
export default app;
