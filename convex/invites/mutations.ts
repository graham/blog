import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { inviteValidator, revealedInviteValidator } from "../lib/validators";
import type { Infer } from "convex/values";

type Invite = Infer<typeof inviteValidator>;
type RevealedInvite = Infer<typeof revealedInviteValidator>;

export const create = mutation({
  args: {
    email: v.string(),
    userType: v.union(v.literal("user"), v.literal("admin")),
    expiresInDays: v.optional(v.number()),
  },
  returns: revealedInviteValidator,
  handler: async (ctx, args): Promise<RevealedInvite> => {
    const admin = await requireAdmin(ctx);
    const result: RevealedInvite = await ctx.runMutation(
      internal.invites.internal.create,
      { ...args, createdBy: admin._id },
    );
    console.log(`Invite created for ${result.invite.email} by ${admin._id}`);
    return result;
  },
});

export const revoke = mutation({
  args: { inviteId: v.id("invites") },
  returns: inviteValidator,
  handler: async (ctx, args): Promise<Invite> => {
    await requireAdmin(ctx);
    return await ctx.runMutation(internal.invites.internal.revoke, args);
  },
});
