import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { channelMemberValidator } from "../lib/validators";
import { MAX_CHANNELS } from "../lib/access";

export const add = internalMutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
  },
  returns: v.id("channelMembers"),
  handler: async (ctx, args) => {
    const channel = await ctx.db.get("channels", args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }
    const user = await ctx.db.get("users", args.userId);
    if (!user) {
      throw new Error("User not found");
    }
    const existing = await ctx.db
      .query("channelMembers")
      .withIndex("by_channelId_and_userId", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId),
      )
      .first();
    if (existing) {
      return existing._id;
    }
    const already = await ctx.db
      .query("channelMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(MAX_CHANNELS);
    if (already.length >= MAX_CHANNELS) {
      throw new Error("User is in too many channels");
    }
    return await ctx.db.insert("channelMembers", {
      channelId: args.channelId,
      userId: args.userId,
    });
  },
});

export const remove = internalMutation({
  args: { membershipId: v.id("channelMembers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("channelMembers", args.membershipId);
    if (!row) {
      throw new Error("Membership not found");
    }
    await ctx.db.delete("channelMembers", row._id);
    return null;
  },
});

export const listByChannel = internalQuery({
  args: {
    channelId: v.id("channels"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(channelMemberValidator),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("channelMembers")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .paginate(args.paginationOpts);
    const page = [];
    for (const row of result.page) {
      const user = await ctx.db.get("users", row.userId);
      page.push({
        _id: row._id,
        userId: row.userId,
        name: user?.name ?? null,
        email: user?.email ?? null,
      });
    }
    return { ...result, page };
  },
});
