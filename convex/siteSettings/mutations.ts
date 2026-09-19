import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { siteSettingsValidator } from "../lib/validators";
import type { Infer } from "convex/values";

type SiteSettings = Infer<typeof siteSettingsValidator>;

export const setRequireAuth = mutation({
  args: { requireAuth: v.boolean() },
  returns: siteSettingsValidator,
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const settings: SiteSettings = await ctx.runMutation(
      internal.siteSettings.internal.setRequireAuth,
      { requireAuth: args.requireAuth, updatedBy: admin._id },
    );
    console.log(
      `Site requireAuth set to ${args.requireAuth} by ${admin.email ?? admin._id}`,
    );
    return settings;
  },
});
