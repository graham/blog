import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { adminPostSummaryValidator } from "../lib/validators";

const assignedPostValidator = v.object({
  ...adminPostSummaryValidator.fields,
  linkId: v.id("channelPosts"),
});

type AssignedPost = Infer<typeof assignedPostValidator>;
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
  returns: paginationResultValidator(assignedPostValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result: Page<AssignedPost> = await ctx.runQuery(
      internal.channelPosts.internal.listByChannel,
      args,
    );
    return result;
  },
});
