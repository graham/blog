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
    await ctx.runMutation(internal.notifications.internal.enqueuePostChange, {
      kind: "created",
      postId,
    });
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
    await ctx.runMutation(internal.notifications.internal.enqueuePostChange, {
      kind: "updated",
      postId: args.postId,
    });
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

export const setTimes = mutation({
  args: {
    postId: v.id("posts"),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.posts.internal.setTimes, args);
    return null;
  },
});


