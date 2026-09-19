import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { bookmarkGroupValidator } from "../lib/validators";

type Group = Infer<typeof bookmarkGroupValidator>;
type Page<T> = {
  page: T[];
  continueCursor: string;
  isDone: boolean;
  splitCursor?: string | null;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
};

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(bookmarkGroupValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result: Page<Group> = await ctx.runQuery(
      internal.bookmarkGroups.internal.list,
      args,
    );
    return result;
  },
});

export const listAll = query({
  args: {},
  returns: v.array(bookmarkGroupValidator),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const result: Group[] = await ctx.runQuery(
      internal.bookmarkGroups.internal.listAll,
      {},
    );
    return result;
  },
});

export const get = query({
  args: { groupId: v.id("bookmarkGroups") },
  returns: v.union(bookmarkGroupValidator, v.null()),
  handler: async (ctx, args): Promise<Group | null> => {
    await requireAdmin(ctx);
    const result: Group | null = await ctx.runQuery(
      internal.bookmarkGroups.internal.get,
      args,
    );
    return result;
  },
});
