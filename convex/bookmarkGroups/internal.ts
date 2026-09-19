import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { bookmarkGroupNavValidator, bookmarkGroupValidator } from "../lib/validators";
import { slugify } from "../lib/text";
import {
  MAX_BOOKMARK_GROUPS,
  canViewPost,
  listUserChannelIdSet,
} from "../lib/access";

async function uniqueSlug(
  ctx: MutationCtx,
  name: string,
  excludeId: Id<"bookmarkGroups"> | null,
): Promise<string> {
  const base = slugify(name);
  for (let n = 0; n < 50; n += 1) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const existing = await ctx.db
      .query("bookmarkGroups")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();
    if (!existing || (excludeId !== null && existing._id === excludeId)) {
      return candidate;
    }
  }
  throw new Error("Could not generate a unique bookmark group slug");
}

export const create = internalMutation({
  args: { name: v.string(), createdBy: v.id("users") },
  returns: v.id("bookmarkGroups"),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (name.length === 0) {
      throw new Error("Bookmark group name is required");
    }
    const slug = await uniqueSlug(ctx, name, null);
    return await ctx.db.insert("bookmarkGroups", {
      name: name.slice(0, 80),
      slug,
      createdBy: args.createdBy,
    });
  },
});

export const rename = internalMutation({
  args: {
    groupId: v.id("bookmarkGroups"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const group = await ctx.db.get("bookmarkGroups", args.groupId);
    if (!group) {
      throw new Error("Bookmark group not found");
    }
    const name = args.name.trim();
    if (name.length === 0) {
      throw new Error("Bookmark group name is required");
    }
    const slug = await uniqueSlug(ctx, name, group._id);
    await ctx.db.patch("bookmarkGroups", group._id, {
      name: name.slice(0, 80),
      slug,
    });
    return null;
  },
});

export const remove = internalMutation({
  args: { groupId: v.id("bookmarkGroups") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const group = await ctx.db.get("bookmarkGroups", args.groupId);
    if (!group) {
      throw new Error("Bookmark group not found");
    }
    for (let i = 0; i < 20; i += 1) {
      const posts = await ctx.db
        .query("bookmarkGroupPosts")
        .withIndex("by_groupId", (q) => q.eq("groupId", group._id))
        .take(20);
      if (posts.length === 0) break;
      for (const row of posts) {
        await ctx.db.delete("bookmarkGroupPosts", row._id);
      }
    }
    await ctx.db.delete("bookmarkGroups", group._id);
    return null;
  },
});

export const list = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(bookmarkGroupValidator),
  handler: async (ctx, args) => {
    return await ctx.db.query("bookmarkGroups").order("desc").paginate(args.paginationOpts);
  },
});

export const listAll = internalQuery({
  args: {},
  returns: v.array(bookmarkGroupValidator),
  handler: async (ctx) => {
    return await ctx.db.query("bookmarkGroups").order("asc").take(MAX_BOOKMARK_GROUPS);
  },
});

export const get = internalQuery({
  args: { groupId: v.id("bookmarkGroups") },
  returns: v.union(bookmarkGroupValidator, v.null()),
  handler: async (ctx, args) => {
    const group = await ctx.db.get("bookmarkGroups", args.groupId);
    if (!group) return null;
    return group;
  },
});

export const listForViewer = internalQuery({
  args: {
    viewerUserId: v.union(v.id("users"), v.null()),
    asAdmin: v.boolean(),
  },
  returns: v.array(bookmarkGroupNavValidator),
  handler: async (ctx, args) => {
    const groups = await ctx.db.query("bookmarkGroups").order("asc").take(MAX_BOOKMARK_GROUPS);
    const viewer = { userId: args.viewerUserId, isAdmin: args.asAdmin };
    const memberships =
      args.viewerUserId && !args.asAdmin
        ? await listUserChannelIdSet(ctx, args.viewerUserId)
        : undefined;
    const visible = [];
    for (const group of groups) {
      const links = await ctx.db
        .query("bookmarkGroupPosts")
        .withIndex("by_groupId", (q) => q.eq("groupId", group._id))
        .order("asc")
        .take(MAX_BOOKMARK_GROUPS);
      const posts = [];
      for (const link of links) {
        const post = await ctx.db.get("posts", link.postId);
        if (!post) continue;
        if (post.status !== "published" || post.visibility !== "listed") continue;
        if (!(await canViewPost(ctx, post, viewer, memberships))) continue;
        posts.push({ title: post.title, slug: post.slug });
      }
      if (posts.length === 0) continue;
      visible.push({
        _id: group._id,
        name: group.name,
        slug: group.slug,
        posts,
      });
    }
    return visible;
  },
});
