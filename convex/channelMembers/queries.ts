import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { channelMemberValidator } from "../lib/validators";

type Member = Infer<typeof channelMemberValidator>;
type Page<T> = {
  page: T[];
  continueCursor: string;
  isDone: boolean;
  splitCursor?: string | null;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
};

export const listByChannel = query({
  args: {
    channelId: v.id("channels"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(channelMemberValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result: Page<Member> = await ctx.runQuery(
      internal.channelMembers.internal.listByChannel,
      args,
    );
    return result;
  },
});
