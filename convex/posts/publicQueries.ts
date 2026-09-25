import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  postDetailValidator,
  postNavigationValidator,
  postSummaryValidator,
  calendarPostValidator,
  photoCursorValidator,
  photoPageValidator,
} from "../lib/validators";
import { resolvePublicViewer } from "../lib/access";
import { readSiteSettings } from "../siteSettings/internal";
import { featureVisible } from "../lib/featureMode";

type PostSummary = Infer<typeof postSummaryValidator>;
type PostDetail = Infer<typeof postDetailValidator>;
type PostNavigation = Infer<typeof postNavigationValidator>;
type CalendarPost = Infer<typeof calendarPostValidator>;
type PhotoPage = Infer<typeof photoPageValidator>;
type PhotoCursor = Infer<typeof photoCursorValidator>;
type Page<T> = {
  page: T[];
  continueCursor: string;
  isDone: boolean;
  splitCursor?: string | null;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
};

function emptyPage<T>(cursor: string | null): Page<T> {
  return { page: [], continueCursor: cursor ?? "", isDone: true };
}

export const listPublished = query({
  args: {
    paginationOpts: paginationOptsValidator,
    unreadOnly: v.optional(v.boolean()),
  },
  returns: paginationResultValidator(postSummaryValidator),
  handler: async (ctx, args): Promise<Page<PostSummary>> => {
    const viewer = await resolvePublicViewer(ctx);
    if (viewer.blocked) {
      return emptyPage<PostSummary>(args.paginationOpts.cursor);
    }
    const result: Page<PostSummary> = await ctx.runQuery(internal.posts.internal.listPublished, {
      paginationOpts: args.paginationOpts,
      unreadOnly: args.unreadOnly,
      viewerUserId: viewer.viewerUserId,
      asAdmin: viewer.asAdmin,
    });
    return result;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(postDetailValidator, v.null()),
  handler: async (ctx, args): Promise<PostDetail | null> => {
    const viewer = await resolvePublicViewer(ctx);
    if (viewer.blocked) return null;
    const result: PostDetail | null = await ctx.runQuery(internal.posts.internal.getBySlug, {
      slug: args.slug,
      viewerUserId: viewer.viewerUserId,
      asAdmin: viewer.asAdmin,
    });
    return result;
  },
});

export const getAdjacentBySlug = query({
  args: { slug: v.string() },
  returns: postNavigationValidator,
  handler: async (ctx, args): Promise<PostNavigation> => {
    const viewer = await resolvePublicViewer(ctx);
    if (viewer.blocked) return { previous: null, next: null };
    const result: PostNavigation = await ctx.runQuery(internal.posts.internal.getAdjacentBySlug, {
      slug: args.slug,
      viewerUserId: viewer.viewerUserId,
      asAdmin: viewer.asAdmin,
    });
    return result;
  },
});

export const listPublishedBetween = query({
  args: {
    start: v.number(),
    end: v.number(),
  },
  returns: v.array(calendarPostValidator),
  handler: async (ctx, args) => {
    const settings = await readSiteSettings(ctx);
    const viewer = await resolvePublicViewer(ctx);
    if (viewer.blocked) {
      return [];
    }
    if (!featureVisible(settings.features.calendar, viewer.asAdmin)) {
      return [];
    }
    const result: CalendarPost[] = await ctx.runQuery(
      internal.posts.internal.listPublishedBetween,
      {
        start: args.start,
        end: args.end,
        viewerUserId: viewer.viewerUserId,
        asAdmin: viewer.asAdmin,
      },
    );
    return result;
  },
});

export const countPublishedDays = query({
  args: {
    days: v.array(v.object({ start: v.number(), end: v.number() })),
  },
  returns: v.array(v.number()),
  handler: async (ctx, args): Promise<number[]> => {
    const settings = await readSiteSettings(ctx);
    const viewer = await resolvePublicViewer(ctx);
    if (viewer.blocked) return [];
    if (!featureVisible(settings.features.calendar, viewer.asAdmin)) {
      return [];
    }
    const result: number[] = await ctx.runQuery(internal.posts.internal.countPublishedDays, {
      days: args.days,
    });
    return result;
  },
});

export const searchPublished = query({
  args: {
    query: v.string(),
    tag: v.union(v.string(), v.null()),
  },
  returns: v.array(postSummaryValidator),
  handler: async (ctx, args): Promise<PostSummary[]> => {
    const viewer = await resolvePublicViewer(ctx);
    if (viewer.blocked) return [];
    const result: PostSummary[] = await ctx.runQuery(internal.posts.internal.searchPublished, {
      ...args,
      viewerUserId: viewer.viewerUserId,
      asAdmin: viewer.asAdmin,
    });
    return result;
  },
});

export const listByTag = query({
  args: {
    tag: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(postSummaryValidator),
  handler: async (ctx, args): Promise<Page<PostSummary>> => {
    const viewer = await resolvePublicViewer(ctx);
    if (viewer.blocked) {
      return emptyPage<PostSummary>(args.paginationOpts.cursor);
    }
    const result: Page<PostSummary> = await ctx.runQuery(internal.posts.internal.listByTag, {
      ...args,
      viewerUserId: viewer.viewerUserId,
      asAdmin: viewer.asAdmin,
    });
    return result;
  },
});

export const listPhotos = query({
  args: { cursor: v.union(photoCursorValidator, v.null()) },
  returns: photoPageValidator,
  handler: async (ctx, args): Promise<PhotoPage> => {
    const viewer = await resolvePublicViewer(ctx);
    if (viewer.blocked) return { photos: [], nextCursor: null };
    const settings = await readSiteSettings(ctx);
    if (!featureVisible(settings.features.photos, viewer.asAdmin)) {
      return { photos: [], nextCursor: null };
    }
    const result: PhotoPage = await ctx.runQuery(internal.posts.internal.listPhotos, {
      cursor: args.cursor,
      viewerUserId: viewer.viewerUserId,
      asAdmin: viewer.asAdmin,
    });
    return result;
  },
});

export const photoAnchor = query({
  args: { slug: v.string(), index: v.number() },
  returns: v.union(photoCursorValidator, v.null()),
  handler: async (ctx, args): Promise<PhotoCursor | null> => {
    const viewer = await resolvePublicViewer(ctx);
    if (viewer.blocked) return null;
    const settings = await readSiteSettings(ctx);
    if (!featureVisible(settings.features.photos, viewer.asAdmin)) return null;
    const result: PhotoCursor | null = await ctx.runQuery(internal.posts.internal.photoAnchor, {
      slug: args.slug,
      index: args.index,
      viewerUserId: viewer.viewerUserId,
      asAdmin: viewer.asAdmin,
    });
    return result;
  },
});
