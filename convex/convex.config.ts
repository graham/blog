import { defineApp } from "convex/server";
import { v } from "convex/values";
import workpool from "@convex-dev/workpool/convex.config";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import auth from "@convex-dev/auth/core/convex.config.js";
import passwordProvider from "@convex-dev/auth/providers/password/convex.config.js";
import username from "@convex-dev/auth/username/convex.config.js";
import passkey from "@convex-dev/auth/providers/passkey/convex.config.js";
import anonymous from "@convex-dev/auth/providers/anonymous/convex.config.js";
import oauth from "@convex-dev/auth/providers/oauth/convex.config.js";

const app = defineApp({
  env: {
    API_KEY_ENCRYPTION_KEY: v.optional(v.string()),
    AUTH_PRIVATE_KEY: v.string(),
    AUTH_JWKS: v.string(),
    AUTH_GOOGLE_CLIENT_ID: v.string(),
    AUTH_GOOGLE_CLIENT_SECRET: v.string(),
    AUTH_PASSKEY_RP_ID: v.optional(v.string()),
    AUTH_PASSKEY_ORIGIN: v.optional(v.string()),
  },
});
app.use(workpool, { name: "aiWorkpool" });
app.use(auth, {
  httpPrefix: "/auth",
  env: {
    AUTH_PRIVATE_KEY: app.env.AUTH_PRIVATE_KEY,
    AUTH_JWKS: app.env.AUTH_JWKS,
  },
});
app.use(passwordProvider);
app.use(username);
app.use(passkey);
app.use(anonymous);
app.use(oauth, {
  name: "oauthGoogle",
  httpPrefix: "/oauth/google",
  env: {
    CLIENT_ID: app.env.AUTH_GOOGLE_CLIENT_ID,
    CLIENT_SECRET: app.env.AUTH_GOOGLE_CLIENT_SECRET,
  },
});
app.use(staticHosting);
export default app;
