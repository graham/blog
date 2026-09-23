import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { assetValidator } from "../lib/validators";
import { normalizeContentHash, tryContentHash } from "../lib/sha256";
import { ALLOWED_ASSET_TYPES, isImageContentType } from "./contentTypes";

type Ctx = QueryCtx | MutationCtx;

export async function countPostImages(
  ctx: Ctx,
  postId: Id<"posts">,
  coverImageId: Id<"_storage"> | null,
): Promise<number> {
  const rows = await ctx.db
    .query("postAssets")
    .withIndex("by_postId", (q) => q.eq("postId", postId))
    .take(50);
  let imageCount = 0;
  let coverCounted = false;
  for (const row of rows) {
    if (!isImageContentType(row.contentType)) continue;
    imageCount += 1;
    if (coverImageId && row.storageId === coverImageId) {
      coverCounted = true;
    }
  }
  if (coverImageId && !coverCounted) {
    imageCount += 1;
  }
  return imageCount;
}

export async function loadPostAssets(ctx: Ctx, postId: Id<"posts">) {
  const rows = await ctx.db
    .query("postAssets")
    .withIndex("by_postId", (q) => q.eq("postId", postId))
    .take(50);
  const urls = await Promise.all(rows.map((row) => ctx.storage.getUrl(row.storageId)));
  return rows.map((row, index) => ({
    _id: row._id,
    storageId: row.storageId,
    filename: row.filename,
    contentType: row.contentType,
    alt: row.alt ?? "",
    description: row.description ?? "",
    url: urls[index] ?? null,
  }));
}

export const generateUploadUrl = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const findByHash = internalQuery({
  args: {
    postId: v.id("posts"),
    sha256: v.string(),
  },
  returns: v.union(v.id("postAssets"), v.null()),
  handler: async (ctx, args) => {
    const hash = normalizeContentHash(args.sha256);
    const existing = await ctx.db
      .query("postAssets")
      .withIndex("by_postId_and_sha256", (q) => q.eq("postId", args.postId).eq("sha256", hash))
      .first();
    return existing?._id ?? null;
  },
});

export async function saveHandler(
  ctx: MutationCtx,
  args: {
    postId: Id<"posts">;
    storageId: Id<"_storage">;
    filename: string;
    contentType: string;
    sha256: string;
  },
): Promise<Id<"postAssets">> {
  const post = await ctx.db.get("posts", args.postId);
  if (!post) {
    throw new Error("Post not found");
  }
  if (!ALLOWED_ASSET_TYPES.includes(args.contentType)) {
    throw new Error("Only image, video, and ZIP uploads are allowed");
  }
  const hash = normalizeContentHash(args.sha256);
  const byHash = await ctx.db
    .query("postAssets")
    .withIndex("by_postId_and_sha256", (q) => q.eq("postId", args.postId).eq("sha256", hash))
    .first();
  if (byHash) {
    if (byHash.storageId !== args.storageId) {
      await ctx.storage.delete(args.storageId);
    }
    return byHash._id;
  }
  const byStorage = await ctx.db
    .query("postAssets")
    .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
    .first();
  if (byStorage && byStorage.postId === args.postId) {
    if (byStorage.sha256 !== hash) {
      await ctx.db.patch("postAssets", byStorage._id, { sha256: hash });
    }
    return byStorage._id;
  }
  const existing = await ctx.db
    .query("postAssets")
    .withIndex("by_postId", (q) => q.eq("postId", args.postId))
    .take(51);
  if (existing.length >= 50) {
    throw new Error("Too many files on this post");
  }
  const filename = args.filename.slice(0, 200);
  const assetId = await ctx.db.insert("postAssets", {
    postId: args.postId,
    storageId: args.storageId,
    filename,
    contentType: args.contentType,
    alt: filename.replace(/\.[^.]+$/, ""),
    description: "",
    sha256: hash,
  });
  await ctx.db.patch("posts", args.postId, { updatedAt: Date.now() });
  return assetId;
}

export const save = internalMutation({
  args: {
    postId: v.id("posts"),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    sha256: v.string(),
  },
  returns: v.id("postAssets"),
  handler: saveHandler,
});

export const backfillSha256 = internalMutation({
  args: {},
  returns: v.object({
    updated: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("postAssets").take(100);
    let updated = 0;
    let skipped = 0;
    for (const row of rows) {
      if (row.sha256 && /^[0-9a-f]{64}$/.test(row.sha256)) {
        skipped += 1;
        continue;
      }
      const metadata = await ctx.db.system.get("_storage", row.storageId);
      const hash = tryContentHash(metadata?.sha256);
      if (!hash) {
        skipped += 1;
        continue;
      }
      await ctx.db.patch("postAssets", row._id, { sha256: hash });
      updated += 1;
    }
    return { updated, skipped };
  },
});

export const remove = internalMutation({
  args: { assetId: v.id("postAssets") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get("postAssets", args.assetId);
    if (!asset) {
      throw new Error("Asset not found");
    }
    const post = await ctx.db.get("posts", asset.postId);
    if (post && post.coverImageId === asset.storageId) {
      await ctx.db.patch("posts", post._id, {
        coverImageId: null,
        updatedAt: Date.now(),
      });
    }
    await ctx.storage.delete(asset.storageId);
    await ctx.db.delete("postAssets", asset._id);
    return null;
  },
});

export const updateText = internalMutation({
  args: {
    assetId: v.id("postAssets"),
    alt: v.string(),
    description: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get("postAssets", args.assetId);
    if (!asset) {
      throw new Error("Asset not found");
    }
    await ctx.db.patch("postAssets", asset._id, {
      alt: args.alt.slice(0, 200),
      description: args.description.slice(0, 500),
    });
    await ctx.db.patch("posts", asset.postId, { updatedAt: Date.now() });
    return null;
  },
});

export const listForPost = internalQuery({
  args: { postId: v.id("posts") },
  returns: v.array(assetValidator),
  handler: async (ctx, args) => {
    return await loadPostAssets(ctx, args.postId);
  },
});
