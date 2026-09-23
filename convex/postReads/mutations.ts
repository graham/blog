import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireMember } from "../lib/auth";
import { viewerFromUserType } from "../lib/featureMode";
import { canViewPost, listUserChannelIdSet } from "../lib/access";
import { readSiteSettings } from "../siteSettings/internal";
import { featureVisible } from "../lib/featureMode";

export const markRead = mutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireMember(ctx);
    const settings = await readSiteSettings(ctx);
    if (!featureVisible(settings.features.readReceipts, viewerFromUserType(user.userType))) {
      return null;
    }
    const post = await ctx.db.get("posts", args.postId);
    if (!post) throw new Error("Post not found");
    const memberships =
      user.userType === "admin" ? undefined : await listUserChannelIdSet(ctx, user._id);
    if (!(await canViewPost(ctx, post, { userId: user._id, isAdmin: user.userType === "admin" }, memberships))) {
      throw new Error("Forbidden");
    }
    await ctx.runMutation(internal.postReads.internal.markRead, {
      userId: user._id,
      postId: args.postId,
    });
    return null;
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const user = await requireMember(ctx);
    const settings = await readSiteSettings(ctx);
    if (!featureVisible(settings.features.readReceipts, viewerFromUserType(user.userType))) {
      return 0;
    }
    const deleted: number = await ctx.runMutation(internal.postReads.internal.markAllRead, {
      userId: user._id,
    });
    return deleted;
  },
});
