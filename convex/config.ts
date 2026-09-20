import { v } from "convex/values";
import { query } from "./_generated/server";
import { internal } from "./_generated/api";
import { featuresValidator, siteSettingsValidator } from "./lib/validators";
import type { Infer } from "convex/values";

type SiteSettings = Infer<typeof siteSettingsValidator>;

// Anonymous by design: the sign-in page and the site gate both need this
// before anyone is authenticated.
export const getConfig = query({
  args: {},
  returns: v.object({
    googleAuthEnabled: v.boolean(),
    passwordAuthEnabled: v.boolean(),
    requireAuth: v.boolean(),
    bookmarksEnabled: v.boolean(),
    features: featuresValidator,
  }),
  handler: async (ctx) => {
    const settings: SiteSettings = await ctx.runQuery(internal.siteSettings.internal.get, {});
    return {
      googleAuthEnabled:
        process.env.AUTH_GOOGLE_ENABLED === "true" ||
        (process.env.AUTH_GOOGLE_ENABLED !== "false" &&
          Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)),
      passwordAuthEnabled: process.env.AUTH_PASSWORD_ENABLED !== "false",
      requireAuth: settings.requireAuth,
      bookmarksEnabled: settings.bookmarksEnabled,
      features: settings.features,
    };
  },
});
