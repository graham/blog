import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("tags"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const tagId: Id<"tags"> = await ctx.runMutation(internal.tags.internal.create, args);
    return tagId;
  },
});

export const rename = mutation({
  args: { tagId: v.id("tags"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.tags.internal.rename, args);
    return null;
  },
});

export const remove = mutation({
  args: { tagId: v.id("tags") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.tags.internal.remove, args);
    return null;
  },
});

export const addPost = mutation({
  args: { tagId: v.id("tags"), postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.tags.internal.addPost, args);
    return null;
  },
});

export const addPostBySlug = mutation({
  args: { tagId: v.id("tags"), slug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const post = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug.trim()))
      .first();
    if (!post) throw new Error("No post with that slug");
    await ctx.runMutation(internal.tags.internal.addPost, {
      tagId: args.tagId,
      postId: post._id,
    });
    return null;
  },
});

export const removePost = mutation({
  args: { tagId: v.id("tags"), postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.tags.internal.removePost, args);
    return null;
  },
});
