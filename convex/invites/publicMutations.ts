import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";

// Anonymous by design: the invite token is the credential. The caller signs in
// with the returned email and the password it just set.
export const acceptWithPassword = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    password: v.string(),
  },
  returns: v.object({ email: v.string() }),
  handler: async (ctx, args): Promise<{ email: string }> => {
    return await ctx.runMutation(
      internal.invites.internal.acceptWithPassword,
      args,
    );
  },
});
