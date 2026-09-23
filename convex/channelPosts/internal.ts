import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { adminPostSummaryValidator } from "../lib/validators";
import { MAX_CHANNELS, syncPostChannels } from "../lib/access";
import { countPostImages } from "../postAssets/internal";

export const setForPost = internalMutation({
  args: {
    postId: v.id("posts"),
    channelIds: v.array(v.id("channels")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("posts", args.postId);
    if (!post) {
      throw new Error("Post not found");
    }
    await syncPostChannels(ctx, args.postId, args.channelIds);
    return null;
  },
});

export const add = internalMutation({
  args: {
    channelId: v.id("channels"),
    postId: v.id("posts"),
  },
  returns: v.id("channelPosts"),
  handler: async (ctx, args) => {
    const channel = await ctx.db.get("channels", args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }
    const post = await ctx.db.get("posts", args.postId);
    if (!post) {
      throw new Error("Post not found");
    }
    const existing = await ctx.db
      .query("channelPosts")
      .withIndex("by_channelId_and_postId", (q) =>
        q.eq("channelId", args.channelId).eq("postId", args.postId),
      )
      .first();
    if (existing) {
      return existing._id;
    }
    const already = await ctx.db
      .query("channelPosts")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .take(MAX_CHANNELS);
    if (already.length >= MAX_CHANNELS) {
      throw new Error("Post is in too many channels");
    }
    return await ctx.db.insert("channelPosts", {
      channelId: args.channelId,
      postId: args.postId,
    });
  },
});

export const remove = internalMutation({
  args: { linkId: v.id("channelPosts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("channelPosts", args.linkId);
    if (!row) {
      throw new Error("Assignment not found");
    }
    await ctx.db.delete("channelPosts", row._id);
    return null;
  },
});

export const listByChannel = internalQuery({
  args: {
    channelId: v.id("channels"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(
    v.object({
      ...adminPostSummaryValidator.fields,
      linkId: v.id("channelPosts"),
    }),
  ),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("channelPosts")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .paginate(args.paginationOpts);
    const page = [];
    for (const row of result.page) {
      const post = await ctx.db.get("posts", row.postId);
      if (!post) continue;
      const author = await ctx.db.get("users", post.authorId);
      const coverImageUrl = post.coverImageId
        ? await ctx.storage.getUrl(post.coverImageId)
        : null;
      const tags = await ctx.db
        .query("postTags")
        .withIndex("by_postId", (q) => q.eq("postId", post._id))
        .take(16);
      const channelRows = await ctx.db
        .query("channelPosts")
        .withIndex("by_postId", (q) => q.eq("postId", post._id))
        .take(MAX_CHANNELS);
      const channels = [];
      for (const link of channelRows) {
        const channel = await ctx.db.get("channels", link.channelId);
        if (channel) {
          channels.push({ _id: channel._id, name: channel.name });
        }
      }
      page.push({
        _id: post._id,
        _creationTime: post._creationTime,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        status: post.status,
        visibility: post.visibility,
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
        authorId: post.authorId,
        authorName: author?.name ?? null,
        coverImageUrl,
        tags: tags.map((tag) => tag.tag),
        channels,
        imageCount: await countPostImages(ctx, post._id, post.coverImageId),
        characterCount: post.body.length,
        linkId: row._id,
      });
    }
    return { ...result, page };
  },
});
