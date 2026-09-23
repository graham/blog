import { v } from "convex/values";
import type { Infer } from "convex/values";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import { bookmarkGroupNavValidator } from "../lib/validators";
import { resolvePublicViewer } from "../lib/access";
import { readSiteSettings } from "../siteSettings/internal";
import { featureVisible } from "../lib/featureMode";

type GroupNav = Infer<typeof bookmarkGroupNavValidator>;

export const listForViewer = query({
  args: {},
  returns: v.array(bookmarkGroupNavValidator),
  handler: async (ctx): Promise<GroupNav[]> => {
    const settings = await readSiteSettings(ctx);
    const viewer = await resolvePublicViewer(ctx);
    if (viewer.blocked) {
      return [];
    }
    if (!featureVisible(settings.features.bookmarks, { isMember: viewer.isMember, isAdmin: viewer.asAdmin })) {
      return [];
    }
    const result: GroupNav[] = await ctx.runQuery(
      internal.bookmarkGroups.internal.listForViewer,
      {
        viewerUserId: viewer.viewerUserId,
        asAdmin: viewer.asAdmin,
      },
    );
    return result;
  },
});
