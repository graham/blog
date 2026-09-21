import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,
  users: defineTable({
    ...authTables.users.validator.fields,
    userType: v.string(),
    disabledAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  siteSettings: defineTable({
    requireAuth: v.boolean(),
    bookmarksEnabled: v.optional(v.boolean()),
    timingsShowDelta: v.optional(v.boolean()),
    timingsPage: v.optional(v.boolean()),
    calendar: v.optional(v.boolean()),
    infiniteScroll: v.optional(v.boolean()),
    imagesOnly: v.optional(v.boolean()),
    postSort: v.optional(v.union(v.literal("created"), v.literal("updated"))),
    themeEnabled: v.optional(v.boolean()),
    themeId: v.optional(v.string()),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  }),

  invites: defineTable({
    email: v.string(),
    tokenPrefix: v.string(),
    tokenHash: v.string(),
    userType: v.string(),
    createdBy: v.id("users"),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    acceptedUserId: v.optional(v.id("users")),
    revokedAt: v.optional(v.number()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_email", ["email"]),

  apiKeys: defineTable({
    name: v.string(),
    tokenPrefix: v.string(),
    tokenHash: v.string(),
    encryptedToken: v.optional(v.string()),
    createdBy: v.id("users"),
    revokedAt: v.optional(v.number()),
  }).index("by_tokenHash", ["tokenHash"]),

  posts: defineTable({
    title: v.string(),
    slug: v.string(),
    excerpt: v.string(),
    body: v.string(),
    status: v.union(v.literal("draft"), v.literal("published")),
    visibility: v.union(v.literal("listed"), v.literal("unlisted")),
    publishedAt: v.union(v.number(), v.null()),
    authorId: v.id("users"),
    updatedAt: v.number(),
    coverImageId: v.union(v.id("_storage"), v.null()),
    searchText: v.string(),
    aiSummary: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_status_and_visibility", ["status", "visibility"])
    .index("by_status_and_visibility_and_updatedAt", [
      "status",
      "visibility",
      "updatedAt",
    ])
    .index("by_status_and_visibility_and_publishedAt", [
      "status",
      "visibility",
      "publishedAt",
    ])
    .index("by_updatedAt", ["updatedAt"])
    .index("by_authorId", ["authorId"])
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["status", "visibility"],
    }),

  postTags: defineTable({
    postId: v.id("posts"),
    tag: v.string(),
    status: v.union(v.literal("draft"), v.literal("published")),
    visibility: v.union(v.literal("listed"), v.literal("unlisted")),
    postCreatedAt: v.optional(v.number()),
    postUpdatedAt: v.optional(v.number()),
  })
    .index("by_postId", ["postId"])
    .index("by_tag", ["tag"])
    .index("by_tag_and_postId", ["tag", "postId"])
    .index("by_tag_and_status_and_visibility", ["tag", "status", "visibility"])
    .index("by_tag_status_visibility_createdAt", [
      "tag",
      "status",
      "visibility",
      "postCreatedAt",
    ])
    .index("by_tag_status_visibility_updatedAt", [
      "tag",
      "status",
      "visibility",
      "postUpdatedAt",
    ]),

  channels: defineTable({
    name: v.string(),
    slug: v.string(),
  }).index("by_slug", ["slug"]),

  channelPosts: defineTable({
    channelId: v.id("channels"),
    postId: v.id("posts"),
  })
    .index("by_channelId", ["channelId"])
    .index("by_postId", ["postId"])
    .index("by_channelId_and_postId", ["channelId", "postId"]),

  channelMembers: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
  })
    .index("by_channelId", ["channelId"])
    .index("by_userId", ["userId"])
    .index("by_channelId_and_userId", ["channelId", "userId"]),

  postAiJobs: defineTable({
    postId: v.id("posts"),
    status: v.union(v.literal("pending"), v.literal("ready"), v.literal("error")),
    titles: v.array(v.string()),
    summary: v.string(),
    error: v.union(v.string(), v.null()),
    requestedAt: v.number(),
  }).index("by_postId", ["postId"]),

  bookmarkGroups: defineTable({
    name: v.string(),
    slug: v.string(),
    createdBy: v.id("users"),
  }).index("by_slug", ["slug"]),

  bookmarkGroupPosts: defineTable({
    groupId: v.id("bookmarkGroups"),
    postId: v.id("posts"),
  })
    .index("by_groupId", ["groupId"])
    .index("by_postId", ["postId"])
    .index("by_groupId_and_postId", ["groupId", "postId"]),

  postAssets: defineTable({
    postId: v.id("posts"),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    alt: v.optional(v.string()),
    description: v.optional(v.string()),
    sha256: v.optional(v.string()),
  })
    .index("by_postId", ["postId"])
    .index("by_storageId", ["storageId"])
    .index("by_postId_and_sha256", ["postId", "sha256"]),
});

export default schema;
