import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { getViewablePost } from "../lib/access";

export const record = mutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await getViewablePost(ctx, args.postId);
    if (!post) return null;
    await ctx.runMutation(internal.postViews.internal.record, { postId: post._id });
    return null;
  },
});
