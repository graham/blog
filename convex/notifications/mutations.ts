import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { envPushoverAvailable } from "../lib/env";
import { readSiteSettings } from "../siteSettings/internal";

export const testPushover = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    if (!envPushoverAvailable()) {
      throw new Error("Pushover credentials are not set on this deployment");
    }
    const settings = await readSiteSettings(ctx);
    if (!settings.pushoverEnabled) {
      throw new Error("Turn Pushover on first");
    }
    await ctx.scheduler.runAfter(0, internal.notifications.actions.send, {
      title: "Blog",
      message: "Pushover test from settings",
    });
    return null;
  },
});
