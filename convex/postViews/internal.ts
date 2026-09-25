import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { postViewCountValidator } from "../lib/validators";

type Ctx = QueryCtx | MutationCtx;

export async function postViewCount(ctx: Ctx, postId: Id<"posts">): Promise<number> {
  const row = await ctx.db
    .query("postViews")
    .withIndex("by_postId", (q) => q.eq("postId", postId))
    .unique();
  return row?.count ?? 0;
}

export async function deletePostViews(ctx: MutationCtx, postId: Id<"posts">): Promise<void> {
  const row = await ctx.db
    .query("postViews")
    .withIndex("by_postId", (q) => q.eq("postId", postId))
    .unique();
  if (row) await ctx.db.delete("postViews", row._id);
}

export const record = internalMutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("postViews")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .unique();
    if (row) {
      await ctx.db.patch("postViews", row._id, { count: row.count + 1 });
    } else {
      await ctx.db.insert("postViews", { postId: args.postId, count: 1 });
    }
    return null;
  },
});

export const getCount = internalQuery({
  args: { postId: v.id("posts") },
  returns: v.number(),
  handler: async (ctx, args) => {
    return await postViewCount(ctx, args.postId);
  },
});

export const listByCount = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(postViewCountValidator),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("postViews")
      .withIndex("by_count")
      .order("desc")
      .paginate(args.paginationOpts);
    const page = [];
    for (const row of result.page) {
      const post = await ctx.db.get("posts", row.postId);
      page.push({
        _id: row._id,
        postId: row.postId,
        title: post?.title ?? null,
        slug: post?.slug ?? null,
        status: post?.status ?? null,
        count: row.count,
      });
    }
    return { ...result, page };
  },
});
