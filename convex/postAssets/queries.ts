import { v } from "convex/values";
import type { Infer } from "convex/values";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";
import { assetValidator } from "../lib/validators";

type Asset = Infer<typeof assetValidator>;

export const findByHash = query({
  args: {
    postId: v.id("posts"),
    sha256: v.string(),
  },
  returns: v.union(v.id("postAssets"), v.null()),
  handler: async (ctx, args): Promise<Id<"postAssets"> | null> => {
    await requireAdmin(ctx);
    const assetId: Id<"postAssets"> | null = await ctx.runQuery(
      internal.postAssets.internal.findByHash,
      args,
    );
    return assetId;
  },
});

export const listForPost = query({
  args: { postId: v.id("posts") },
  returns: v.array(assetValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const assets: Asset[] = await ctx.runQuery(
      internal.postAssets.internal.listForPost,
      args,
    );
    return assets;
  },
});
