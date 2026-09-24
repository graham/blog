import { v } from "convex/values";
import { agentStatusValidator } from "../apiKeyAgentStatuses/validators";

export const apiKeyPublicValidator = v.object({
  _id: v.id("apiKeys"),
  _creationTime: v.number(),
  name: v.string(),
  tokenPrefix: v.string(),
  promptAvailable: v.boolean(),
  revokedAt: v.union(v.number(), v.null()),
});

export const apiKeyListItemValidator = apiKeyPublicValidator.extend({
  agentStatus: v.union(agentStatusValidator, v.null()),
});

export const revealedApiKeyValidator = v.object({
  key: apiKeyPublicValidator,
  token: v.string(),
});

export const apiPostInputValidator = v.object({
  title: v.optional(v.string()),
  slug: v.optional(v.union(v.string(), v.null())),
  excerpt: v.optional(v.string()),
  body: v.optional(v.string()),
  visibility: v.optional(v.union(v.literal("listed"), v.literal("unlisted"))),
  tags: v.optional(v.array(v.string())),
  published: v.optional(v.boolean()),
  coverImageId: v.optional(v.union(v.id("_storage"), v.null())),
});
