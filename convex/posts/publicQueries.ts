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
} from "../lib/validators";
import { resolvePublicViewer } from "../lib/access";
import { stripDetailText, stripSummaryText } from "../lib/mediaOnly";
import { readSiteSettings } from "../siteSettings/internal";

type PostSummary = Infer<typeof postSummaryValidator>;
type PostDetail = Infer<typeof postDetailValidator>;
type PostNavigation = Infer<typeof postNavigationValidator>;
type CalendarPost = Infer<typeof calendarPostValidator>;
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
    if (!viewer.stripText) return result;
    return { ...result, page: result.page.map(stripSummaryText) };
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
    if (result === null || !viewer.stripText) return result;
    return stripDetailText(result);
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
    if (!viewer.stripText) return result;
    return {
      previous: result.previous ? { ...result.previous, title: "" } : null,
      next: result.next ? { ...result.next, title: "" } : null,
    };
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
    if (!settings.features.calendar) {
      return [];
    }
    const viewer = await resolvePublicViewer(ctx);
    if (viewer.blocked) {
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
    if (!viewer.stripText) return result;
    return result.map((post) => ({ ...post, title: "" }));
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
    if (!viewer.stripText) return result;
    return result.map(stripSummaryText);
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
    if (!viewer.stripText) return result;
    return { ...result, page: result.page.map(stripSummaryText) };
  },
});
