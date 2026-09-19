import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { channelValidator } from "../lib/validators";

type Channel = Infer<typeof channelValidator>;
type Page<T> = {
  page: T[];
  continueCursor: string;
  isDone: boolean;
  splitCursor?: string | null;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
};

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(channelValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result: Page<Channel> = await ctx.runQuery(
      internal.channels.internal.list,
      args,
    );
    return result;
  },
});

export const listAll = query({
  args: {},
  returns: v.array(channelValidator),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const result: Channel[] = await ctx.runQuery(
      internal.channels.internal.listAll,
      {},
    );
    return result;
  },
});

export const get = query({
  args: { channelId: v.id("channels") },
  returns: v.union(channelValidator, v.null()),
  handler: async (ctx, args): Promise<Channel | null> => {
    await requireAdmin(ctx);
    const result: Channel | null = await ctx.runQuery(
      internal.channels.internal.get,
      args,
    );
    return result;
  },
});
