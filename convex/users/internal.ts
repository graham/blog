import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { parseList } from "../lib/env";
import { userSummaryValidator } from "../lib/validators";

type Ctx = QueryCtx | MutationCtx;

const MAX_SESSIONS_PER_USER = 200;

export function toUserSummary(user: Doc<"users">) {
  return {
    _id: user._id,
    _creationTime: user._creationTime,
    name: user.name ?? null,
    email: user.email ?? null,
    userType: user.userType,
    disabledAt: user.disabledAt ?? null,
  };
}

export async function countEnabledAdmins(ctx: Ctx): Promise<number> {
  const users = await ctx.db.query("users").take(1000);
  return users.filter(
    (user) => user.userType === "admin" && user.disabledAt === undefined,
  ).length;
}

// Disabling has to bite immediately, so every live session and its refresh
// tokens go with it.
export async function revokeSessions(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<number> {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .take(MAX_SESSIONS_PER_USER);
  for (const session of sessions) {
    const refreshTokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .take(MAX_SESSIONS_PER_USER);
    for (const token of refreshTokens) {
      await ctx.db.delete("authRefreshTokens", token._id);
    }
    await ctx.db.delete("authSessions", session._id);
  }
  return sessions.length;
}

export const resetPassword = internalMutation({
  args: {
    email: v.string(),
    hashedPassword: v.string(),
  },
  returns: v.object({
    email: v.string(),
    sessionsRevoked: v.number(),
  }),
  handler: async (ctx, args) => {
    const email = args.email.trim();
    if (email.length === 0) {
      throw new Error("Email is required");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user) {
      throw new Error("No user with that email");
    }
    const existingAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .first();
    if (existingAccount) {
      await ctx.db.patch("authAccounts", existingAccount._id, {
        secret: args.hashedPassword,
      });
    } else {
      await ctx.db.insert("authAccounts", {
        userId: user._id,
        provider: "password",
        providerAccountId: email,
        secret: args.hashedPassword,
      });
    }
    const sessionsRevoked = await revokeSessions(ctx, user._id);
    console.log(
      `Password reset for ${email}; revoked ${sessionsRevoked} session(s)`,
    );
    return { email, sessionsRevoked };
  },
});

export const insertAdminUser = internalMutation({
  args: {
    email: v.string(),
    hashedPassword: v.string(),
    name: v.string(),
  },
  handler: async (ctx, { email, hashedPassword, name }) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    let userId;
    if (existingUser) {
      userId = existingUser._id;
      if (existingUser.userType !== "admin") {
        await ctx.db.patch("users", existingUser._id, { userType: "admin" });
      }
    } else {
      userId = await ctx.db.insert("users", {
        email,
        name,
        userType: "admin",
      });
    }

    const existingAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email)
      )
      .first();

    if (existingAccount) {
      await ctx.db.patch(existingAccount._id, { secret: hashedPassword });
    } else {
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: email,
        secret: hashedPassword,
      });
    }
  },
});

export const promoteAdminsFromEnv = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const emails = parseList(process.env.ADMIN_USERS);
    let n = 0;
    for (const email of emails) {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();
      if (user && user.userType !== "admin") {
        await ctx.db.patch("users", user._id, { userType: "admin" });
        n += 1;
      }
    }
    return n;
  },
});

export const listForAdmin = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(userSummaryValidator),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("users")
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(toUserSummary) };
  },
});

export const setDisabled = internalMutation({
  args: { userId: v.id("users"), disabled: v.boolean(), actorId: v.id("users") },
  returns: userSummaryValidator,
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user) throw new Error("User not found");
    if (args.userId === args.actorId) {
      throw new Error("You cannot disable your own account");
    }
    const alreadyDisabled = user.disabledAt !== undefined;
    if (args.disabled && !alreadyDisabled) {
      if (user.userType === "admin" && (await countEnabledAdmins(ctx)) <= 1) {
        throw new Error("The last enabled admin cannot be disabled");
      }
      await ctx.db.patch("users", user._id, { disabledAt: Date.now() });
      const revoked = await revokeSessions(ctx, user._id);
      console.log(
        `Disabled ${user.email ?? user._id} and revoked ${revoked} session(s)`,
      );
    } else if (!args.disabled && alreadyDisabled) {
      await ctx.db.patch("users", user._id, { disabledAt: undefined });
      console.log(`Re-enabled ${user.email ?? user._id}`);
    }
    const updated = await ctx.db.get("users", user._id);
    if (!updated) throw new Error("User not found");
    return toUserSummary(updated);
  },
});

export const setUserType = internalMutation({
  args: {
    userId: v.id("users"),
    userType: v.union(v.literal("user"), v.literal("admin")),
    actorId: v.id("users"),
  },
  returns: userSummaryValidator,
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user) throw new Error("User not found");
    if (args.userId === args.actorId && args.userType !== "admin") {
      throw new Error("You cannot remove your own admin access");
    }
    if (
      user.userType === "admin" &&
      args.userType !== "admin" &&
      (await countEnabledAdmins(ctx)) <= 1
    ) {
      throw new Error("The last enabled admin cannot be demoted");
    }
    if (user.userType !== args.userType) {
      await ctx.db.patch("users", user._id, { userType: args.userType });
      console.log(`Set ${user.email ?? user._id} to ${args.userType}`);
    }
    const updated = await ctx.db.get("users", user._id);
    if (!updated) throw new Error("User not found");
    return toUserSummary(updated);
  },
});
