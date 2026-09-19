import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import {
  ALLOWED_ASSET_TYPES,
  contentTypeFromFilename,
  isImageContentType,
} from "../postAssets/contentTypes";

type JsonRecord = Record<string, unknown>;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function tokenFromRequest(req: Request): string | null {
  const authorization = req.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  return match?.[1] ?? null;
}

function objectFrom(value: unknown): JsonRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function postInput(value: unknown):
  | {
      ok: true;
      input: {
        title?: string;
        slug?: string | null;
        excerpt?: string;
        body?: string;
        visibility?: "listed" | "unlisted";
        tags?: string[];
        published?: boolean;
        coverImageId?: Id<"_storage"> | null;
      };
    }
  | { ok: false; error: string } {
  const record = objectFrom(value);
  if (!record) return { ok: false, error: "Expected a JSON object" };
  const input: {
    title?: string;
    slug?: string | null;
    excerpt?: string;
    body?: string;
    visibility?: "listed" | "unlisted";
    tags?: string[];
    published?: boolean;
    coverImageId?: Id<"_storage"> | null;
  } = {};
  for (const field of ["title", "excerpt", "body"] as const) {
    if (record[field] !== undefined) {
      if (typeof record[field] !== "string") {
        return { ok: false, error: `${field} must be a string` };
      }
      input[field] = record[field];
    }
  }
  if (record.slug !== undefined) {
    if (record.slug !== null && typeof record.slug !== "string") {
      return { ok: false, error: "slug must be a string or null" };
    }
    input.slug = record.slug as string | null;
  }
  if (record.visibility !== undefined) {
    if (record.visibility !== "listed" && record.visibility !== "unlisted") {
      return { ok: false, error: "visibility must be listed or unlisted" };
    }
    input.visibility = record.visibility;
  }
  if (record.tags !== undefined) {
    if (!Array.isArray(record.tags) || !record.tags.every((tag) => typeof tag === "string")) {
      return { ok: false, error: "tags must be an array of strings" };
    }
    if (record.tags.length > 16) {
      return { ok: false, error: "tags may contain at most 16 entries" };
    }
    input.tags = record.tags;
  }
  if (record.published !== undefined) {
    if (typeof record.published !== "boolean") {
      return { ok: false, error: "published must be a boolean" };
    }
    input.published = record.published;
  }
  if (record.coverImageId !== undefined) {
    if (record.coverImageId !== null && typeof record.coverImageId !== "string") {
      return { ok: false, error: "coverImageId must be a string or null" };
    }
    input.coverImageId = record.coverImageId as Id<"_storage"> | null;
  }
  return { ok: true, input };
}

async function requestJson(req: Request): Promise<unknown> {
  const contentType = req.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("Content-Type must be application/json");
  }
  return await req.json();
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Request failed";
  if (message.includes("Unauthorized")) return json({ error: "Unauthorized" }, 401);
  if (message.includes("Post not found")) return json({ error: "Post not found" }, 404);
  return json({ error: message }, 400);
}

function pathParts(req: Request): string[] {
  return new URL(req.url).pathname.split("/").filter(Boolean);
}

export const listPosts = httpAction(async (ctx, req) => {
  const token = tokenFromRequest(req);
  if (!token) return json({ error: "Missing Bearer API key" }, 401);
  const rawLimit = Number(new URL(req.url).searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(rawLimit) ? rawLimit : 20;
  try {
    const posts = await ctx.runQuery(internal.apiKeys.internal.listPosts, {
      token,
      limit,
    });
    return json({ posts });
  } catch (error) {
    return errorResponse(error);
  }
});

export const getPost = httpAction(async (ctx, req) => {
  const token = tokenFromRequest(req);
  if (!token) return json({ error: "Missing Bearer API key" }, 401);
  const parts = pathParts(req);
  if (parts.length !== 3) return json({ error: "Not found" }, 404);
  try {
    const post = await ctx.runQuery(internal.apiKeys.internal.getPost, {
      token,
      postId: parts[2] as Id<"posts">,
    });
    return post ? json({ post }) : json({ error: "Post not found" }, 404);
  } catch (error) {
    return errorResponse(error);
  }
});

export const createPost = httpAction(async (ctx, req) => {
  const token = tokenFromRequest(req);
  if (!token) return json({ error: "Missing Bearer API key" }, 401);
  try {
    const parsed = postInput(await requestJson(req));
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const post = await ctx.runMutation(internal.apiKeys.internal.createPost, {
      token,
      input: parsed.input,
    });
    return json({ post }, 201);
  } catch (error) {
    return errorResponse(error);
  }
});

export const updatePost = httpAction(async (ctx, req) => {
  const token = tokenFromRequest(req);
  if (!token) return json({ error: "Missing Bearer API key" }, 401);
  const parts = pathParts(req);
  if (parts.length !== 3) return json({ error: "Not found" }, 404);
  try {
    const parsed = postInput(await requestJson(req));
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const post = await ctx.runMutation(internal.apiKeys.internal.updatePost, {
      token,
      postId: parts[2] as Id<"posts">,
      input: parsed.input,
    });
    return json({ post });
  } catch (error) {
    return errorResponse(error);
  }
});

export const uploadAsset = httpAction(async (ctx, req) => {
  const token = tokenFromRequest(req);
  if (!token) return json({ error: "Missing Bearer API key" }, 401);
  const parts = pathParts(req);

  if (parts.length === 5 && parts[3] === "assets" && parts[4] === "upload-url") {
    try {
      const uploadUrl = await ctx.runMutation(internal.apiKeys.internal.prepareAssetUpload, {
        token,
        postId: parts[2] as Id<"posts">,
      });
      return json({ uploadUrl, expiresInSeconds: 3600 });
    } catch (error) {
      return errorResponse(error);
    }
  }

  if (parts.length === 5 && parts[3] === "assets" && parts[4] === "attach") {
    try {
      const record = objectFrom(await requestJson(req));
      if (!record) return json({ error: "Expected a JSON object" }, 400);
      if (typeof record.storageId !== "string" || !record.storageId) {
        return json({ error: "storageId is required" }, 400);
      }
      if (typeof record.filename !== "string" || !record.filename.trim()) {
        return json({ error: "filename is required" }, 400);
      }
      for (const field of ["alt", "description"] as const) {
        if (record[field] !== undefined && typeof record[field] !== "string") {
          return json({ error: `${field} must be a string` }, 400);
        }
      }
      if (record.cover !== undefined && typeof record.cover !== "boolean") {
        return json({ error: "cover must be a boolean" }, 400);
      }
      const filename = record.filename.trim().slice(0, 200);
      const asset = await ctx.runMutation(internal.apiKeys.internal.attachUploadedAsset, {
        token,
        postId: parts[2] as Id<"posts">,
        storageId: record.storageId as Id<"_storage">,
        filename,
        alt: (record.alt as string | undefined)?.slice(0, 200) ?? filename,
        description: (record.description as string | undefined)?.slice(0, 500) ?? "",
        cover: (record.cover as boolean | undefined) ?? false,
      });
      return json({ asset }, 201);
    } catch (error) {
      return errorResponse(error);
    }
  }

  if (parts.length !== 4 || parts[3] !== "assets") {
    return json({ error: "Not found" }, 404);
  }
  const authenticated = await ctx.runQuery(internal.apiKeys.internal.authenticate, { token });
  if (!authenticated) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const rawFilename = url.searchParams.get("filename")?.trim() ?? "";
  const filename = rawFilename.slice(0, 200);
  if (!filename) return json({ error: "filename query parameter is required" }, 400);
  const requestedContentType = (req.headers.get("Content-Type") ?? "")
    .split(";", 1)[0]
    .toLowerCase();
  const inferredContentType = contentTypeFromFilename(filename);
  const contentType = ALLOWED_ASSET_TYPES.includes(requestedContentType)
    ? requestedContentType
    : inferredContentType;
  if (!contentType || !ALLOWED_ASSET_TYPES.includes(contentType)) {
    return json({ error: "Content-Type must be a supported image, video, or ZIP type" }, 415);
  }
  const cover = url.searchParams.get("cover") === "true";
  if (cover && !isImageContentType(contentType)) {
    return json({ error: "Only an image can be a post cover" }, 400);
  }
  const blob = await req.blob();
  if (blob.size === 0) return json({ error: "Upload body is empty" }, 400);
  if (blob.size > 19 * 1024 * 1024) return json({ error: "Upload exceeds 19 MiB" }, 413);
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  let storageId: Id<"_storage">;
  try {
    // Keep the content hash for deduplication below, but let Convex calculate
    // its own storage checksum. Passing the hex digest through storage.store's
    // optional checksum path causes the live runtime to reject its upload
    // header before the blob is stored.
    storageId = await ctx.storage.store(new Blob([bytes], { type: contentType }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "File storage failed";
    console.error("API asset storage failed", message);
    return json({ error: message }, 500);
  }
  try {
    const asset = await ctx.runMutation(internal.apiKeys.internal.attachAsset, {
      token,
      postId: parts[2] as Id<"posts">,
      storageId,
      filename,
      contentType,
      sha256,
      alt: (url.searchParams.get("alt") ?? filename.replace(/\.[^.]+$/, "")).slice(0, 200),
      description: (url.searchParams.get("description") ?? "").slice(0, 500),
      cover,
    });
    return json({ asset }, 201);
  } catch (error) {
    try {
      await ctx.storage.delete(storageId);
    } catch {
      // The deduplication path may already have removed this upload.
    }
    return errorResponse(error);
  }
});
