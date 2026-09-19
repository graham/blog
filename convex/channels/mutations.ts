import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("channels"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const channelId: Id<"channels"> = await ctx.runMutation(
      internal.channels.internal.create,
      args,
    );
    return channelId;
  },
});

export const rename = mutation({
  args: {
    channelId: v.id("channels"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.channels.internal.rename, args);
    return null;
  },
});

export const remove = mutation({
  args: { channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.channels.internal.remove, args);
    return null;
  },
});
