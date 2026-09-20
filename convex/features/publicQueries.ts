import { query } from "../_generated/server";
import { featuresValidator } from "../lib/validators";
import { readSiteSettings } from "../siteSettings/internal";

export const get = query({
  args: {},
  returns: featuresValidator,
  handler: async (ctx) => {
    const settings = await readSiteSettings(ctx);
    return settings.features;
  },
});
