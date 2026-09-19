import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { sha256Hex } from "./token";

export async function apiKeyFromToken(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<Doc<"apiKeys"> | null> {
  if (!token.startsWith("blg_") || token.length !== 68) return null;
  const tokenHash = await sha256Hex(token);
  const key = await ctx.db
    .query("apiKeys")
    .withIndex("by_tokenHash", (query) => query.eq("tokenHash", tokenHash))
    .unique();
  return key !== null && key.revokedAt === undefined ? key : null;
}
