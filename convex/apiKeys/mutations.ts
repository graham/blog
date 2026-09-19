import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { decryptApiKey, encryptApiKey, randomApiKey, sha256Hex, tokenPrefix } from "./token";
import { apiKeyPublicValidator, revealedApiKeyValidator } from "./validators";

export const create = mutation({
  args: { name: v.string() },
  returns: revealedApiKeyValidator,
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const name = args.name.trim();
    if (name.length === 0 || name.length > 100) {
      throw new Error("Name must be between 1 and 100 characters");
    }
    const token = randomApiKey();
    const keyId = await ctx.db.insert("apiKeys", {
      name,
      tokenPrefix: tokenPrefix(token),
      tokenHash: await sha256Hex(token),
      encryptedToken: await encryptApiKey(token),
      createdBy: admin._id,
    });
    const key = await ctx.db.get("apiKeys", keyId);
    if (!key) throw new Error("API key creation failed");
    return {
      key: {
        _id: key._id,
        _creationTime: key._creationTime,
        name: key.name,
        tokenPrefix: key.tokenPrefix,
        promptAvailable: true,
        revokedAt: null,
      },
      token,
    };
  },
});

export const rotate = mutation({
  args: { keyId: v.id("apiKeys") },
  returns: revealedApiKeyValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const key = await ctx.db.get("apiKeys", args.keyId);
    if (!key) throw new Error("API key not found");
    if (key.revokedAt !== undefined) throw new Error("API key is revoked");
    const token = randomApiKey();
    await ctx.db.patch("apiKeys", key._id, {
      tokenPrefix: tokenPrefix(token),
      tokenHash: await sha256Hex(token),
      encryptedToken: await encryptApiKey(token),
    });
    const updated = await ctx.db.get("apiKeys", key._id);
    if (!updated) throw new Error("API key not found");
    return {
      key: {
        _id: updated._id,
        _creationTime: updated._creationTime,
        name: updated.name,
        tokenPrefix: updated.tokenPrefix,
        promptAvailable: true,
        revokedAt: null,
      },
      token,
    };
  },
});

export const reveal = mutation({
  args: { keyId: v.id("apiKeys") },
  returns: revealedApiKeyValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const key = await ctx.db.get("apiKeys", args.keyId);
    if (!key) throw new Error("API key not found");
    if (key.revokedAt !== undefined) throw new Error("API key is revoked");
    if (!key.encryptedToken) {
      throw new Error(
        "This key predates saved prompts. Rotate it once to make its prompt re-readable.",
      );
    }
    return {
      key: {
        _id: key._id,
        _creationTime: key._creationTime,
        name: key.name,
        tokenPrefix: key.tokenPrefix,
        promptAvailable: true,
        revokedAt: null,
      },
      token: await decryptApiKey(key.encryptedToken),
    };
  },
});

export const revoke = mutation({
  args: { keyId: v.id("apiKeys") },
  returns: apiKeyPublicValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const key = await ctx.db.get("apiKeys", args.keyId);
    if (!key) throw new Error("API key not found");
    const revokedAt = key.revokedAt ?? Date.now();
    if (key.revokedAt === undefined) {
      await ctx.db.patch("apiKeys", key._id, { revokedAt });
    }
    return {
      _id: key._id,
      _creationTime: key._creationTime,
      name: key.name,
      tokenPrefix: key.tokenPrefix,
      promptAvailable: key.encryptedToken !== undefined,
      revokedAt,
    };
  },
});
