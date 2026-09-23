import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { accountValidator } from "../lib/validators";
import { assertUsablePassword, pbkdf2Hash, verifyPassword } from "../lib/password";
import { isMember } from "../lib/auth";

type Ctx = QueryCtx | MutationCtx;

export type AuthMethods = {
  password: boolean;
  google: boolean;
  passkeyCount: number;
};

export function assertNotLastMethod(methods: AuthMethods): void {
  const remaining =
    Number(methods.password) + Number(methods.google) + methods.passkeyCount;
  if (remaining <= 1) {
    throw new Error("Keep at least one sign-in method");
  }
}

export async function listAuthMethods(
  ctx: Ctx,
  userId: Id<"users">,
): Promise<AuthMethods> {
  const password = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", "password"),
    )
    .first();
  const google = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", "google"),
    )
    .first();
  return {
    password: password !== null,
    google: google !== null,
    passkeyCount: 0,
  };
}

async function passwordAccount(ctx: Ctx, userId: Id<"users">) {
  return await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", "password"),
    )
    .first();
}

export const get = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(accountValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user || !isMember(user)) return null;
    const methods = await listAuthMethods(ctx, user._id);
    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      userType: user.userType === "admin" ? ("admin" as const) : ("user" as const),
      authGeneration: user.authGeneration ?? null,
      methods,
    };
  },
});

export const updateProfile = internalMutation({
  args: { userId: v.id("users"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user || !isMember(user)) throw new Error("Not authenticated");
    const name = args.name.trim().slice(0, 100);
    if (name.length === 0) throw new Error("Enter a name");
    await ctx.db.patch("users", user._id, { name });
    return null;
  },
});

export const changePassword = internalMutation({
  args: {
    userId: v.id("users"),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user || !isMember(user)) throw new Error("Not authenticated");
    const account = await passwordAccount(ctx, user._id);
    if (!account?.secret) throw new Error("No password on this account");
    if (!(await verifyPassword(args.currentPassword, account.secret))) {
      throw new Error("Incorrect current password");
    }
    assertUsablePassword(args.newPassword);
    await ctx.db.patch("authAccounts", account._id, {
      secret: await pbkdf2Hash(args.newPassword),
    });
    return null;
  },
});

export const addPassword = internalMutation({
  args: { userId: v.id("users"), password: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user || !isMember(user)) throw new Error("Not authenticated");
    if (!user.email) throw new Error("Add an email before setting a password");
    const existing = await passwordAccount(ctx, user._id);
    if (existing) throw new Error("This account already has a password");
    assertUsablePassword(args.password);
    await ctx.db.insert("authAccounts", {
      userId: user._id,
      provider: "password",
      providerAccountId: user.email,
      secret: await pbkdf2Hash(args.password),
    });
    return null;
  },
});

export const unlinkGoogle = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user || !isMember(user)) throw new Error("Not authenticated");
    const methods = await listAuthMethods(ctx, user._id);
    if (!methods.google) throw new Error("Google is not linked");
    assertNotLastMethod(methods);
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", user._id).eq("provider", "google"),
      )
      .first();
    if (account) await ctx.db.delete("authAccounts", account._id);
    return null;
  },
});
