import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { adminPostSummaryValidator } from "../lib/validators";
import { MAX_BOOKMARK_GROUPS, MAX_CHANNELS, syncPostBookmarkGroups } from "../lib/access";
import { countPostImages } from "../postAssets/internal";

export const setForPost = internalMutation({
  args: {
    postId: v.id("posts"),
    groupIds: v.array(v.id("bookmarkGroups")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("posts", args.postId);
    if (!post) {
      throw new Error("Post not found");
    }
    await syncPostBookmarkGroups(ctx, args.postId, args.groupIds);
    return null;
  },
});

export const add = internalMutation({
  args: {
    groupId: v.id("bookmarkGroups"),
    postId: v.id("posts"),
  },
  returns: v.id("bookmarkGroupPosts"),
  handler: async (ctx, args) => {
    const group = await ctx.db.get("bookmarkGroups", args.groupId);
    if (!group) {
      throw new Error("Bookmark group not found");
    }
    const post = await ctx.db.get("posts", args.postId);
    if (!post) {
      throw new Error("Post not found");
    }
    const existing = await ctx.db
      .query("bookmarkGroupPosts")
      .withIndex("by_groupId_and_postId", (q) =>
        q.eq("groupId", args.groupId).eq("postId", args.postId),
      )
      .first();
    if (existing) {
      return existing._id;
    }
    const alreadyOnPost = await ctx.db
      .query("bookmarkGroupPosts")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .take(MAX_BOOKMARK_GROUPS);
    if (alreadyOnPost.length >= MAX_BOOKMARK_GROUPS) {
      throw new Error("Post is in too many bookmark groups");
    }
    const alreadyInGroup = await ctx.db
      .query("bookmarkGroupPosts")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .take(MAX_BOOKMARK_GROUPS);
    if (alreadyInGroup.length >= MAX_BOOKMARK_GROUPS) {
      throw new Error("Bookmark group has too many posts");
    }
    return await ctx.db.insert("bookmarkGroupPosts", {
      groupId: args.groupId,
      postId: args.postId,
    });
  },
});

export const remove = internalMutation({
  args: { linkId: v.id("bookmarkGroupPosts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("bookmarkGroupPosts", args.linkId);
    if (!row) {
      throw new Error("Assignment not found");
    }
    await ctx.db.delete("bookmarkGroupPosts", row._id);
    return null;
  },
});

export const listByGroup = internalQuery({
  args: {
    groupId: v.id("bookmarkGroups"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(
    v.object({
      ...adminPostSummaryValidator.fields,
      linkId: v.id("bookmarkGroupPosts"),
    }),
  ),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("bookmarkGroupPosts")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .order("asc")
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
        read: null,
        linkId: row._id,
      });
    }
    return { ...result, page };
  },
});
