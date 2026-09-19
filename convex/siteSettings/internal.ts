import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { siteSettingsValidator } from "../lib/validators";

type Ctx = QueryCtx | MutationCtx;

export const DEFAULT_SETTINGS = { requireAuth: false };

// One row holds every global setting. Queries never write, so a missing row
// reads as the defaults and the first admin write creates it.
export async function readSiteSettings(ctx: Ctx): Promise<{
  requireAuth: boolean;
}> {
  const row = await ctx.db.query("siteSettings").first();
  if (!row) return { ...DEFAULT_SETTINGS };
  return { requireAuth: row.requireAuth };
}

export const get = internalQuery({
  args: {},
  returns: siteSettingsValidator,
  handler: async (ctx) => {
    return await readSiteSettings(ctx);
  },
});

export const setRequireAuth = internalMutation({
  args: { requireAuth: v.boolean(), updatedBy: v.id("users") },
  returns: siteSettingsValidator,
  handler: async (ctx, args) => {
    const row = await ctx.db.query("siteSettings").first();
    const patch = {
      requireAuth: args.requireAuth,
      updatedAt: Date.now(),
      updatedBy: args.updatedBy,
    };
    if (row) {
      await ctx.db.patch("siteSettings", row._id, patch);
    } else {
      await ctx.db.insert("siteSettings", patch);
    }
    return { requireAuth: args.requireAuth };
  },
});
