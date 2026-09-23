import { auth } from "../auth";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

// A disabled account reads as anonymous everywhere: public pages, admin
// routes, and channel membership all go through this helper.
export async function getAuthedUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const user = await getAuthedUserIgnoringDisabled(ctx);
  if (!user || user.disabledAt !== undefined) {
    return null;
  }
  return user;
}

// Only for surfaces that must tell a disabled user why they are locked out.
export async function getAuthedUserIgnoringDisabled(
  ctx: Ctx,
): Promise<Doc<"users"> | null> {
  const userId = await auth.getUserId(ctx);
  if (!userId) {
    return null;
  }
  return await ctx.db.get("users", userId);
}

export function isGuest(user: Doc<"users"> | null): boolean {
  return user?.userType === "guest";
}

export function isMember(user: Doc<"users"> | null): boolean {
  return user !== null && (user.userType === "user" || user.userType === "admin");
}

export async function getMember(ctx: Ctx): Promise<Doc<"users"> | null> {
  const user = await getAuthedUser(ctx);
  if (!isMember(user)) return null;
  return user;
}

export async function requireMember(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getMember(ctx);
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
}

export async function requireAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireMember(ctx);
  if (user.userType !== "admin") {
    throw new Error("Forbidden");
  }
  return user;
}
