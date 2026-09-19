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

export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getAuthedUser(ctx);
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
}

export async function requireAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.userType !== "admin") {
    throw new Error("Forbidden");
  }
  return user;
}
