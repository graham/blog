import { v } from "convex/values";
import type { Infer } from "convex/values";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import { bookmarkGroupNavValidator } from "../lib/validators";
import { resolvePublicViewer } from "../lib/access";
import { readSiteSettings } from "../siteSettings/internal";

type GroupNav = Infer<typeof bookmarkGroupNavValidator>;

export const listForViewer = query({
  args: {},
  returns: v.array(bookmarkGroupNavValidator),
  handler: async (ctx): Promise<GroupNav[]> => {
    const settings = await readSiteSettings(ctx);
    if (!settings.bookmarksEnabled) {
      return [];
    }
    const viewer = await resolvePublicViewer(ctx);
    if (viewer.blocked) {
      return [];
    }
    const result: GroupNav[] = await ctx.runQuery(
      internal.bookmarkGroups.internal.listForViewer,
      {
        viewerUserId: viewer.viewerUserId,
        asAdmin: viewer.asAdmin,
      },
    );
    if (!viewer.stripText) return result;
    return result.map((group) => ({
      ...group,
      name: "",
      posts: group.posts.map((post) => ({ ...post, title: "" })),
    }));
  },
});
