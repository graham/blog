import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { featuresValidator, postSortValidator, themeIdValidator } from "../lib/validators";
import type { Infer } from "convex/values";

type Features = Infer<typeof featuresValidator>;

export const set = mutation({
  args: {
    bookmarks: v.optional(v.boolean()),
    timings: v.optional(v.boolean()),
    calendar: v.optional(v.boolean()),
    infiniteScroll: v.optional(v.boolean()),
    imagesOnly: v.optional(v.boolean()),
    sortOrder: v.optional(postSortValidator),
    themeEnabled: v.optional(v.boolean()),
    themeId: v.optional(themeIdValidator),
  },
  returns: featuresValidator,
  handler: async (ctx, args): Promise<Features> => {
    const admin = await requireAdmin(ctx);
    const features: Features = await ctx.runMutation(internal.siteSettings.internal.setFeatures, {
      ...args,
      updatedBy: admin._id,
    });
    console.log(`Site features updated by ${admin.email ?? admin._id}`);
    return features;
  },
});
