import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import {
  adminPostDetailValidator,
  adminPostSummaryValidator,
  postDetailValidator,
} from "../lib/validators";
import type { Infer } from "convex/values";

type PostSummary = Infer<typeof adminPostSummaryValidator>;
type PostDetail = Infer<typeof adminPostDetailValidator>;
type PublicPostDetail = Infer<typeof postDetailValidator>;
type Page<T> = {
  page: T[];
  continueCursor: string;
  isDone: boolean;
  splitCursor?: string | null;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
};

export const listAll = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(adminPostSummaryValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result: Page<PostSummary> = await ctx.runQuery(
      internal.posts.internal.listAll,
      args,
    );
    return result;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(postDetailValidator, v.null()),
  handler: async (ctx, args): Promise<PublicPostDetail | null> => {
    await requireAdmin(ctx);
    return await ctx.runQuery(internal.posts.internal.getBySlugForAdmin, args);
  },
});

export const listDrafts = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(adminPostSummaryValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result: Page<PostSummary> = await ctx.runQuery(
      internal.posts.internal.listDrafts,
      args,
    );
    return result;
  },
});

export const getById = query({
  args: { postId: v.id("posts") },
  returns: v.union(adminPostDetailValidator, v.null()),
  handler: async (ctx, args): Promise<PostDetail | null> => {
    await requireAdmin(ctx);
    const result: PostDetail | null = await ctx.runQuery(
      internal.posts.internal.getById,
      args,
    );
    return result;
  },
});

export const searchAll = query({
  args: { query: v.string() },
  returns: v.array(adminPostSummaryValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result: PostSummary[] = await ctx.runQuery(
      internal.posts.internal.searchAll,
      args,
    );
    return result;
  },
});

export const countScheduled = query({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    await requireAdmin(ctx);
    return await ctx.runQuery(internal.posts.internal.countScheduled, {});
  },
});
