import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { userSummaryValidator } from "../lib/validators";
import type { Infer } from "convex/values";

type UserSummary = Infer<typeof userSummaryValidator>;
type Page<T> = {
  page: T[];
  continueCursor: string;
  isDone: boolean;
  splitCursor?: string | null;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
};

export const listForAdmin = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(userSummaryValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result: Page<UserSummary> = await ctx.runQuery(
      internal.users.internal.listForAdmin,
      args,
    );
    return result;
  },
});
