import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";
import { visibilityValidator } from "../lib/validators";

export const create = mutation({
  args: {},
  returns: v.id("posts"),
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const postId: Id<"posts"> = await ctx.runMutation(
      internal.posts.internal.create,
      { authorId: admin._id },
    );
    return postId;
  },
});

export const save = mutation({
  args: {
    postId: v.id("posts"),
    title: v.string(),
    slug: v.optional(v.union(v.string(), v.null())),
    excerpt: v.string(),
    body: v.string(),
    visibility: visibilityValidator,
    tags: v.array(v.string()),
    coverImageId: v.optional(v.union(v.id("_storage"), v.null())),
    channelIds: v.optional(v.array(v.id("channels"))),
    bookmarkGroupIds: v.optional(v.array(v.id("bookmarkGroups"))),
  },
  returns: v.object({ slug: v.string() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result: { slug: string } = await ctx.runMutation(
      internal.posts.internal.save,
      args,
    );
    return result;
  },
});

export const setPublished = mutation({
  args: {
    postId: v.id("posts"),
    published: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.posts.internal.setPublished, args);
    return null;
  },
});

export const remove = mutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.posts.internal.remove, args);
    return null;
  },
});
