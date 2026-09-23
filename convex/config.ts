import { v } from "convex/values";
import { query } from "./_generated/server";
import { internal } from "./_generated/api";
import { featuresValidator, siteSettingsValidator } from "./lib/validators";
import {
  envGoogleAuthAvailable,
  envPasswordAuthAvailable,
  envPushoverAvailable,
} from "./lib/env";
import type { Infer } from "convex/values";

type SiteSettings = Infer<typeof siteSettingsValidator>;

// Anonymous by design: the sign-in page and the site gate both need this
// before anyone is authenticated.
export const getConfig = query({
  args: {},
  returns: v.object({
    googleAuthAvailable: v.boolean(),
    googleAuthEnabled: v.boolean(),
    passwordAuthAvailable: v.boolean(),
    passwordAuthEnabled: v.boolean(),
    pushoverAvailable: v.boolean(),
    pushoverEnabled: v.boolean(),
    requireAuth: v.boolean(),
    bookmarksEnabled: v.boolean(),
    features: featuresValidator,
  }),
  handler: async (ctx) => {
    const settings: SiteSettings = await ctx.runQuery(internal.siteSettings.internal.get, {});
    const googleAuthAvailable = envGoogleAuthAvailable();
    const passwordAuthAvailable = envPasswordAuthAvailable();
    const pushoverAvailable = envPushoverAvailable();
    return {
      googleAuthAvailable,
      googleAuthEnabled: googleAuthAvailable && settings.googleSignIn,
      passwordAuthAvailable,
      passwordAuthEnabled: passwordAuthAvailable && settings.passwordSignIn,
      pushoverAvailable,
      pushoverEnabled: pushoverAvailable && settings.pushoverEnabled,
      requireAuth: settings.requireAuth,
      bookmarksEnabled: settings.bookmarksEnabled,
      features: settings.features,
    };
  },
});
