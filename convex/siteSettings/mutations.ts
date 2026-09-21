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

export const setSignInMethods = mutation({
  args: {
    googleSignIn: v.optional(v.boolean()),
    passwordSignIn: v.optional(v.boolean()),
  },
  returns: siteSettingsValidator,
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const settings: SiteSettings = await ctx.runMutation(
      internal.siteSettings.internal.setSignInMethods,
      {
        updatedBy: admin._id,
        googleSignIn: args.googleSignIn,
        passwordSignIn: args.passwordSignIn,
      },
    );
    console.log(
      `Sign-in methods updated by ${admin.email ?? admin._id}: google=${settings.googleSignIn} password=${settings.passwordSignIn}`,
    );
    return settings;
  },
});

export const setBookmarksEnabled = mutation({
  args: { bookmarksEnabled: v.boolean() },
  returns: siteSettingsValidator,
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const settings: SiteSettings = await ctx.runMutation(
      internal.siteSettings.internal.setBookmarksEnabled,
      { bookmarksEnabled: args.bookmarksEnabled, updatedBy: admin._id },
    );
    console.log(
      `Site bookmarksEnabled set to ${args.bookmarksEnabled} by ${admin.email ?? admin._id}`,
    );
    return settings;
  },
});
