import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { tagNavGroupValidator, tagValidator } from "../lib/validators";
import { slugify } from "../lib/text";
import { MAX_TAGS, canViewPost, listUserChannelIdSet } from "../lib/access";

type Ctx = QueryCtx | MutationCtx;

export async function ensureTag(ctx: MutationCtx, name: string): Promise<Id<"tags">> {
  const existing = await ctx.db
    .query("tags")
    .withIndex("by_name", (q) => q.eq("name", name))
    .first();
  if (existing) return existing._id;
  let slug = slugify(name);
  for (let n = 0; n < 50; n += 1) {
    const candidate = n === 0 ? slug : `${slug}-${n + 1}`;
    const taken = await ctx.db
      .query("tags")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();
    if (!taken) {
      return await ctx.db.insert("tags", { name, slug: candidate });
    }
  }
  throw new Error("Could not generate a unique tag slug");
}

export const create = internalMutation({
  args: { name: v.string() },
  returns: v.id("tags"),
  handler: async (ctx, args) => {
    const name = args.name.trim().toLowerCase();
    if (name.length === 0) throw new Error("Tag name is required");
    return await ensureTag(ctx, name.slice(0, 40));
  },
});

export const rename = internalMutation({
  args: { tagId: v.id("tags"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tag = await ctx.db.get("tags", args.tagId);
    if (!tag) throw new Error("Tag not found");
    const name = args.name.trim().toLowerCase().slice(0, 40);
    if (name.length === 0) throw new Error("Tag name is required");
    if (name !== tag.name) {
      const clash = await ctx.db
        .query("tags")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();
      if (clash && clash._id !== tag._id) {
        throw new Error("A tag with that name already exists");
      }
      const links = await ctx.db
        .query("postTags")
        .withIndex("by_tag", (q) => q.eq("tag", tag.name))
        .take(200);
      for (const row of links) {
        await ctx.db.patch("postTags", row._id, { tag: name });
      }
    }
    const slug = slugify(name);
    await ctx.db.patch("tags", tag._id, { name, slug });
    return null;
  },
});

export const remove = internalMutation({
  args: { tagId: v.id("tags") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tag = await ctx.db.get("tags", args.tagId);
    if (!tag) throw new Error("Tag not found");
    for (let i = 0; i < 20; i += 1) {
      const rows = await ctx.db
        .query("postTags")
        .withIndex("by_tag", (q) => q.eq("tag", tag.name))
        .take(20);
      if (rows.length === 0) break;
      for (const row of rows) {
        await ctx.db.delete("postTags", row._id);
      }
    }
    await ctx.db.delete("tags", tag._id);
    return null;
  },
});

export const addPost = internalMutation({
  args: { tagId: v.id("tags"), postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tag = await ctx.db.get("tags", args.tagId);
    if (!tag) throw new Error("Tag not found");
    const post = await ctx.db.get("posts", args.postId);
    if (!post) throw new Error("Post not found");
    const existing = await ctx.db
      .query("postTags")
      .withIndex("by_tag_and_postId", (q) => q.eq("tag", tag.name).eq("postId", post._id))
      .first();
    if (existing) return null;
    const already = await ctx.db
      .query("postTags")
      .withIndex("by_postId", (q) => q.eq("postId", post._id))
      .take(MAX_TAGS);
    if (already.length >= MAX_TAGS) {
      throw new Error("Post has too many tags");
    }
    await ctx.db.insert("postTags", {
      postId: post._id,
      tag: tag.name,
      status: post.status,
      visibility: post.visibility,
      postCreatedAt: post.createdAt ?? post._creationTime,
      postUpdatedAt: post.updatedAt,
    });
    return null;
  },
});

export const removePost = internalMutation({
  args: { tagId: v.id("tags"), postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tag = await ctx.db.get("tags", args.tagId);
    if (!tag) throw new Error("Tag not found");
    const row = await ctx.db
      .query("postTags")
      .withIndex("by_tag_and_postId", (q) => q.eq("tag", tag.name).eq("postId", args.postId))
      .first();
    if (row) {
      await ctx.db.delete("postTags", row._id);
    }
    return null;
  },
});

export const list = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(tagValidator),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("tags").order("desc").paginate(args.paginationOpts);
    const page = [];
    for (const tag of result.page) {
      const links = await ctx.db
        .query("postTags")
        .withIndex("by_tag", (q) => q.eq("tag", tag.name))
        .take(MAX_TAGS);
      page.push({
        _id: tag._id,
        _creationTime: tag._creationTime,
        name: tag.name,
        slug: tag.slug,
        postCount: links.length,
      });
    }
    return { ...result, page };
  },
});

export const get = internalQuery({
  args: { tagId: v.id("tags") },
  returns: v.union(tagValidator, v.null()),
  handler: async (ctx, args) => {
    const tag = await ctx.db.get("tags", args.tagId);
    if (!tag) return null;
    const links = await ctx.db
      .query("postTags")
      .withIndex("by_tag", (q) => q.eq("tag", tag.name))
      .take(MAX_TAGS);
    return {
      _id: tag._id,
      _creationTime: tag._creationTime,
      name: tag.name,
      slug: tag.slug,
      postCount: links.length,
    };
  },
});

export const listPosts = internalQuery({
  args: { tagId: v.id("tags") },
  returns: v.array(
    v.object({
      _id: v.id("posts"),
      title: v.string(),
      slug: v.string(),
      status: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const tag = await ctx.db.get("tags", args.tagId);
    if (!tag) return [];
    const links = await ctx.db
      .query("postTags")
      .withIndex("by_tag", (q) => q.eq("tag", tag.name))
      .take(MAX_TAGS);
    const posts = [];
    for (const row of links) {
      const post = await ctx.db.get("posts", row.postId);
      if (!post) continue;
      posts.push({
        _id: post._id,
        title: post.title,
        slug: post.slug,
        status: post.status,
      });
    }
    return posts;
  },
});

export const listForViewer = internalQuery({
  args: {
    viewerUserId: v.union(v.id("users"), v.null()),
    asAdmin: v.boolean(),
  },
  returns: v.array(tagNavGroupValidator),
  handler: async (ctx, args) => {
    const tags = await ctx.db.query("tags").order("asc").take(MAX_TAGS);
    const viewer = { userId: args.viewerUserId, isAdmin: args.asAdmin };
    const memberships =
      args.viewerUserId && !args.asAdmin
        ? await listUserChannelIdSet(ctx, args.viewerUserId)
        : undefined;
    const groups = [];
    for (const tag of tags) {
      const links = await ctx.db
        .query("postTags")
        .withIndex("by_tag_and_status_and_visibility", (q) =>
          q.eq("tag", tag.name).eq("status", "published").eq("visibility", "listed"),
        )
        .order("desc")
        .take(MAX_TAGS);
      const posts = [];
      for (const link of links) {
        const post = await ctx.db.get("posts", link.postId);
        if (!post) continue;
        if (!(await canViewPost(ctx, post, viewer, memberships))) continue;
        posts.push({ title: post.title, slug: post.slug });
      }
      if (posts.length === 0) continue;
      groups.push({ name: tag.name, slug: tag.slug, posts });
    }
    return groups;
  },
});
