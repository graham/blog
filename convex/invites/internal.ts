import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  inviteValidator,
  invitePreviewValidator,
  revealedInviteValidator,
} from "../lib/validators";
import { assertUsablePassword, pbkdf2Hash } from "../lib/password";
import { inviteTokenPrefix, randomInviteToken, sha256Hex } from "./token";

type Ctx = QueryCtx | MutationCtx;

export const DEFAULT_EXPIRY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export function inviteStatus(
  invite: Doc<"invites">,
  now: number = Date.now(),
): InviteStatus {
  if (invite.acceptedAt !== undefined) return "accepted";
  if (invite.revokedAt !== undefined) return "revoked";
  if (invite.expiresAt <= now) return "expired";
  return "pending";
}

export function toInviteSummary(invite: Doc<"invites">, now?: number) {
  return {
    _id: invite._id,
    _creationTime: invite._creationTime,
    email: invite.email,
    userType: invite.userType,
    tokenPrefix: invite.tokenPrefix,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt ?? null,
    revokedAt: invite.revokedAt ?? null,
    status: inviteStatus(invite, now),
  };
}

// Used by both the invite link and the Google sign-in path: an email with a
// live invite is allowed through the door exactly once.
export async function findPendingInviteByEmail(
  ctx: Ctx,
  email: string,
): Promise<Doc<"invites"> | null> {
  const rows = await ctx.db
    .query("invites")
    .withIndex("by_email", (q) => q.eq("email", normalizeEmail(email)))
    .take(50);
  const pending = rows.filter((row) => inviteStatus(row) === "pending");
  pending.sort((a, b) => b.expiresAt - a.expiresAt);
  return pending[0] ?? null;
}

export async function findInviteByToken(
  ctx: Ctx,
  token: string,
): Promise<Doc<"invites"> | null> {
  const hash = await sha256Hex(token);
  return await ctx.db
    .query("invites")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash))
    .first();
}

export async function consumeInvite(
  ctx: MutationCtx,
  inviteId: Id<"invites">,
  userId: Id<"users">,
): Promise<void> {
  await ctx.db.patch("invites", inviteId, {
    acceptedAt: Date.now(),
    acceptedUserId: userId,
  });
}

async function userByEmail(ctx: Ctx, email: string) {
  return await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .first();
}

export const create = internalMutation({
  args: {
    email: v.string(),
    userType: v.union(v.literal("user"), v.literal("admin")),
    expiresInDays: v.optional(v.number()),
    createdBy: v.id("users"),
  },
  returns: revealedInviteValidator,
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (email.length === 0 || !email.includes("@") || email.length > 200) {
      throw new Error("Enter a valid email address");
    }
    let user = await userByEmail(ctx, email);
    if (user) {
      const passwordAccount = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", email),
        )
        .first();
      if (passwordAccount) {
        throw new Error("That email already has a password sign-in");
      }
    } else {
      const userId = await ctx.db.insert("users", {
        email,
        name: email,
        userType: args.userType,
      });
      user = await ctx.db.get("users", userId);
      if (!user) throw new Error("User creation failed");
    }

    // One live invite per email: issuing a new link retires the old one.
    const previous = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .take(50);
    for (const row of previous) {
      if (inviteStatus(row) === "pending") {
        await ctx.db.patch("invites", row._id, { revokedAt: Date.now() });
      }
    }

    const days = Math.max(
      1,
      Math.min(90, Math.floor(args.expiresInDays ?? DEFAULT_EXPIRY_DAYS)),
    );
    const token = randomInviteToken();
    const inviteId = await ctx.db.insert("invites", {
      email,
      tokenPrefix: inviteTokenPrefix(token),
      tokenHash: await sha256Hex(token),
      userType: args.userType,
      createdBy: args.createdBy,
      expiresAt: Date.now() + days * DAY_MS,
    });
    const invite = await ctx.db.get("invites", inviteId);
    if (!invite) throw new Error("Invite creation failed");
    return { invite: toInviteSummary(invite), token };
  },
});

export const revoke = internalMutation({
  args: { inviteId: v.id("invites") },
  returns: inviteValidator,
  handler: async (ctx, args) => {
    const invite = await ctx.db.get("invites", args.inviteId);
    if (!invite) throw new Error("Invite not found");
    if (inviteStatus(invite) === "pending") {
      await ctx.db.patch("invites", invite._id, { revokedAt: Date.now() });
    }
    const updated = await ctx.db.get("invites", invite._id);
    if (!updated) throw new Error("Invite not found");
    return toInviteSummary(updated);
  },
});

export const list = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(inviteValidator),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("invites")
      .order("desc")
      .paginate(args.paginationOpts);
    const now = Date.now();
    return {
      ...result,
      page: result.page.map((invite) => toInviteSummary(invite, now)),
    };
  },
});

export const preview = internalQuery({
  args: { token: v.string() },
  returns: invitePreviewValidator,
  handler: async (ctx, args) => {
    const invite = await findInviteByToken(ctx, args.token);
    if (!invite) return { status: "unknown" as const, email: null };
    const status = inviteStatus(invite);
    if (status === "pending") {
      return { status: "valid" as const, email: invite.email };
    }
    return { status, email: null };
  },
});

export const acceptWithPassword = internalMutation({
  args: {
    token: v.string(),
    name: v.string(),
    password: v.string(),
  },
  returns: v.object({ email: v.string() }),
  handler: async (ctx, args) => {
    const invite = await findInviteByToken(ctx, args.token);
    if (!invite || inviteStatus(invite) !== "pending") {
      throw new Error("This invite link is no longer valid");
    }
    assertUsablePassword(args.password);
    const name = args.name.trim().slice(0, 100) || invite.email;
    let user = await userByEmail(ctx, invite.email);
    if (user) {
      const passwordAccount = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", invite.email),
        )
        .first();
      if (passwordAccount) {
        throw new Error("That email already has a password sign-in");
      }
      await ctx.db.patch("users", user._id, { name });
    } else {
      const userId = await ctx.db.insert("users", {
        email: invite.email,
        name,
        userType: invite.userType,
      });
      user = await ctx.db.get("users", userId);
      if (!user) throw new Error("User creation failed");
    }
    await ctx.db.insert("authAccounts", {
      userId: user._id,
      provider: "password",
      providerAccountId: invite.email,
      secret: await pbkdf2Hash(args.password),
    });
    await consumeInvite(ctx, invite._id, user._id);
    console.log(`Invite accepted with a password by ${invite.email}`);
    return { email: invite.email };
  },
});
