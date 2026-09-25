import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { postViewCountValidator } from "../lib/validators";
import type { Infer } from "convex/values";
import type { PaginationResult } from "convex/server";

type PostViewCount = Infer<typeof postViewCountValidator>;

export const listByCount = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(postViewCountValidator),
  handler: async (ctx, args): Promise<PaginationResult<PostViewCount>> => {
    await requireAdmin(ctx);
    return await ctx.runQuery(internal.postViews.internal.listByCount, args);
  },
});
