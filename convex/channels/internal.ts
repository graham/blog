import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { channelValidator } from "../lib/validators";
import { slugify } from "../lib/text";
import { MAX_CHANNELS } from "../lib/access";

async function uniqueSlug(
  ctx: MutationCtx,
  name: string,
  excludeId: Id<"channels"> | null,
): Promise<string> {
  const base = slugify(name);
  for (let n = 0; n < 50; n += 1) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const existing = await ctx.db
      .query("channels")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();
    if (!existing || (excludeId !== null && existing._id === excludeId)) {
      return candidate;
    }
  }
  throw new Error("Could not generate a unique channel slug");
}

export const create = internalMutation({
  args: { name: v.string() },
  returns: v.id("channels"),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (name.length === 0) {
      throw new Error("Channel name is required");
    }
    const slug = await uniqueSlug(ctx, name, null);
    return await ctx.db.insert("channels", { name: name.slice(0, 80), slug });
  },
});

export const rename = internalMutation({
  args: {
    channelId: v.id("channels"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const channel = await ctx.db.get("channels", args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }
    const name = args.name.trim();
    if (name.length === 0) {
      throw new Error("Channel name is required");
    }
    const slug = await uniqueSlug(ctx, name, channel._id);
    await ctx.db.patch("channels", channel._id, {
      name: name.slice(0, 80),
      slug,
    });
    return null;
  },
});

export const remove = internalMutation({
  args: { channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const channel = await ctx.db.get("channels", args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }
    for (let i = 0; i < 20; i += 1) {
      const members = await ctx.db
        .query("channelMembers")
        .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
        .take(20);
      if (members.length === 0) break;
      for (const row of members) {
        await ctx.db.delete("channelMembers", row._id);
      }
    }
    for (let i = 0; i < 20; i += 1) {
      const posts = await ctx.db
        .query("channelPosts")
        .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
        .take(20);
      if (posts.length === 0) break;
      for (const row of posts) {
        await ctx.db.delete("channelPosts", row._id);
      }
    }
    await ctx.db.delete("channels", channel._id);
    return null;
  },
});

export const list = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(channelValidator),
  handler: async (ctx, args) => {
    return await ctx.db.query("channels").order("desc").paginate(args.paginationOpts);
  },
});

export const listAll = internalQuery({
  args: {},
  returns: v.array(channelValidator),
  handler: async (ctx) => {
    const rows = await ctx.db.query("channels").order("desc").take(MAX_CHANNELS);
    return rows;
  },
});

export const get = internalQuery({
  args: { channelId: v.id("channels") },
  returns: v.union(channelValidator, v.null()),
  handler: async (ctx, args) => {
    const channel = await ctx.db.get("channels", args.channelId);
    if (!channel) return null;
    return channel;
  },
});
