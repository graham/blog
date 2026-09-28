import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { readSiteSettings } from "../siteSettings/internal";
import { featureVisible } from "../lib/featureMode";

export const markRead = mutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);
    const settings = await readSiteSettings(ctx);
    if (!featureVisible(settings.features.readReceipts, true)) {
      return null;
    }
    const post = await ctx.db.get("posts", args.postId);
    if (!post) throw new Error("Post not found");
    await ctx.runMutation(internal.draftReads.internal.markRead, {
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
    const user = await requireAdmin(ctx);
    const settings = await readSiteSettings(ctx);
    if (!featureVisible(settings.features.readReceipts, true)) {
      return 0;
    }
    const deleted: number = await ctx.runMutation(internal.draftReads.internal.markAllRead, {
      userId: user._id,
    });
    return deleted;
  },
});
