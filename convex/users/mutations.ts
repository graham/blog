import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { userSummaryValidator } from "../lib/validators";
import type { Infer } from "convex/values";

type UserSummary = Infer<typeof userSummaryValidator>;

export const create = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    userType: v.union(v.literal("user"), v.literal("admin")),
  },
  returns: userSummaryValidator,
  handler: async (ctx, args): Promise<UserSummary> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.users.internal.insertUser, args);
  },
});

export const setDisabled = mutation({
  args: { userId: v.id("users"), disabled: v.boolean() },
  returns: userSummaryValidator,
  handler: async (ctx, args): Promise<UserSummary> => {
    const admin = await requireAdmin(ctx);
    return await ctx.runMutation(internal.users.internal.setDisabled, {
      ...args,
      actorId: admin._id,
    });
  },
});

export const setUserType = mutation({
  args: {
    userId: v.id("users"),
    userType: v.union(v.literal("user"), v.literal("admin")),
  },
  returns: userSummaryValidator,
  handler: async (ctx, args): Promise<UserSummary> => {
    const admin = await requireAdmin(ctx);
    return await ctx.runMutation(internal.users.internal.setUserType, {
      ...args,
      actorId: admin._id,
    });
  },
});
