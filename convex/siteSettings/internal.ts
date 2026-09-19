import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { siteSettingsValidator } from "../lib/validators";

type Ctx = QueryCtx | MutationCtx;

export const DEFAULT_SETTINGS = { requireAuth: false, bookmarksEnabled: false };

// One row holds every global setting. Queries never write, so a missing row
// reads as the defaults and the first admin write creates it.
export async function readSiteSettings(ctx: Ctx): Promise<{
  requireAuth: boolean;
  bookmarksEnabled: boolean;
}> {
  const row = await ctx.db.query("siteSettings").first();
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    requireAuth: row.requireAuth,
    bookmarksEnabled: row.bookmarksEnabled === true,
  };
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
    const current = await readSiteSettings(ctx);
    const next = {
      requireAuth: args.requireAuth,
      bookmarksEnabled: current.bookmarksEnabled,
      updatedAt: Date.now(),
      updatedBy: args.updatedBy,
    };
    if (row) {
      await ctx.db.patch("siteSettings", row._id, next);
    } else {
      await ctx.db.insert("siteSettings", next);
    }
    return { requireAuth: next.requireAuth, bookmarksEnabled: next.bookmarksEnabled };
  },
});

export const setBookmarksEnabled = internalMutation({
  args: { bookmarksEnabled: v.boolean(), updatedBy: v.id("users") },
  returns: siteSettingsValidator,
  handler: async (ctx, args) => {
    const row = await ctx.db.query("siteSettings").first();
    const current = await readSiteSettings(ctx);
    const next = {
      requireAuth: current.requireAuth,
      bookmarksEnabled: args.bookmarksEnabled,
      updatedAt: Date.now(),
      updatedBy: args.updatedBy,
    };
    if (row) {
      await ctx.db.patch("siteSettings", row._id, next);
    } else {
      await ctx.db.insert("siteSettings", next);
    }
    return { requireAuth: next.requireAuth, bookmarksEnabled: next.bookmarksEnabled };
  },
});
