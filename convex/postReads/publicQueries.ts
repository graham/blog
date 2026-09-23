import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthedUser } from "../lib/auth";
import { readSiteSettings } from "../siteSettings/internal";
import { featureVisible } from "../lib/featureMode";
import { getReadBefore } from "./internal";

export const getCursor = query({
  args: {},
  returns: v.object({
    readBefore: v.number(),
  }),
  handler: async (ctx) => {
    const user = await getAuthedUser(ctx);
    if (!user) return { readBefore: 0 };
    const settings = await readSiteSettings(ctx);
    if (!featureVisible(settings.features.readReceipts, user.userType === "admin")) {
      return { readBefore: 0 };
    }
    return { readBefore: await getReadBefore(ctx, user._id) };
  },
});
