import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { isListedPublished, publishedByDay, syncPublishedByDay } from "./posts/aggregate";

const PAGE_SIZE = 50;

const PUBLISHED_BY_DAY = "posts.publishedByDay";

export const backfillPublishedByDay = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("migrationState")
      .withIndex("by_name", (q) => q.eq("name", PUBLISHED_BY_DAY))
      .unique();
    if (state?.done) return null;

    const page = await ctx.db.query("posts").paginate({
      numItems: PAGE_SIZE,
      cursor: args.cursor,
    });
    for (const post of page.page) {
      if (isListedPublished(post)) {
        await publishedByDay.insertIfDoesNotExist(ctx, post);
      } else {
        await publishedByDay.deleteIfExists(ctx, post);
      }
    }

    if (page.isDone) {
      if (state) {
        await ctx.db.patch("migrationState", state._id, { done: true });
      } else {
        await ctx.db.insert("migrationState", { name: PUBLISHED_BY_DAY, done: true });
      }
      return null;
    }

    await ctx.scheduler.runAfter(0, internal.migrations.backfillPublishedByDay, {
      cursor: page.continueCursor,
    });
    return null;
  },
});

const PUBLISHED_AT_FROM_CREATED_AT = "posts.publishedAtFromCreatedAt";

// Aligns publishedAt with the editable createdAt for every published post.
// Posts whose createdAt is in the future are left alone: moving their
// publishedAt forward would turn a live post into a hidden scheduled one.
export const backfillPublishedAtFromCreatedAt = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("migrationState")
      .withIndex("by_name", (q) => q.eq("name", PUBLISHED_AT_FROM_CREATED_AT))
      .unique();
    if (state?.done) return null;

    const now = Date.now();
    const page = await ctx.db
      .query("posts")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .paginate({ numItems: PAGE_SIZE, cursor: args.cursor });
    let updated = 0;
    for (const post of page.page) {
      const createdAt = post.createdAt;
      if (createdAt > now) {
        console.warn("Skipping published post with a future createdAt", post._id, post.slug);
        continue;
      }
      if (post.publishedAt === createdAt) continue;
      await ctx.db.patch("posts", post._id, { publishedAt: createdAt });
      const saved = await ctx.db.get("posts", post._id);
      await syncPublishedByDay(ctx, post, saved);
      updated += 1;
    }
    console.log(
      `publishedAt backfill: updated ${updated} of ${page.page.length} published posts in this batch`,
    );

    if (page.isDone) {
      if (state) {
        await ctx.db.patch("migrationState", state._id, { done: true });
      } else {
        await ctx.db.insert("migrationState", { name: PUBLISHED_AT_FROM_CREATED_AT, done: true });
      }
      return null;
    }

    await ctx.scheduler.runAfter(0, internal.migrations.backfillPublishedAtFromCreatedAt, {
      cursor: page.continueCursor,
    });
    return null;
  },
});
