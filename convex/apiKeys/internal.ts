import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { loadPostAssets, saveHandler as saveAssetHandler } from "../postAssets/internal";
import {
  createHandler as createPostHandler,
  saveHandler as savePostHandler,
  setPublishedHandler,
} from "../posts/internal";
import { apiKeyFromToken } from "./auth";
import { writeAgentStatus } from "../apiKeyAgentStatuses/internal";
import { agentStateValidator, agentStatusValidator } from "../apiKeyAgentStatuses/validators";
import { readSiteSettings } from "../siteSettings/internal";
import { apiPostInputValidator } from "./validators";
import { statusValidator } from "../lib/validators";
import {
  ALLOWED_ASSET_TYPES,
  MAX_ASSET_BYTES,
  contentTypeFromFilename,
  isImageContentType,
} from "../postAssets/contentTypes";

async function requireApiKey(ctx: QueryCtx | MutationCtx, token: string) {
  const key = await apiKeyFromToken(ctx, token);
  if (!key) throw new Error("Unauthorized");
  const creator = await ctx.db.get("users", key.createdBy);
  if (!creator || creator.userType !== "admin") throw new Error("Unauthorized");
  return key;
}

async function tagsForPost(ctx: QueryCtx | MutationCtx, postId: Id<"posts">): Promise<string[]> {
  const tags = await ctx.db
    .query("postTags")
    .withIndex("by_postId", (query) => query.eq("postId", postId))
    .take(16);
  return tags.map((tag) => tag.tag);
}

async function apiPost(ctx: QueryCtx | MutationCtx, post: Doc<"posts">) {
  return {
    id: post._id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    body: post.body,
    status: post.status,
    visibility: post.visibility,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    coverImageId: post.coverImageId,
    tags: await tagsForPost(ctx, post._id),
    assets: await loadPostAssets(ctx, post._id),
  };
}

const apiAssetValidator = v.object({
  id: v.id("postAssets"),
  storageId: v.id("_storage"),
  filename: v.string(),
  contentType: v.string(),
  alt: v.string(),
  description: v.string(),
  url: v.union(v.string(), v.null()),
  markdown: v.string(),
});

const apiPostValidator = v.object({
  id: v.id("posts"),
  title: v.string(),
  slug: v.string(),
  excerpt: v.string(),
  body: v.string(),
  status: statusValidator,
  visibility: v.union(v.literal("listed"), v.literal("unlisted")),
  publishedAt: v.union(v.number(), v.null()),
  updatedAt: v.number(),
  coverImageId: v.union(v.id("_storage"), v.null()),
  tags: v.array(v.string()),
  assets: v.array(
    v.object({
      _id: v.id("postAssets"),
      storageId: v.id("_storage"),
      filename: v.string(),
      contentType: v.string(),
      alt: v.string(),
      description: v.string(),
      url: v.union(v.string(), v.null()),
    }),
  ),
});

export const authenticate = internalQuery({
  args: { token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    try {
      await requireApiKey(ctx, args.token);
      return true;
    } catch {
      return false;
    }
  },
});

export const setAgentStatus = internalMutation({
  args: {
    token: v.string(),
    state: agentStateValidator,
    status: v.string(),
    question: v.union(v.string(), v.null()),
  },
  returns: v.union(
    v.object({ ok: v.literal(true), agentStatus: agentStatusValidator }),
    v.object({ ok: v.literal(false), retryAfterMs: v.number() }),
  ),
  handler: async (ctx, args) => {
    const key = await requireApiKey(ctx, args.token);
    const result = await writeAgentStatus(ctx, {
      apiKeyId: key._id,
      state: args.state,
      status: args.status,
      question: args.question,
    });
    if (!result.ok) return result;
    const { ok, ...agentStatus } = result;
    return { ok, agentStatus };
  },
});

export const prepareAssetUpload = internalMutation({
  args: { token: v.string(), postId: v.id("posts") },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireApiKey(ctx, args.token);
    const post = await ctx.db.get("posts", args.postId);
    if (!post) throw new Error("Post not found");
    return await ctx.storage.generateUploadUrl();
  },
});

export const listPosts = internalQuery({
  args: { token: v.string(), limit: v.number() },
  returns: v.array(
    v.object({
      id: v.id("posts"),
      title: v.string(),
      slug: v.string(),
      status: statusValidator,
      visibility: v.union(v.literal("listed"), v.literal("unlisted")),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireApiKey(ctx, args.token);
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit)));
    const sort = (await readSiteSettings(ctx)).features.sortOrder;
    const posts =
      sort === "updated"
        ? await ctx.db.query("posts").withIndex("by_updatedAt").order("desc").take(limit)
        : await ctx.db.query("posts").order("desc").take(limit);
    return posts.map((post) => ({
      id: post._id,
      title: post.title,
      slug: post.slug,
      status: post.status,
      visibility: post.visibility,
      updatedAt: post.updatedAt,
    }));
  },
});

export const getPost = internalQuery({
  args: { token: v.string(), postId: v.id("posts") },
  returns: v.union(apiPostValidator, v.null()),
  handler: async (ctx, args) => {
    await requireApiKey(ctx, args.token);
    const post = await ctx.db.get("posts", args.postId);
    return post ? await apiPost(ctx, post) : null;
  },
});

export const createPost = internalMutation({
  args: { token: v.string(), input: apiPostInputValidator },
  returns: v.object({ id: v.id("posts"), slug: v.string(), status: v.string() }),
  handler: async (ctx, args) => {
    const key = await requireApiKey(ctx, args.token);
    const postId = await createPostHandler(ctx, { authorId: key.createdBy });
    const input = args.input;
    const saved = await savePostHandler(ctx, {
      postId,
      title: input.title ?? "",
      slug: input.slug,
      excerpt: input.excerpt ?? "",
      body: input.body ?? "",
      visibility: input.visibility ?? "listed",
      tags: input.tags ?? [],
      coverImageId: input.coverImageId,
    });
    if (input.published === true) {
      await setPublishedHandler(ctx, { postId, published: true });
    }
    await ctx.runMutation(internal.notifications.internal.enqueuePostChange, {
      kind: "created",
      postId,
    });
    const created = await ctx.db.get("posts", postId);
    if (!created) throw new Error("Post not found");
    return { id: postId, slug: saved.slug, status: created.status };
  },
});

export const updatePost = internalMutation({
  args: {
    token: v.string(),
    postId: v.id("posts"),
    input: apiPostInputValidator,
  },
  returns: v.object({ id: v.id("posts"), slug: v.string(), status: v.string() }),
  handler: async (ctx, args) => {
    await requireApiKey(ctx, args.token);
    const post = await ctx.db.get("posts", args.postId);
    if (!post) throw new Error("Post not found");
    const input = args.input;
    const saved = await savePostHandler(ctx, {
      postId: post._id,
      title: input.title ?? post.title,
      slug: input.slug === undefined ? post.slug : input.slug,
      excerpt: input.excerpt ?? post.excerpt,
      body: input.body ?? post.body,
      visibility: input.visibility ?? post.visibility,
      tags: input.tags ?? (await tagsForPost(ctx, post._id)),
      coverImageId: input.coverImageId,
    });
    if (input.published !== undefined) {
      await setPublishedHandler(ctx, {
        postId: post._id,
        published: input.published,
      });
    }
    await ctx.runMutation(internal.notifications.internal.enqueuePostChange, {
      kind: "updated",
      postId: post._id,
    });
    const updated = await ctx.db.get("posts", post._id);
    if (!updated) throw new Error("Post not found");
    return { id: post._id, slug: saved.slug, status: updated.status };
  },
});

type ResolvedAttachAssetArgs = {
  postId: Id<"posts">;
  storageId: Id<"_storage">;
  filename: string;
  contentType: string;
  sha256: string;
  alt: string;
  description: string;
  cover: boolean;
};

async function attachAssetHandler(ctx: MutationCtx, args: ResolvedAttachAssetArgs) {
  if (args.cover && !isImageContentType(args.contentType)) {
    throw new Error("Only an image can be a post cover");
  }
  const assetId = await saveAssetHandler(ctx, args);
  await ctx.db.patch("postAssets", assetId, {
    alt: args.alt.slice(0, 200),
    description: args.description.slice(0, 500),
  });
  const asset = await ctx.db.get("postAssets", assetId);
  if (!asset) throw new Error("Asset not found");
  if (args.cover) {
    await ctx.db.patch("posts", args.postId, {
      coverImageId: asset.storageId,
      updatedAt: Date.now(),
    });
  }
  const url = await ctx.storage.getUrl(asset.storageId);
  const safeLabel = (args.alt || asset.filename).replace(/[\[\]]/g, "").trim();
  const markdown =
    isImageContentType(asset.contentType) || asset.contentType.startsWith("video/")
      ? `![${safeLabel}](convex://${asset.storageId})`
      : `[Download ${safeLabel}](convex://${asset.storageId})`;
  return {
    id: assetId,
    storageId: asset.storageId,
    filename: asset.filename,
    contentType: asset.contentType,
    alt: args.alt.slice(0, 200),
    description: args.description.slice(0, 500),
    url,
    markdown,
  };
}

export const attachAsset = internalMutation({
  args: {
    token: v.string(),
    postId: v.id("posts"),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    sha256: v.string(),
    alt: v.string(),
    description: v.string(),
    cover: v.boolean(),
  },
  returns: apiAssetValidator,
  handler: async (ctx, args) => {
    await requireApiKey(ctx, args.token);
    return await attachAssetHandler(ctx, args);
  },
});

export const attachUploadedAsset = internalMutation({
  args: {
    token: v.string(),
    postId: v.id("posts"),
    storageId: v.id("_storage"),
    filename: v.string(),
    alt: v.string(),
    description: v.string(),
    cover: v.boolean(),
  },
  returns: apiAssetValidator,
  handler: async (ctx, args) => {
    await requireApiKey(ctx, args.token);
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (!metadata) throw new Error("Uploaded file not found");
    if (metadata.size === 0) throw new Error("Upload is empty");
    if (metadata.size > MAX_ASSET_BYTES) {
      throw new Error("Upload exceeds 250 MiB");
    }
    const storedContentType = metadata.contentType?.split(";", 1)[0].toLowerCase() ?? "";
    const inferredContentType = contentTypeFromFilename(args.filename);
    const contentType = ALLOWED_ASSET_TYPES.includes(storedContentType)
      ? storedContentType
      : inferredContentType;
    if (!contentType || !ALLOWED_ASSET_TYPES.includes(contentType)) {
      throw new Error("Content-Type must be a supported image, video, or ZIP type");
    }
    return await attachAssetHandler(ctx, {
      ...args,
      filename: args.filename.slice(0, 200),
      contentType,
      sha256: metadata.sha256,
    });
  },
});
