import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("bookmarkGroups"),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const groupId: Id<"bookmarkGroups"> = await ctx.runMutation(
      internal.bookmarkGroups.internal.create,
      { name: args.name, createdBy: admin._id },
    );
    return groupId;
  },
});

export const rename = mutation({
  args: {
    groupId: v.id("bookmarkGroups"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.bookmarkGroups.internal.rename, args);
    return null;
  },
});

export const remove = mutation({
  args: { groupId: v.id("bookmarkGroups") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.bookmarkGroups.internal.remove, args);
    return null;
  },
});
