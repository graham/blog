import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { aiWorkpool } from "../lib/workpool";
import { aiJobValidator } from "../lib/validators";
import type { Infer } from "convex/values";

type AiJob = Infer<typeof aiJobValidator>;

export const request = mutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.postAi.internal.start, args);
    await aiWorkpool.enqueueAction(
      ctx,
      internal.posts.actions.generate,
      { postId: args.postId },
    );
    return null;
  },
});

export const applyTitle = mutation({
  args: {
    postId: v.id("posts"),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.postAi.internal.applyTitle, args);
    return null;
  },
});

export const applySummary = mutation({
  args: {
    postId: v.id("posts"),
    asExcerpt: v.boolean(),
  },
  returns: aiJobValidator,
  handler: async (ctx, args): Promise<AiJob> => {
    await requireAdmin(ctx);
    const result: AiJob = await ctx.runMutation(
      internal.postAi.internal.applySummary,
      args,
    );
    return result;
  },
});
