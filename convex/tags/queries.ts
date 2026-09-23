import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import type { Id } from "../_generated/dataModel";
import { tagValidator } from "../lib/validators";

type Tag = Infer<typeof tagValidator>;
type Page<T> = {
  page: T[];
  continueCursor: string;
  isDone: boolean;
  splitCursor?: string | null;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
};

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(tagValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result: Page<Tag> = await ctx.runQuery(internal.tags.internal.list, args);
    return result;
  },
});

export const get = query({
  args: { tagId: v.id("tags") },
  returns: v.union(tagValidator, v.null()),
  handler: async (ctx, args): Promise<Tag | null> => {
    await requireAdmin(ctx);
    return await ctx.runQuery(internal.tags.internal.get, args);
  },
});

type TaggedPost = { _id: Id<"posts">; title: string; slug: string; status: string };

export const listPosts = query({
  args: { tagId: v.id("tags") },
  returns: v.array(
    v.object({
      _id: v.id("posts"),
      title: v.string(),
      slug: v.string(),
      status: v.string(),
    }),
  ),
  handler: async (ctx, args): Promise<TaggedPost[]> => {
    await requireAdmin(ctx);
    const result: TaggedPost[] = await ctx.runQuery(internal.tags.internal.listPosts, args);
    return result;
  },
});
