import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { mutation } from "../_generated/server";
import { components } from "../_generated/api";
import { findUserByEmail } from "../users/internal";
import { verifyPassword } from "../lib/password";
import { readSiteSettings } from "../siteSettings/internal";

const signInWithPasswordV2 = makeFunctionReference<"mutation">(
  "auth:signInWithPasswordV2",
);

function localPartUsername(email: string): string {
  const local = email.split("@")[0] ?? email;
  const cleaned = local.replace(/[^a-zA-Z0-9._-]/g, "") || "user";
  return cleaned.slice(0, 32);
}

const tokensValidator = v.object({
  accessToken: v.string(),
  accessTokenExpiresAt: v.number(),
  refreshToken: v.string(),
  refreshTokenExpiresAt: v.number(),
  userId: v.string(),
});

const signInResultValidator = v.union(
  v.object({ status: v.literal("complete"), tokens: tokensValidator }),
  v.object({ status: v.literal("error"), userError: v.any() }),
);

export const signInWithPassword = mutation({
  args: { username: v.string(), password: v.string() },
  returns: signInResultValidator,
  handler: async (ctx, args) => {
    const settings = await readSiteSettings(ctx);
    if (!settings.passwordSignIn) {
      return { status: "error" as const, userError: { error: "INVALID_CREDENTIALS" as const } };
    }
    const first = await ctx.runMutation(signInWithPasswordV2, args);
    if (first.status === "complete") return first;

    const identifier = args.username.trim().toLowerCase();
    let user = identifier.includes("@")
      ? await findUserByEmail(ctx, identifier)
      : null;
    if (!user) {
      const byAccount = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", identifier),
        )
        .first();
      if (byAccount) user = await ctx.db.get("users", byAccount.userId);
    }
    if (!user || user.userType === "guest") return first;
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", user._id).eq("provider", "password"),
      )
      .first();
    if (!account?.secret) return first;
    if (!(await verifyPassword(args.password, account.secret))) return first;

    const username = localPartUsername(user.email ?? identifier);
    const named = await ctx.runMutation(components.authUsername.public.setUsername, {
      userId: user._id,
      username,
    });
    if (!named.success) {
      const retry = await ctx.runMutation(components.authUsername.public.setUsername, {
        userId: user._id,
        username: `${username}-2`,
      });
      if (!retry.success) return first;
    }
    const set = await ctx.runMutation(components.authPasswordProvider.public.setPassword, {
      userId: user._id,
      password: args.password,
    });
    if (!set.success) return first;
    await ctx.db.patch("users", user._id, { authGeneration: "v2" });
    console.log(`Password migrated to v2 for user ${user._id}`);
    const enrolledName =
      named.success ? username : `${username}-2`;
    return await ctx.runMutation(signInWithPasswordV2, {
      username: enrolledName,
      password: args.password,
    });
  },
});
