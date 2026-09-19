import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  adminPostDetailValidator,
  adminPostSummaryValidator,
  postDetailValidator,
  postNavigationValidator,
  postSummaryValidator,
  visibilityValidator,
} from "../lib/validators";
import { buildSearchText, excerptFrom, normalizeTags, slugify } from "../lib/text";
import {
  canViewPost,
  deletePostChannelLinks,
  listPostChannels,
  listUserChannelIdSet,
  syncPostChannels,
} from "../lib/access";
import { loadPostAssets } from "../postAssets/internal";
import { isImageContentType } from "../postAssets/contentTypes";

type Ctx = QueryCtx | MutationCtx;

async function uniqueSlug(
  ctx: Ctx,
  desired: string,
  excludeId: Id<"posts"> | null,
): Promise<string> {
  const base = slugify(desired);
  for (let n = 0; n < 100; n += 1) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const existing = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();
    if (!existing || (excludeId !== null && existing._id === excludeId)) {
      return candidate;
    }
  }
  throw new Error("Could not generate a unique slug");
}

async function loadTags(ctx: Ctx, postId: Id<"posts">): Promise<string[]> {
  const rows = await ctx.db
    .query("postTags")
    .withIndex("by_postId", (q) => q.eq("postId", postId))
    .take(16);
  return rows.map((row) => row.tag);
}

async function loadAssets(ctx: Ctx, postId: Id<"posts">) {
  return await loadPostAssets(ctx, postId);
}

async function toSummary(ctx: Ctx, post: Doc<"posts">) {
  const author = await ctx.db.get("users", post.authorId);
  const coverImageUrl = post.coverImageId ? await ctx.storage.getUrl(post.coverImageId) : null;
  return {
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
    tags: await loadTags(ctx, post._id),
  };
}

async function toDetail(ctx: Ctx, post: Doc<"posts">) {
  const summary = await toSummary(ctx, post);
  return {
    ...summary,
    body: post.body,
    coverImageId: post.coverImageId,
    assets: await loadAssets(ctx, post._id),
  };
}

async function toAdminSummary(ctx: Ctx, post: Doc<"posts">) {
  return {
    ...(await toSummary(ctx, post)),
    channels: await listPostChannels(ctx, post._id),
  };
}

async function loadAiJob(ctx: Ctx, postId: Id<"posts">) {
  const job = await ctx.db
    .query("postAiJobs")
    .withIndex("by_postId", (q) => q.eq("postId", postId))
    .first();
  if (!job) return null;
  return {
    status: job.status,
    titles: job.titles,
    summary: job.summary,
    error: job.error,
  };
}

async function toAdminDetail(ctx: Ctx, post: Doc<"posts">) {
  return {
    ...(await toAdminSummary(ctx, post)),
    body: post.body,
    coverImageId: post.coverImageId,
    aiSummary: post.aiSummary ?? null,
    ai: await loadAiJob(ctx, post._id),
  };
}

function viewerFrom(args: { viewerUserId: Id<"users"> | null; asAdmin: boolean }) {
  return { userId: args.viewerUserId, isAdmin: args.asAdmin };
}

async function syncTags(
  ctx: MutationCtx,
  postId: Id<"posts">,
  tags: string[],
  status: "draft" | "published",
  visibility: "listed" | "unlisted",
): Promise<string[]> {
  const normalized = normalizeTags(tags);
  const wanted = new Set(normalized);
  const existing = await ctx.db
    .query("postTags")
    .withIndex("by_postId", (q) => q.eq("postId", postId))
    .take(32);
  for (const row of existing) {
    if (!wanted.has(row.tag)) {
      await ctx.db.delete("postTags", row._id);
    } else {
      if (row.status !== status || row.visibility !== visibility) {
        await ctx.db.patch("postTags", row._id, { status, visibility });
      }
      wanted.delete(row.tag);
    }
  }
  for (const tag of wanted) {
    await ctx.db.insert("postTags", { postId, tag, status, visibility });
  }
  return normalized;
}

export async function createHandler(
  ctx: MutationCtx,
  args: { authorId: Id<"users"> },
): Promise<Id<"posts">> {
  const slug = await uniqueSlug(ctx, "untitled", null);
  const now = Date.now();
  return await ctx.db.insert("posts", {
    title: "",
    slug,
    excerpt: "",
    body: "",
    status: "draft",
    visibility: "listed",
    publishedAt: null,
    authorId: args.authorId,
    updatedAt: now,
    coverImageId: null,
    searchText: "",
  });
}

export const create = internalMutation({
  args: {
    authorId: v.id("users"),
  },
  returns: v.id("posts"),
  handler: createHandler,
});

export async function saveHandler(
  ctx: MutationCtx,
  args: {
    postId: Id<"posts">;
    title: string;
    slug?: string | null;
    excerpt: string;
    body: string;
    visibility: "listed" | "unlisted";
    tags: string[];
    coverImageId?: Id<"_storage"> | null;
    channelIds?: Id<"channels">[];
  },
): Promise<{ slug: string }> {
  const post = await ctx.db.get("posts", args.postId);
  if (!post) {
    throw new Error("Post not found");
  }
  const requestedSlug = args.slug?.trim() ?? "";
  const slugSource =
    requestedSlug.length > 0 && requestedSlug !== "untitled"
      ? requestedSlug
      : args.title.length > 0
        ? args.title
        : post.slug;
  const slug = await uniqueSlug(ctx, slugSource, post._id);
  const tags = await syncTags(ctx, post._id, args.tags, post.status, args.visibility);
  const excerpt = excerptFrom(args.excerpt, args.body);
  let coverImageId = post.coverImageId;
  const nextCover = args.coverImageId;
  if (nextCover !== undefined) {
    if (nextCover !== null) {
      const asset = await ctx.db
        .query("postAssets")
        .withIndex("by_storageId", (q) => q.eq("storageId", nextCover))
        .first();
      if (!asset || asset.postId !== post._id || !isImageContentType(asset.contentType)) {
        throw new Error("Cover image is not attached to this post");
      }
    }
    coverImageId = nextCover;
  }
  await ctx.db.patch("posts", post._id, {
    title: args.title,
    slug,
    excerpt,
    body: args.body,
    visibility: args.visibility,
    updatedAt: Date.now(),
    coverImageId,
    searchText: buildSearchText(args.title, excerpt, args.body, tags),
  });
  if (args.channelIds !== undefined) {
    await syncPostChannels(ctx, post._id, args.channelIds);
  }
  return { slug };
}

export const save = internalMutation({
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
  },
  returns: v.object({ slug: v.string() }),
  handler: saveHandler,
});

export async function setPublishedHandler(
  ctx: MutationCtx,
  args: { postId: Id<"posts">; published: boolean },
): Promise<null> {
  const post = await ctx.db.get("posts", args.postId);
  if (!post) {
    throw new Error("Post not found");
  }
  const status = args.published ? "published" : "draft";
  const publishedAt = args.published ? (post.publishedAt ?? Date.now()) : post.publishedAt;
  await ctx.db.patch("posts", post._id, {
    status,
    publishedAt,
    updatedAt: Date.now(),
  });
  const tags = await ctx.db
    .query("postTags")
    .withIndex("by_postId", (q) => q.eq("postId", post._id))
    .take(16);
  for (const row of tags) {
    await ctx.db.patch("postTags", row._id, {
      status,
      visibility: post.visibility,
    });
  }
  return null;
}

export const setPublished = internalMutation({
  args: {
    postId: v.id("posts"),
    published: v.boolean(),
  },
  returns: v.null(),
  handler: setPublishedHandler,
});

export const remove = internalMutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("posts", args.postId);
    if (!post) {
      throw new Error("Post not found");
    }
    const tags = await ctx.db
      .query("postTags")
      .withIndex("by_postId", (q) => q.eq("postId", post._id))
      .take(32);
    for (const row of tags) {
      await ctx.db.delete("postTags", row._id);
    }
    const aiJobs = await ctx.db
      .query("postAiJobs")
      .withIndex("by_postId", (q) => q.eq("postId", post._id))
      .take(8);
    for (const job of aiJobs) {
      await ctx.db.delete("postAiJobs", job._id);
    }
    await deletePostChannelLinks(ctx, post._id);
    const assets = await ctx.db
      .query("postAssets")
      .withIndex("by_postId", (q) => q.eq("postId", post._id))
      .take(50);
    for (const row of assets) {
      await ctx.storage.delete(row.storageId);
      await ctx.db.delete("postAssets", row._id);
    }
    await ctx.db.delete("posts", post._id);
    return null;
  },
});

export const listPublished = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    viewerUserId: v.union(v.id("users"), v.null()),
    asAdmin: v.boolean(),
  },
  returns: paginationResultValidator(postSummaryValidator),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("posts")
      .withIndex("by_status_and_visibility", (q) =>
        q.eq("status", "published").eq("visibility", "listed"),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const viewer = viewerFrom(args);
    const memberships =
      args.viewerUserId && !args.asAdmin
        ? await listUserChannelIdSet(ctx, args.viewerUserId)
        : undefined;
    const page = [];
    for (const post of result.page) {
      if (await canViewPost(ctx, post, viewer, memberships)) {
        page.push(await toSummary(ctx, post));
      }
    }
    return { ...result, page };
  },
});

export const listAll = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(adminPostSummaryValidator),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("posts").order("desc").paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map((post) => toAdminSummary(ctx, post))),
    };
  },
});

export const getBySlug = internalQuery({
  args: {
    slug: v.string(),
    viewerUserId: v.union(v.id("users"), v.null()),
    asAdmin: v.boolean(),
  },
  returns: v.union(postDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!post) return null;
    if (!args.asAdmin && post.status !== "published") return null;
    if (!(await canViewPost(ctx, post, viewerFrom(args)))) return null;
    return await toDetail(ctx, post);
  },
});

const MAX_NAVIGATION_SCAN = 100;

export const getAdjacentBySlug = internalQuery({
  args: {
    slug: v.string(),
    viewerUserId: v.union(v.id("users"), v.null()),
    asAdmin: v.boolean(),
  },
  returns: postNavigationValidator,
  handler: async (ctx, args) => {
    const current = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    const empty = { previous: null, next: null };
    if (!current || current.status !== "published") return empty;
    const viewer = viewerFrom(args);
    if (!(await canViewPost(ctx, current, viewer))) return empty;
    const memberships =
      args.viewerUserId && !args.asAdmin
        ? await listUserChannelIdSet(ctx, args.viewerUserId)
        : undefined;

    const findVisible = async (direction: "older" | "newer") => {
      const candidates = await ctx.db
        .query("posts")
        .withIndex("by_status_and_visibility", (q) => {
          const published = q.eq("status", "published").eq("visibility", "listed");
          return direction === "older"
            ? published.lt("_creationTime", current._creationTime)
            : published.gt("_creationTime", current._creationTime);
        })
        .order(direction === "older" ? "desc" : "asc")
        .take(MAX_NAVIGATION_SCAN);
      for (const candidate of candidates) {
        if (await canViewPost(ctx, candidate, viewer, memberships)) {
          return { title: candidate.title, slug: candidate.slug };
        }
      }
      return null;
    };

    return {
      previous: await findVisible("older"),
      next: await findVisible("newer"),
    };
  },
});

export const getDraftForAi = internalQuery({
  args: { postId: v.id("posts") },
  returns: v.union(
    v.object({
      title: v.string(),
      body: v.string(),
      excerpt: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("posts", args.postId);
    if (!post) return null;
    return {
      title: post.title,
      body: post.body,
      excerpt: post.excerpt,
    };
  },
});

export const getById = internalQuery({
  args: { postId: v.id("posts") },
  returns: v.union(adminPostDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("posts", args.postId);
    if (!post) return null;
    return await toAdminDetail(ctx, post);
  },
});

export const searchPublished = internalQuery({
  args: {
    query: v.string(),
    tag: v.union(v.string(), v.null()),
    viewerUserId: v.union(v.id("users"), v.null()),
    asAdmin: v.boolean(),
  },
  returns: v.array(postSummaryValidator),
  handler: async (ctx, args) => {
    const q = args.query.trim();
    if (q.length === 0) return [];
    const rows = await ctx.db
      .query("posts")
      .withSearchIndex("search_text", (search) =>
        search.search("searchText", q).eq("status", "published").eq("visibility", "listed"),
      )
      .take(20);
    const viewer = viewerFrom(args);
    const memberships =
      args.viewerUserId && !args.asAdmin
        ? await listUserChannelIdSet(ctx, args.viewerUserId)
        : undefined;
    const visible = [];
    for (const post of rows) {
      if (await canViewPost(ctx, post, viewer, memberships)) {
        visible.push(await toSummary(ctx, post));
      }
    }
    if (!args.tag) return visible;
    const tag = args.tag.trim().toLowerCase();
    return visible.filter((post) => post.tags.includes(tag));
  },
});

export const listByTag = internalQuery({
  args: {
    tag: v.string(),
    paginationOpts: paginationOptsValidator,
    viewerUserId: v.union(v.id("users"), v.null()),
    asAdmin: v.boolean(),
  },
  returns: paginationResultValidator(postSummaryValidator),
  handler: async (ctx, args) => {
    const tag = args.tag.trim().toLowerCase();
    const result = await ctx.db
      .query("postTags")
      .withIndex("by_tag_and_status_and_visibility", (q) =>
        q.eq("tag", tag).eq("status", "published").eq("visibility", "listed"),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const viewer = viewerFrom(args);
    const memberships =
      args.viewerUserId && !args.asAdmin
        ? await listUserChannelIdSet(ctx, args.viewerUserId)
        : undefined;
    const page = [];
    for (const row of result.page) {
      const post = await ctx.db.get("posts", row.postId);
      if (!post) continue;
      if (await canViewPost(ctx, post, viewer, memberships)) {
        page.push(await toSummary(ctx, post));
      }
    }
    return { ...result, page };
  },
});

export const searchAll = internalQuery({
  args: { query: v.string() },
  returns: v.array(adminPostSummaryValidator),
  handler: async (ctx, args) => {
    const q = args.query.trim();
    if (q.length === 0) return [];
    const rows = await ctx.db
      .query("posts")
      .withSearchIndex("search_text", (search) => search.search("searchText", q))
      .take(20);
    return await Promise.all(rows.map((post) => toAdminSummary(ctx, post)));
  },
});
