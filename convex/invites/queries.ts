import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { inviteValidator } from "../lib/validators";
import type { Infer } from "convex/values";

type Invite = Infer<typeof inviteValidator>;
type Page<T> = {
  page: T[];
  continueCursor: string;
  isDone: boolean;
  splitCursor?: string | null;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
};

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(inviteValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result: Page<Invite> = await ctx.runQuery(
      internal.invites.internal.list,
      args,
    );
    return result;
  },
});
