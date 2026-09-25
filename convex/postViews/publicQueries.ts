import { v } from "convex/values";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import { getViewablePost } from "../lib/access";

export const getCount = query({
  args: { postId: v.id("posts") },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    const post = await getViewablePost(ctx, args.postId);
    if (!post) return 0;
    return await ctx.runQuery(internal.postViews.internal.getCount, { postId: post._id });
  },
});
