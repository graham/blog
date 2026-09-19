import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";

export const setForPost = mutation({
  args: {
    postId: v.id("posts"),
    groupIds: v.array(v.id("bookmarkGroups")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.bookmarkGroupPosts.internal.setForPost, args);
    return null;
  },
});

export const add = mutation({
  args: {
    groupId: v.id("bookmarkGroups"),
    postId: v.id("posts"),
  },
  returns: v.id("bookmarkGroupPosts"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const linkId: Id<"bookmarkGroupPosts"> = await ctx.runMutation(
      internal.bookmarkGroupPosts.internal.add,
      args,
    );
    return linkId;
  },
});

export const addBySlug = mutation({
  args: {
    groupId: v.id("bookmarkGroups"),
    slug: v.string(),
  },
  returns: v.id("bookmarkGroupPosts"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const post = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug.trim()))
      .first();
    if (!post) {
      throw new Error("No post with that slug");
    }
    const linkId: Id<"bookmarkGroupPosts"> = await ctx.runMutation(
      internal.bookmarkGroupPosts.internal.add,
      { groupId: args.groupId, postId: post._id },
    );
    return linkId;
  },
});

export const remove = mutation({
  args: { linkId: v.id("bookmarkGroupPosts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.bookmarkGroupPosts.internal.remove, args);
    return null;
  },
});
