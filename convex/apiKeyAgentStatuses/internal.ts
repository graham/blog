import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { AGENT_STATUS_MIN_INTERVAL_MS, type AgentState } from "./validators";

export async function readAgentStatus(
  ctx: QueryCtx | MutationCtx,
  apiKeyId: Id<"apiKeys">,
): Promise<Doc<"apiKeyAgentStatuses"> | null> {
  return await ctx.db
    .query("apiKeyAgentStatuses")
    .withIndex("by_apiKeyId", (query) => query.eq("apiKeyId", apiKeyId))
    .unique();
}

export type AgentStatusWrite =
  | { ok: true; state: AgentState; status: string; question: string | null; updatedAt: number }
  | { ok: false; retryAfterMs: number };

// A change of state or question is something the operator should see right
// away, so it bypasses the interval. Progress-only updates (a new status slug
// in the same state) are limited to one per AGENT_STATUS_MIN_INTERVAL_MS.
export async function writeAgentStatus(
  ctx: MutationCtx,
  args: {
    apiKeyId: Id<"apiKeys">;
    state: AgentState;
    status: string;
    question: string | null;
  },
): Promise<AgentStatusWrite> {
  const now = Date.now();
  const existing = await readAgentStatus(ctx, args.apiKeyId);
  const next = { state: args.state, status: args.status, question: args.question, updatedAt: now };
  if (!existing) {
    await ctx.db.insert("apiKeyAgentStatuses", { apiKeyId: args.apiKeyId, ...next });
    return { ok: true, ...next };
  }
  const important = existing.state !== args.state || existing.question !== args.question;
  const elapsed = now - existing.updatedAt;
  if (!important && elapsed < AGENT_STATUS_MIN_INTERVAL_MS) {
    return { ok: false, retryAfterMs: AGENT_STATUS_MIN_INTERVAL_MS - elapsed };
  }
  await ctx.db.patch("apiKeyAgentStatuses", existing._id, next);
  return { ok: true, ...next };
}
