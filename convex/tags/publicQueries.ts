import { v } from "convex/values";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import { tagNavGroupValidator } from "../lib/validators";
import { resolvePublicViewer } from "../lib/access";
import { readSiteSettings } from "../siteSettings/internal";
import { featureVisible } from "../lib/featureMode";
import type { Infer } from "convex/values";

type Group = Infer<typeof tagNavGroupValidator>;

export const listForViewer = query({
  args: {},
  returns: v.array(tagNavGroupValidator),
  handler: async (ctx): Promise<Group[]> => {
    const settings = await readSiteSettings(ctx);
    const viewer = await resolvePublicViewer(ctx);
    if (viewer.blocked) return [];
    if (!featureVisible(settings.features.tagNav, viewer.asAdmin)) return [];
    return await ctx.runQuery(internal.tags.internal.listForViewer, {
      viewerUserId: viewer.viewerUserId,
      asAdmin: viewer.asAdmin,
    });
  },
});
