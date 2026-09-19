import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";

export const add = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
  },
  returns: v.id("channelMembers"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const membershipId: Id<"channelMembers"> = await ctx.runMutation(
      internal.channelMembers.internal.add,
      args,
    );
    return membershipId;
  },
});

export const addByEmail = mutation({
  args: {
    channelId: v.id("channels"),
    email: v.string(),
  },
  returns: v.id("channelMembers"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const email = args.email.trim();
    const user =
      (await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first()) ??
      (await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email.toLowerCase()))
        .first());
    if (!user) {
      throw new Error("No user with that email");
    }
    const membershipId: Id<"channelMembers"> = await ctx.runMutation(
      internal.channelMembers.internal.add,
      { channelId: args.channelId, userId: user._id },
    );
    return membershipId;
  },
});

export const remove = mutation({
  args: { membershipId: v.id("channelMembers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.channelMembers.internal.remove, args);
    return null;
  },
});
