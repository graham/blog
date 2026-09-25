import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { imageViewCountValidator } from "../lib/validators";

const DELETE_BATCH = 64;

export async function deleteImageViews(ctx: MutationCtx, postId: Id<"posts">): Promise<void> {
  for (;;) {
    const rows = await ctx.db
      .query("imageViews")
      .withIndex("by_postId_and_src", (q) => q.eq("postId", postId))
      .take(DELETE_BATCH);
    if (rows.length === 0) break;
    for (const row of rows) {
      await ctx.db.delete("imageViews", row._id);
    }
  }
}

export const record = internalMutation({
  args: { postId: v.id("posts"), src: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("imageViews")
      .withIndex("by_postId_and_src", (q) => q.eq("postId", args.postId).eq("src", args.src))
      .unique();
    if (row) {
      await ctx.db.patch("imageViews", row._id, { count: row.count + 1 });
    } else {
      await ctx.db.insert("imageViews", { postId: args.postId, src: args.src, count: 1 });
    }
    return null;
  },
});

export const getCount = internalQuery({
  args: { postId: v.id("posts"), src: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("imageViews")
      .withIndex("by_postId_and_src", (q) => q.eq("postId", args.postId).eq("src", args.src))
      .unique();
    return row?.count ?? 0;
  },
});

export const listByCount = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(imageViewCountValidator),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("imageViews")
      .withIndex("by_count")
      .order("desc")
      .paginate(args.paginationOpts);
    const page = [];
    for (const row of result.page) {
      const post = await ctx.db.get("posts", row.postId);
      page.push({
        _id: row._id,
        postId: row.postId,
        src: row.src,
        title: post?.title ?? null,
        slug: post?.slug ?? null,
        count: row.count,
      });
    }
    return { ...result, page };
  },
});
