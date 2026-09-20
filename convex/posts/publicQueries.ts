import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  postDetailValidator,
  postNavigationValidator,
  postSummaryValidator,
  timingPostValidator,
} from "../lib/validators";
import { resolvePublicViewer } from "../lib/access";
import { readSiteSettings } from "../siteSettings/internal";

type PostSummary = Infer<typeof postSummaryValidator>;
type PostDetail = Infer<typeof postDetailValidator>;
type PostNavigation = Infer<typeof postNavigationValidator>;
type TimingPost = Infer<typeof timingPostValidator>;
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
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(postSummaryValidator),
  handler: async (ctx, args) => {
    const viewer = await resolvePublicViewer(ctx);
    if (viewer.blocked) {
      return emptyPage<PostSummary>(args.paginationOpts.cursor);
    }
    const result: Page<PostSummary> = await ctx.runQuery(internal.posts.internal.listPublished, {
      ...args,
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
    return await ctx.runQuery(internal.posts.internal.getAdjacentBySlug, {
      slug: args.slug,
      viewerUserId: viewer.viewerUserId,
      asAdmin: viewer.asAdmin,
    });
  },
});

export const listPublishedBetween = query({
  args: {
    start: v.number(),
    end: v.number(),
  },
  returns: v.array(timingPostValidator),
  handler: async (ctx, args) => {
    const settings = await readSiteSettings(ctx);
    if (!settings.features.timings.timingsPage) {
      return [];
    }
    const viewer = await resolvePublicViewer(ctx);
    if (viewer.blocked) {
      return [];
    }
    const result: TimingPost[] = await ctx.runQuery(
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

export const searchPublished = query({
  args: {
    query: v.string(),
    tag: v.union(v.string(), v.null()),
  },
  returns: v.array(postSummaryValidator),
  handler: async (ctx, args) => {
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
  handler: async (ctx, args) => {
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
