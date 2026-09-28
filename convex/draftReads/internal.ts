import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { postReadStateValidator } from "../lib/validators";
import { resolveReadState } from "../postReads/internal";
import type { Infer } from "convex/values";

type Ctx = QueryCtx | MutationCtx;
type ReadState = Infer<typeof postReadStateValidator>;

export async function getDraftReadBefore(ctx: Ctx, userId: Id<"users">): Promise<number> {
  const row = await ctx.db
    .query("draftReadCursors")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  return row?.readBefore ?? 0;
}

export async function readStateForDraft(
  ctx: Ctx,
  userId: Id<"users">,
  postId: Id<"posts">,
  updatedAt: number,
  readBefore: number,
): Promise<ReadState> {
  const receipt = await ctx.db
    .query("draftReads")
    .withIndex("by_userId_and_postId", (q) => q.eq("userId", userId).eq("postId", postId))
    .first();
  return resolveReadState(receipt?.lastReadAt ?? null, updatedAt, readBefore);
}

export const markRead = internalMutation({
  args: { userId: v.id("users"), postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("posts", args.postId);
    if (!post) throw new Error("Post not found");
    const readBefore = await getDraftReadBefore(ctx, args.userId);
    const existing = await ctx.db
      .query("draftReads")
      .withIndex("by_userId_and_postId", (q) =>
        q.eq("userId", args.userId).eq("postId", args.postId),
      )
      .first();
    const now = Date.now();
    if (post.updatedAt <= readBefore && !existing) {
      return null;
    }
    if (existing) {
      await ctx.db.patch("draftReads", existing._id, { lastReadAt: now });
    } else {
      await ctx.db.insert("draftReads", {
        userId: args.userId,
        postId: args.postId,
        lastReadAt: now,
      });
    }
    return null;
  },
});

export const markAllRead = internalMutation({
  args: { userId: v.id("users") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const cursor = await ctx.db
      .query("draftReadCursors")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (cursor) {
      await ctx.db.patch("draftReadCursors", cursor._id, { readBefore: now, updatedAt: now });
    } else {
      await ctx.db.insert("draftReadCursors", {
        userId: args.userId,
        readBefore: now,
        updatedAt: now,
      });
    }
    let deleted = 0;
    for (let i = 0; i < 25; i += 1) {
      const rows = await ctx.db
        .query("draftReads")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(20);
      if (rows.length === 0) break;
      for (const row of rows) {
        await ctx.db.delete("draftReads", row._id);
        deleted += 1;
      }
    }
    return deleted;
  },
});

export async function deleteDraftReads(
  ctx: MutationCtx,
  postId: Id<"posts">,
): Promise<void> {
  for (;;) {
    const rows = await ctx.db
      .query("draftReads")
      .withIndex("by_postId", (q) => q.eq("postId", postId))
      .take(32);
    if (rows.length === 0) break;
    for (const row of rows) {
      await ctx.db.delete("draftReads", row._id);
    }
  }
}
