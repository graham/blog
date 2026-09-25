import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { getViewablePost } from "../lib/access";
import { postPhotos } from "../posts/internal";

export const record = mutation({
  args: { postId: v.id("posts"), src: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await getViewablePost(ctx, args.postId);
    if (!post) return null;
    const photos = await postPhotos(ctx, post);
    if (!photos.some((photo) => photo.src === args.src)) return null;
    await ctx.runMutation(internal.imageViews.internal.record, {
      postId: post._id,
      src: args.src,
    });
    return null;
  },
});
