import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { readAgentStatus } from "../apiKeyAgentStatuses/internal";
import { apiKeyListItemValidator } from "./validators";

export const list = query({
  args: {},
  returns: v.array(apiKeyListItemValidator),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const keys = await ctx.db.query("apiKeys").order("desc").take(200);
    return await Promise.all(
      keys.map(async (key) => {
        const agentStatus = await readAgentStatus(ctx, key._id);
        return {
          _id: key._id,
          _creationTime: key._creationTime,
          name: key.name,
          tokenPrefix: key.tokenPrefix,
          promptAvailable: key.encryptedToken !== undefined,
          revokedAt: key.revokedAt ?? null,
          agentStatus: agentStatus
            ? {
                state: agentStatus.state,
                status: agentStatus.status,
                question: agentStatus.question,
                updatedAt: agentStatus.updatedAt,
              }
            : null,
        };
      }),
    );
  },
});
