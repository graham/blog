import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { apiKeyPublicValidator } from "./validators";

export const list = query({
  args: {},
  returns: v.array(apiKeyPublicValidator),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const keys = await ctx.db.query("apiKeys").order("desc").take(200);
    return keys.map((key) => ({
      _id: key._id,
      _creationTime: key._creationTime,
      name: key.name,
      tokenPrefix: key.tokenPrefix,
      promptAvailable: key.encryptedToken !== undefined,
      revokedAt: key.revokedAt ?? null,
    }));
  },
});
