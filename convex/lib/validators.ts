import { v } from "convex/values";

export const statusValidator = v.union(v.literal("draft"), v.literal("published"));

export const visibilityValidator = v.union(v.literal("listed"), v.literal("unlisted"));

export const assetValidator = v.object({
  _id: v.id("postAssets"),
  storageId: v.id("_storage"),
  filename: v.string(),
  contentType: v.string(),
  alt: v.string(),
  description: v.string(),
  url: v.union(v.string(), v.null()),
});

export const postSummaryValidator = v.object({
  _id: v.id("posts"),
  _creationTime: v.number(),
  title: v.string(),
  slug: v.string(),
  excerpt: v.string(),
  status: statusValidator,
  visibility: visibilityValidator,
  publishedAt: v.union(v.number(), v.null()),
  updatedAt: v.number(),
  authorId: v.id("users"),
  authorName: v.union(v.string(), v.null()),
  coverImageUrl: v.union(v.string(), v.null()),
  tags: v.array(v.string()),
});

export const postDetailValidator = v.object({
  ...postSummaryValidator.fields,
  body: v.string(),
  coverImageId: v.union(v.id("_storage"), v.null()),
  assets: v.array(assetValidator),
});

export const postNavigationRefValidator = v.object({
  title: v.string(),
  slug: v.string(),
});

export const postNavigationValidator = v.object({
  previous: v.union(postNavigationRefValidator, v.null()),
  next: v.union(postNavigationRefValidator, v.null()),
});

export const channelValidator = v.object({
  _id: v.id("channels"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
});

export const channelRefValidator = v.object({
  _id: v.id("channels"),
  name: v.string(),
});

export const adminPostSummaryValidator = v.object({
  ...postSummaryValidator.fields,
  channels: v.array(channelRefValidator),
});

export const aiJobValidator = v.object({
  status: v.union(v.literal("pending"), v.literal("ready"), v.literal("error")),
  titles: v.array(v.string()),
  summary: v.string(),
  error: v.union(v.string(), v.null()),
});

export const adminPostDetailValidator = v.object({
  ...postSummaryValidator.fields,
  body: v.string(),
  coverImageId: v.union(v.id("_storage"), v.null()),
  channels: v.array(channelRefValidator),
  aiSummary: v.union(v.string(), v.null()),
  ai: v.union(aiJobValidator, v.null()),
});

export const userSummaryValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.union(v.string(), v.null()),
  email: v.union(v.string(), v.null()),
  userType: v.string(),
  disabledAt: v.union(v.number(), v.null()),
});

export const siteSettingsValidator = v.object({
  requireAuth: v.boolean(),
});

export const inviteValidator = v.object({
  _id: v.id("invites"),
  _creationTime: v.number(),
  email: v.string(),
  userType: v.string(),
  tokenPrefix: v.string(),
  expiresAt: v.number(),
  acceptedAt: v.union(v.number(), v.null()),
  revokedAt: v.union(v.number(), v.null()),
  status: v.union(
    v.literal("pending"),
    v.literal("accepted"),
    v.literal("revoked"),
    v.literal("expired"),
  ),
});

export const revealedInviteValidator = v.object({
  invite: inviteValidator,
  token: v.string(),
});

export const invitePreviewValidator = v.object({
  status: v.union(
    v.literal("valid"),
    v.literal("accepted"),
    v.literal("revoked"),
    v.literal("expired"),
    v.literal("unknown"),
  ),
  email: v.union(v.string(), v.null()),
});

export const channelMemberValidator = v.object({
  _id: v.id("channelMembers"),
  userId: v.id("users"),
  name: v.union(v.string(), v.null()),
  email: v.union(v.string(), v.null()),
});
