import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireMember } from "../lib/auth";

export const updateProfile = mutation({
  args: { name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireMember(ctx);
    await ctx.runMutation(internal.users.account.updateProfile, {
      userId: user._id,
      name: args.name,
    });
    return null;
  },
});

export const changePassword = mutation({
  args: { currentPassword: v.string(), newPassword: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireMember(ctx);
    await ctx.runMutation(internal.users.account.changePassword, {
      userId: user._id,
      currentPassword: args.currentPassword,
      newPassword: args.newPassword,
    });
    return null;
  },
});

export const addPassword = mutation({
  args: { password: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireMember(ctx);
    await ctx.runMutation(internal.users.account.addPassword, {
      userId: user._id,
      password: args.password,
    });
    return null;
  },
});

export const unlinkGoogle = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireMember(ctx);
    await ctx.runMutation(internal.users.account.unlinkGoogle, {
      userId: user._id,
    });
    return null;
  },
});
