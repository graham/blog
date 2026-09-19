import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";

export const setForPost = mutation({
  args: {
    postId: v.id("posts"),
    channelIds: v.array(v.id("channels")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.channelPosts.internal.setForPost, args);
    return null;
  },
});

export const add = mutation({
  args: {
    channelId: v.id("channels"),
    postId: v.id("posts"),
  },
  returns: v.id("channelPosts"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const linkId: Id<"channelPosts"> = await ctx.runMutation(
      internal.channelPosts.internal.add,
      args,
    );
    return linkId;
  },
});

export const addBySlug = mutation({
  args: {
    channelId: v.id("channels"),
    slug: v.string(),
  },
  returns: v.id("channelPosts"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const post = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug.trim()))
      .first();
    if (!post) {
      throw new Error("No post with that slug");
    }
    const linkId: Id<"channelPosts"> = await ctx.runMutation(
      internal.channelPosts.internal.add,
      { channelId: args.channelId, postId: post._id },
    );
    return linkId;
  },
});

export const remove = mutation({
  args: { linkId: v.id("channelPosts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.channelPosts.internal.remove, args);
    return null;
  },
});
