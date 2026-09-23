import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { createdAtOf } from "./posts/internal";

const MIGRATION = "posts.createdAt";
const PAGE_SIZE = 50;

export const backfillPostsCreatedAt = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("migrationState")
      .withIndex("by_name", (q) => q.eq("name", MIGRATION))
      .unique();
    if (state?.done) return null;

    const page = await ctx.db.query("posts").paginate({
      numItems: PAGE_SIZE,
      cursor: args.cursor,
    });
    for (const post of page.page) {
      const createdAt = createdAtOf(post);
      if (post.createdAt !== createdAt) {
        await ctx.db.patch("posts", post._id, { createdAt });
      }
      const links = await ctx.db
        .query("postTags")
        .withIndex("by_postId", (q) => q.eq("postId", post._id))
        .take(32);
      for (const row of links) {
        if (row.postCreatedAt !== createdAt || row.postUpdatedAt !== post.updatedAt) {
          await ctx.db.patch("postTags", row._id, {
            postCreatedAt: createdAt,
            postUpdatedAt: post.updatedAt,
          });
        }
      }
    }

    if (page.isDone) {
      if (state) {
        await ctx.db.patch("migrationState", state._id, { done: true });
      } else {
        await ctx.db.insert("migrationState", { name: MIGRATION, done: true });
      }
      return null;
    }

    await ctx.scheduler.runAfter(0, internal.migrations.backfillPostsCreatedAt, {
      cursor: page.continueCursor,
    });
    return null;
  },
});
