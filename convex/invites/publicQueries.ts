import { v } from "convex/values";
import { query } from "../_generated/server";
import { internal } from "../_generated/api";
import { invitePreviewValidator } from "../lib/validators";
import type { Infer } from "convex/values";

type InvitePreview = Infer<typeof invitePreviewValidator>;

// Anonymous by design: someone holding an invite link has no account yet.
// Only the invited email comes back, never the token or who sent it.
export const preview = query({
  args: { token: v.string() },
  returns: invitePreviewValidator,
  handler: async (ctx, args): Promise<InvitePreview> => {
    return await ctx.runQuery(internal.invites.internal.preview, args);
  },
});
