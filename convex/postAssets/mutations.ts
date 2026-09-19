import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const url: string = await ctx.runMutation(
      internal.postAssets.internal.generateUploadUrl,
      {},
    );
    return url;
  },
});

export const save = mutation({
  args: {
    postId: v.id("posts"),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    sha256: v.string(),
  },
  returns: v.id("postAssets"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const assetId: Id<"postAssets"> = await ctx.runMutation(
      internal.postAssets.internal.save,
      args,
    );
    return assetId;
  },
});

export const remove = mutation({
  args: { assetId: v.id("postAssets") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.postAssets.internal.remove, args);
    return null;
  },
});

export const updateText = mutation({
  args: {
    assetId: v.id("postAssets"),
    alt: v.string(),
    description: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.runMutation(internal.postAssets.internal.updateText, args);
    return null;
  },
});
