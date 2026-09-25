import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  adminPostDetailValidator,
  adminPostSummaryValidator,
  postDetailValidator,
  postNavigationValidator,
  postSummaryValidator,
  calendarPostValidator,
  postReadStateValidator,
  visibilityValidator,
  photoCursorValidator,
  photoPageValidator,
} from "../lib/validators";
import type { Infer } from "convex/values";
import { buildSearchText, excerptFrom, normalizeTags, slugify } from "../lib/text";
import {
  canViewPost,
  deletePostBookmarkLinks,
  deletePostChannelLinks,
  listPostBookmarkGroups,
  listPostChannels,
  listUserChannelIdSet,
  syncPostBookmarkGroups,
  syncPostChannels,
} from "../lib/access";
import { readSiteSettings } from "../siteSettings/internal";
import { countPostImages, loadPostAssets } from "../postAssets/internal";
import { ensureTag } from "../tags/internal";
import { deletePostReads, getReadBefore, readStateForPost } from "../postReads/internal";
import { requireAdmin } from "../lib/auth";
import { featureVisible } from "../lib/featureMode";
import { isImageContentType } from "../postAssets/contentTypes";
import { dayCountQueries, publishedByDay, syncPublishedByDay } from "./aggregate";

type Ctx = QueryCtx | MutationCtx;
type PostStatus = Doc<"posts">["status"];

async function patchPostTagTimes(
  ctx: MutationCtx,
  postId: Id<"posts">,
  createdAt: number,
  updatedAt: number,
) {
  const rows = await ctx.db
    .query("postTags")
    .withIndex("by_postId", (q) => q.eq("postId", postId))
    .take(32);
  for (const row of rows) {
    await ctx.db.patch("postTags", row._id, {
      postCreatedAt: createdAt,
      postUpdatedAt: updatedAt,
    });
  }
}

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
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    status: post.status,
    visibility: post.visibility,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    authorId: post.authorId,
    authorName: author?.name ?? null,
    coverImageUrl,
    tags: await loadTags(ctx, post._id),
    read: null,
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
    imageCount: await countPostImages(ctx, post._id, post.coverImageId),
    characterCount: post.body.length,
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
    bookmarkGroups: await listPostBookmarkGroups(ctx, post._id),
    aiSummary: post.aiSummary ?? null,
    ai: await loadAiJob(ctx, post._id),
  };
}

function viewerFrom(args: { viewerUserId: Id<"users"> | null; asAdmin: boolean }) {
  return { userId: args.viewerUserId, isAdmin: args.asAdmin };
}

function isUnreadSummary(read: Infer<typeof postReadStateValidator> | null): boolean {
  return read !== null && (read.unread || read.updatedSinceRead);
}

async function attachReadStates<
  T extends { _id: Id<"posts">; updatedAt: number; read: Infer<typeof postReadStateValidator> | null },
>(
  ctx: Ctx,
  viewerUserId: Id<"users"> | null,
  asAdmin: boolean,
  summaries: T[],
): Promise<T[]> {
  const settings = await readSiteSettings(ctx);
  if (!viewerUserId || !featureVisible(settings.features.readReceipts, asAdmin)) {
    return summaries;
  }
  const readBefore = await getReadBefore(ctx, viewerUserId);
  const next: T[] = [];
  for (const summary of summaries) {
    next.push({
      ...summary,
      read: await readStateForPost(ctx, viewerUserId, summary._id, summary.updatedAt, readBefore),
    });
  }
  return next;
}

async function syncTags(
  ctx: MutationCtx,
  postId: Id<"posts">,
  tags: string[],
  status: PostStatus,
  visibility: "listed" | "unlisted",
  postCreatedAt: number,
  postUpdatedAt: number,
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
      await ctx.db.patch("postTags", row._id, {
        status,
        visibility,
        postCreatedAt,
        postUpdatedAt,
      });
      wanted.delete(row.tag);
    }
  }
  for (const tag of wanted) {
    await ensureTag(ctx, tag);
    await ctx.db.insert("postTags", {
      postId,
      tag,
      status,
      visibility,
      postCreatedAt,
      postUpdatedAt,
    });
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
    createdAt: now,
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
    bookmarkGroupIds?: Id<"bookmarkGroups">[];
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
  const updatedAt = Date.now();
  const tags = await syncTags(
    ctx,
    post._id,
    args.tags,
    post.status,
    args.visibility,
    post.createdAt,
    updatedAt,
  );
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
    updatedAt,
    coverImageId,
    searchText: buildSearchText(args.title, excerpt, args.body, tags),
  });
  const saved = await ctx.db.get("posts", post._id);
  if (saved) {
    await syncPublishedByDay(ctx, post, saved);
  }
  if (args.channelIds !== undefined) {
    await syncPostChannels(ctx, post._id, args.channelIds);
  }
  if (args.bookmarkGroupIds !== undefined) {
    await syncPostBookmarkGroups(ctx, post._id, args.bookmarkGroupIds);
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
    bookmarkGroupIds: v.optional(v.array(v.id("bookmarkGroups"))),
  },
  returns: v.object({ slug: v.string() }),
  handler: saveHandler,
});

// A published post whose publishedAt is still in the future is "scheduled":
// every public read filters on status "published", so it stays hidden until
// publishScheduled flips it at publishedAt. Queries cannot read the clock,
// which is why the transition is materialized by a scheduled mutation.
async function applyPublication(
  ctx: MutationCtx,
  post: Doc<"posts">,
  args: { published: boolean; publishedAt: number | null; updatedAt: number },
): Promise<void> {
  const status: PostStatus = !args.published
    ? "draft"
    : args.publishedAt !== null && args.publishedAt > Date.now()
      ? "scheduled"
      : "published";
  const publishedAt = status === "published" ? (args.publishedAt ?? Date.now()) : args.publishedAt;
  await ctx.db.patch("posts", post._id, {
    status,
    publishedAt,
    updatedAt: args.updatedAt,
  });
  const saved = await ctx.db.get("posts", post._id);
  if (saved) {
    await syncPublishedByDay(ctx, post, saved);
  }
  const tags = await ctx.db
    .query("postTags")
    .withIndex("by_postId", (q) => q.eq("postId", post._id))
    .take(16);
  for (const row of tags) {
    await ctx.db.patch("postTags", row._id, {
      status,
      visibility: post.visibility,
      postCreatedAt: post.createdAt,
      postUpdatedAt: args.updatedAt,
    });
  }
  if (status === "scheduled" && publishedAt !== null) {
    // Earlier jobs for a moved or cancelled schedule no-op in publishScheduled.
    await ctx.scheduler.runAt(publishedAt, internal.posts.internal.publishScheduled, {
      postId: post._id,
      publishedAt,
    });
  }
}

export async function setPublishedHandler(
  ctx: MutationCtx,
  args: { postId: Id<"posts">; published: boolean },
): Promise<null> {
  const post = await ctx.db.get("posts", args.postId);
  if (!post) {
    throw new Error("Post not found");
  }
  await applyPublication(ctx, post, {
    published: args.published,
    publishedAt: post.publishedAt,
    updatedAt: Date.now(),
  });
  return null;
}

export const publishScheduled = internalMutation({
  args: { postId: v.id("posts"), publishedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("posts", args.postId);
    if (!post || post.status !== "scheduled" || post.publishedAt !== args.publishedAt) {
      return null;
    }
    await ctx.db.patch("posts", post._id, { status: "published" });
    const saved = await ctx.db.get("posts", post._id);
    if (saved) {
      await syncPublishedByDay(ctx, post, saved);
    }
    const tags = await ctx.db
      .query("postTags")
      .withIndex("by_postId", (q) => q.eq("postId", post._id))
      .take(16);
    for (const row of tags) {
      await ctx.db.patch("postTags", row._id, { status: "published" });
    }
    await ctx.runMutation(internal.notifications.internal.enqueuePostChange, {
      kind: "updated",
      postId: post._id,
    });
    return null;
  },
});

export const setPublished = internalMutation({
  args: {
    postId: v.id("posts"),
    published: v.boolean(),
  },
  returns: v.null(),
  handler: setPublishedHandler,
});

function assertTimestamp(value: number, label: string) {
  if (!Number.isFinite(value)) throw new Error(`${label} is not a valid time`);
  if (value < 0 || value > 32503680000000) throw new Error(`${label} is out of range`);
}

export async function setTimesHandler(
  ctx: MutationCtx,
  args: {
    postId: Id<"posts">;
    createdAt: number;
    updatedAt: number;
    publishedAt?: number | null;
  },
): Promise<null> {
  const post = await ctx.db.get("posts", args.postId);
  if (!post) throw new Error("Post not found");
  assertTimestamp(args.createdAt, "Created");
  assertTimestamp(args.updatedAt, "Updated");
  await ctx.db.patch("posts", post._id, {
    createdAt: args.createdAt,
    updatedAt: args.updatedAt,
  });
  await patchPostTagTimes(ctx, post._id, args.createdAt, args.updatedAt);
  if (args.publishedAt !== undefined && args.publishedAt !== post.publishedAt) {
    if (args.publishedAt !== null) assertTimestamp(args.publishedAt, "Published");
    const current = await ctx.db.get("posts", post._id);
    if (!current) throw new Error("Post not found");
    await applyPublication(ctx, current, {
      published: current.status !== "draft",
      publishedAt: args.publishedAt,
      updatedAt: args.updatedAt,
    });
  }
  return null;
}

export const setTimes = internalMutation({
  args: {
    postId: v.id("posts"),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.null(),
  handler: setTimesHandler,
});

// Publishes a held post as if it were written right now: created, updated,
// and published all become the current time, so it lands at the top of the
// list and is live immediately.
export async function publishNowHandler(
  ctx: MutationCtx,
  args: { postId: Id<"posts"> },
): Promise<null> {
  const post = await ctx.db.get("posts", args.postId);
  if (!post) throw new Error("Post not found");
  const now = Date.now();
  await ctx.db.patch("posts", post._id, { createdAt: now, updatedAt: now });
  await patchPostTagTimes(ctx, post._id, now, now);
  const current = await ctx.db.get("posts", post._id);
  if (!current) throw new Error("Post not found");
  await applyPublication(ctx, current, { published: true, publishedAt: now, updatedAt: now });
  return null;
}

export const publishNow = internalMutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: publishNowHandler,
});

export const assertAdmin = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return null;
  },
});

export const remove = internalMutation({
  args: { postId: v.id("posts") },
  returns: v.array(v.id("_storage")),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("posts", args.postId);
    if (!post) {
      throw new Error("Post not found");
    }
    if (post.status === "published") {
      throw new Error("Published posts cannot be deleted");
    }
    const storageIds = new Set<Id<"_storage">>();
    if (post.coverImageId) storageIds.add(post.coverImageId);
    for (;;) {
      const assets = await ctx.db
        .query("postAssets")
        .withIndex("by_postId", (q) => q.eq("postId", post._id))
        .take(32);
      if (assets.length === 0) break;
      for (const row of assets) {
        storageIds.add(row.storageId);
        await ctx.db.delete("postAssets", row._id);
      }
    }
    for (;;) {
      const tags = await ctx.db
        .query("postTags")
        .withIndex("by_postId", (q) => q.eq("postId", post._id))
        .take(32);
      if (tags.length === 0) break;
      for (const row of tags) {
        await ctx.db.delete("postTags", row._id);
      }
    }
    for (;;) {
      const jobs = await ctx.db
        .query("postAiJobs")
        .withIndex("by_postId", (q) => q.eq("postId", post._id))
        .take(8);
      if (jobs.length === 0) break;
      for (const row of jobs) {
        await ctx.db.delete("postAiJobs", row._id);
      }
    }
    await deletePostReads(ctx, post._id);
    await deletePostChannelLinks(ctx, post._id);
    await deletePostBookmarkLinks(ctx, post._id);
    await syncPublishedByDay(ctx, post, null);
    await ctx.db.delete("posts", post._id);
    return [...storageIds];
  },
});

export const listPublished = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    viewerUserId: v.union(v.id("users"), v.null()),
    asAdmin: v.boolean(),
    unreadOnly: v.optional(v.boolean()),
  },
  returns: paginationResultValidator(postSummaryValidator),
  handler: async (ctx, args) => {
    const sort = (await readSiteSettings(ctx)).features.sortOrder;
    const listed = ctx.db
      .query("posts")
      .withIndex(
        sort === "updated"
          ? "by_status_and_visibility_and_updatedAt"
          : "by_status_and_visibility_and_createdAt",
        (q) => q.eq("status", "published").eq("visibility", "listed"),
      );
    const wanted = args.paginationOpts.numItems;
    const sourceSize = args.unreadOnly ? Math.min(Math.max(wanted * 10, 50), 100) : wanted;
    const result = await listed.order("desc").paginate({
      numItems: sourceSize,
      cursor: args.paginationOpts.cursor,
    });
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
    const withRead = await attachReadStates(ctx, args.viewerUserId, args.asAdmin, page);
    const filtered = args.unreadOnly
      ? withRead.filter((post) => isUnreadSummary(post.read))
      : withRead;
    const isDone = result.isDone || filtered.length === 0;
    return { ...result, page: filtered, isDone };
  },
});

export const listAll = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(adminPostSummaryValidator),
  handler: async (ctx, args) => {
    const sort = (await readSiteSettings(ctx)).features.sortOrder;
    const result =
      sort === "updated"
        ? await ctx.db.query("posts").withIndex("by_updatedAt").order("desc").paginate(args.paginationOpts)
        : await ctx.db.query("posts").withIndex("by_createdAt").order("desc").paginate(args.paginationOpts);
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
    if (post.status !== "published") return null;
    if (!(await canViewPost(ctx, post, viewerFrom(args)))) return null;
    const detail = await toDetail(ctx, post);
    const [withRead] = await attachReadStates(ctx, args.viewerUserId, args.asAdmin, [detail]);
    return withRead ?? detail;
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

    const sort = (await readSiteSettings(ctx)).features.sortOrder;
    const findVisible = async (direction: "older" | "newer") => {
      const order = direction === "older" ? "desc" : "asc";
      const candidates =
        sort === "updated"
          ? await ctx.db
              .query("posts")
              .withIndex("by_status_and_visibility_and_updatedAt", (q) => {
                const published = q.eq("status", "published").eq("visibility", "listed");
                return direction === "older"
                  ? published.lt("updatedAt", current.updatedAt)
                  : published.gt("updatedAt", current.updatedAt);
              })
              .order(order)
              .take(MAX_NAVIGATION_SCAN)
          : await ctx.db
              .query("posts")
              .withIndex("by_status_and_visibility_and_createdAt", (q) => {
                const published = q.eq("status", "published").eq("visibility", "listed");
                const createdAt = current.createdAt;
                return direction === "older"
                  ? published.lt("createdAt", createdAt)
                  : published.gt("createdAt", createdAt);
              })
              .order(order)
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

const MAX_CALENDAR_POSTS = 500;
const MAX_CALENDAR_DAYS = 32;

export const listPublishedBetween = internalQuery({
  args: {
    start: v.number(),
    end: v.number(),
    viewerUserId: v.union(v.id("users"), v.null()),
    asAdmin: v.boolean(),
  },
  returns: v.array(calendarPostValidator),
  handler: async (ctx, args) => {
    const start = Math.min(args.start, args.end);
    const end = Math.max(args.start, args.end);
    const rows = await ctx.db
      .query("posts")
      .withIndex("by_status_and_visibility_and_publishedAt", (q) =>
        q
          .eq("status", "published")
          .eq("visibility", "listed")
          .gte("publishedAt", start)
          .lt("publishedAt", end),
      )
      .order("asc")
      .take(MAX_CALENDAR_POSTS);
    const viewer = viewerFrom(args);
    const memberships =
      args.viewerUserId && !args.asAdmin
        ? await listUserChannelIdSet(ctx, args.viewerUserId)
        : undefined;
    const posts = [];
    for (const post of rows) {
      if (post.publishedAt === null) continue;
      if (!(await canViewPost(ctx, post, viewer, memberships))) continue;
      posts.push({
        title: post.title,
        slug: post.slug,
        publishedAt: post.publishedAt,
      });
    }
    return posts;
  },
});

export const countPublishedDays = internalQuery({
  args: {
    days: v.array(v.object({ start: v.number(), end: v.number() })),
  },
  returns: v.array(v.number()),
  handler: async (ctx, args) => {
    if (args.days.length === 0) return [];
    if (args.days.length > MAX_CALENDAR_DAYS) {
      throw new Error("Too many days");
    }
    return await publishedByDay.countBatch(ctx, dayCountQueries(args.days));
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

export const getBySlugForAdmin = internalQuery({
  args: { slug: v.string() },
  returns: v.union(postDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!post) return null;
    return await toDetail(ctx, post);
  },
});

export const listDrafts = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(adminPostSummaryValidator),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("posts")
      .withIndex("by_status", (q) => q.eq("status", "draft"))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map((post) => toAdminSummary(ctx, post))),
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
    const tagged = args.tag
      ? visible.filter((post) => post.tags.includes(args.tag!.trim().toLowerCase()))
      : visible;
    return await attachReadStates(ctx, args.viewerUserId, args.asAdmin, tagged);
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
    const sort = (await readSiteSettings(ctx)).features.sortOrder;
    const result =
      sort === "updated"
        ? await ctx.db
            .query("postTags")
            .withIndex("by_tag_status_visibility_updatedAt", (q) =>
              q.eq("tag", tag).eq("status", "published").eq("visibility", "listed"),
            )
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("postTags")
            .withIndex("by_tag_status_visibility_createdAt", (q) =>
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
    return {
      ...result,
      page: await attachReadStates(ctx, args.viewerUserId, args.asAdmin, page),
    };
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

const PHOTO_PAGE_SIZE = 24;
const PHOTO_MAX_POSTS_SCANNED = 200;
const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

type Photo = Infer<typeof photoPageValidator>["photos"][number];
type PostPhoto = { key: string; src: string; alt: string };

// A post's photos in reading order: the cover first, then each image in the
// body. Uploaded videos and ZIPs referenced from the body are skipped.
async function postPhotos(ctx: Ctx, post: Doc<"posts">): Promise<PostPhoto[]> {
  const hasConvexImages = post.body.includes("convex://");
  if (!post.coverImageId && !post.body.includes("![")) return [];
  const assets =
    post.coverImageId || hasConvexImages
      ? await ctx.db
          .query("postAssets")
          .withIndex("by_postId", (q) => q.eq("postId", post._id))
          .take(200)
      : [];
  const byStorageId = new Map(assets.map((asset) => [asset.storageId as string, asset]));
  const photos: PostPhoto[] = [];
  const seen = new Set<string>();

  async function addAsset(storageId: string, fallbackAlt: string) {
    if (seen.has(storageId)) return;
    const asset = byStorageId.get(storageId);
    if (!asset || !isImageContentType(asset.contentType)) return;
    const url = await ctx.storage.getUrl(asset.storageId);
    if (!url) return;
    seen.add(storageId);
    photos.push({
      key: `${post._id}:${storageId}`,
      src: url,
      alt: (asset.alt || fallbackAlt || asset.filename).trim(),
    });
  }

  if (post.coverImageId) await addAsset(post.coverImageId, post.title);
  for (const match of post.body.matchAll(new RegExp(MARKDOWN_IMAGE_RE.source, "g"))) {
    const alt = match[1] ?? "";
    const src = match[2] ?? "";
    if (src.startsWith("convex://")) {
      await addAsset(src.slice("convex://".length), alt);
    } else if (/^https?:\/\//.test(src) && !seen.has(src)) {
      seen.add(src);
      photos.push({ key: `${post._id}:${src}`, src, alt: alt.trim() });
    }
  }
  return photos;
}

// Walks listed published posts newest first and flattens their photos into
// fixed-size pages. The cursor names the post to resume from (its publishedAt,
// then its position among posts sharing that publishedAt) and how many of its
// photos the previous page already showed.
export const listPhotos = internalQuery({
  args: {
    cursor: v.union(photoCursorValidator, v.null()),
    viewerUserId: v.union(v.id("users"), v.null()),
    asAdmin: v.boolean(),
  },
  returns: photoPageValidator,
  handler: async (ctx, args) => {
    const cursor = args.cursor;
    const posts = ctx.db
      .query("posts")
      .withIndex("by_status_and_visibility_and_publishedAt", (q) => {
        const listed = q.eq("status", "published").eq("visibility", "listed");
        return cursor ? listed.lte("publishedAt", cursor.publishedAt) : listed;
      })
      .order("desc");
    const viewer = viewerFrom(args);
    const memberships =
      args.viewerUserId && !args.asAdmin
        ? await listUserChannelIdSet(ctx, args.viewerUserId)
        : undefined;
    const settings = await readSiteSettings(ctx);
    const receiptsOn =
      args.viewerUserId !== null && featureVisible(settings.features.readReceipts, args.asAdmin);
    const readBefore = receiptsOn && args.viewerUserId ? await getReadBefore(ctx, args.viewerUserId) : 0;

    const photos: Photo[] = [];
    let scanned = 0;
    let resumed = cursor === null;
    for await (const post of posts) {
      if (post.publishedAt === null) continue;
      let skip = 0;
      if (!resumed && cursor) {
        if (post.publishedAt === cursor.publishedAt && post._id !== cursor.postId) continue;
        resumed = true;
        if (post._id === cursor.postId) skip = cursor.skip;
      }
      scanned += 1;
      if (scanned > PHOTO_MAX_POSTS_SCANNED) {
        return {
          photos,
          nextCursor: {
            publishedAt: post.publishedAt,
            postId: post._id,
            skip: 0,
          },
        };
      }
      if (!(await canViewPost(ctx, post, viewer, memberships))) continue;
      const allImages = await postPhotos(ctx, post);
      const postImages = allImages.slice(skip);
      if (postImages.length === 0) continue;
      let seen: boolean | null = null;
      if (receiptsOn && args.viewerUserId) {
        const read = await readStateForPost(
          ctx,
          args.viewerUserId,
          post._id,
          post.updatedAt,
          readBefore,
        );
        seen = read.lastReadAt !== null;
      }
      for (let index = 0; index < postImages.length; index += 1) {
        if (photos.length === PHOTO_PAGE_SIZE) {
          return {
            photos,
            nextCursor: {
              publishedAt: post.publishedAt,
              postId: post._id,
              skip: skip + index,
            },
          };
        }
        photos.push({
          ...postImages[index],
          postId: post._id,
          slug: post.slug,
          title: post.title,
          publishedAt: post.publishedAt,
          postIndex: skip + index,
          postPhotoCount: allImages.length,
          seen,
        });
      }
    }
    return { photos, nextCursor: null };
  },
});

// Resolves a shared /photos?post=<slug>&n=<index> link to a listPhotos cursor
// that starts at that photo, or null when the post or photo is not visible.
export const photoAnchor = internalQuery({
  args: {
    slug: v.string(),
    index: v.number(),
    viewerUserId: v.union(v.id("users"), v.null()),
    asAdmin: v.boolean(),
  },
  returns: v.union(photoCursorValidator, v.null()),
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (
      !post ||
      post.status !== "published" ||
      post.visibility !== "listed" ||
      post.publishedAt === null ||
      !Number.isInteger(args.index) ||
      args.index < 0
    ) {
      return null;
    }
    if (!(await canViewPost(ctx, post, viewerFrom(args)))) return null;
    const photos = await postPhotos(ctx, post);
    if (args.index >= photos.length) return null;
    return {
      publishedAt: post.publishedAt,
      postId: post._id,
      skip: args.index,
    };
  },
});
