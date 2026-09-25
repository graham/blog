import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { imageViewCountValidator } from "../lib/validators";
import type { Infer } from "convex/values";
import type { PaginationResult } from "convex/server";

type ImageViewCount = Infer<typeof imageViewCountValidator>;

export const listByCount = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(imageViewCountValidator),
  handler: async (ctx, args): Promise<PaginationResult<ImageViewCount>> => {
    await requireAdmin(ctx);
    return await ctx.runQuery(internal.imageViews.internal.listByCount, args);
  },
});
