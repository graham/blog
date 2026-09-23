import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { parseList } from "../lib/env";
import { readSiteSettings } from "../siteSettings/internal";
import { consumeInvite, findPendingInviteByEmail, normalizeEmail } from "../invites/internal";
import { findUserByEmail } from "../users/internal";

const rejectUsers = parseList(process.env.REJECT_USERS);

function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).toLowerCase();
}

export const createAnonymousUser = internalMutation({
  args: {
    provider: v.object({
      name: v.literal("anonymous"),
      accountId: v.string(),
      profile: v.object({}),
    }),
  },
  returns: v.id("users"),
  handler: async (ctx) => {
    return await ctx.db.insert("users", { userType: "guest" });
  },
});

export const createGoogleUser = internalMutation({
  args: {
    provider: v.object({
      name: v.literal("google"),
      accountId: v.string(),
      profile: v.object({
        id: v.string(),
        email: v.optional(v.string()),
        emailVerified: v.boolean(),
        name: v.optional(v.string()),
        picture: v.optional(v.string()),
      }),
    }),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const settings = await readSiteSettings(ctx);
    if (!settings.googleSignIn) throw new Error("Google sign-in is turned off");
    const email = args.provider.profile.email?.trim().toLowerCase();
    if (!email || !args.provider.profile.emailVerified) {
      throw new Error("Google did not provide a verified email");
    }
    if (rejectUsers.includes(email)) {
      throw new Error(`User ${email} is banned.`);
    }
    const existing = await findUserByEmail(ctx, email);
    if (existing) {
      if (existing.disabledAt !== undefined) throw new Error("This account is disabled");
      if (existing.userType === "guest") throw new Error("Guest accounts cannot use Google");
      const invite = await findPendingInviteByEmail(ctx, email);
      if (invite) await consumeInvite(ctx, invite._id, existing._id);
      await ctx.db.patch("users", existing._id, {
        name: args.provider.profile.name ?? existing.name,
        image: args.provider.profile.picture ?? existing.image,
        authGeneration: "v2",
      });
      return existing._id;
    }
    const allowed = (settings as { googleAllowedDomains?: string[] }).googleAllowedDomains ?? [];
    if (!allowed.includes(emailDomain(email))) {
      throw new Error(`User ${email} does not exist`);
    }
    const invite = await findPendingInviteByEmail(ctx, email);
    const userId = await ctx.db.insert("users", {
      email,
      name: args.provider.profile.name ?? email,
      image: args.provider.profile.picture,
      userType: "user",
      authGeneration: "v2",
    });
    if (invite) await consumeInvite(ctx, invite._id, userId);
    return userId;
  },
});

export const onGoogleSignIn = internalMutation({
  args: {
    provider: v.object({
      name: v.literal("google"),
      accountId: v.string(),
      profile: v.object({
        id: v.string(),
        email: v.optional(v.string()),
        emailVerified: v.boolean(),
        name: v.optional(v.string()),
        picture: v.optional(v.string()),
      }),
    }),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user) return null;
    await ctx.db.patch("users", args.userId, { authGeneration: "v2" });
    return null;
  },
});

export const createPasswordUser = internalMutation({
  args: {
    provider: v.object({
      name: v.literal("password"),
      accountId: v.string(),
      profile: v.object({ username: v.string() }),
    }),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const username = args.provider.profile.username.trim().toLowerCase();
    const existing = username.includes("@")
      ? await findUserByEmail(ctx, username)
      : null;
    if (!existing || existing.userType === "guest") {
      throw new Error("Password sign-up is disabled");
    }
    return existing._id;
  },
});

export const createPasskeyUser = internalMutation({
  args: {
    provider: v.object({
      name: v.literal("passkey"),
      accountId: v.string(),
      profile: v.object({ username: v.union(v.string(), v.null()) }),
    }),
  },
  returns: v.id("users"),
  handler: async () => {
    throw new Error("Passkeys cannot create members");
  },
});
