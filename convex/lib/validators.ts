import { v } from "convex/values";
import { featureModeValidator } from "./featureMode";

export const statusValidator = v.union(
  v.literal("draft"),
  v.literal("scheduled"),
  v.literal("published"),
);

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

export const postReadStateValidator = v.object({
  unread: v.boolean(),
  updatedSinceRead: v.boolean(),
  lastReadAt: v.union(v.number(), v.null()),
});

export const tagValidator = v.object({
  _id: v.id("tags"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  postCount: v.number(),
});

export const tagNavPostValidator = v.object({
  title: v.string(),
  slug: v.string(),
});

export const tagNavGroupValidator = v.object({
  name: v.string(),
  slug: v.string(),
  posts: v.array(tagNavPostValidator),
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
  createdAt: v.number(),
  updatedAt: v.number(),
  authorId: v.id("users"),
  authorName: v.union(v.string(), v.null()),
  coverImageUrl: v.union(v.string(), v.null()),
  tags: v.array(v.string()),
  read: v.union(postReadStateValidator, v.null()),
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

export const bookmarkGroupValidator = v.object({
  _id: v.id("bookmarkGroups"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  createdBy: v.id("users"),
});

export const bookmarkGroupRefValidator = v.object({
  _id: v.id("bookmarkGroups"),
  name: v.string(),
});

export const bookmarkNavPostValidator = v.object({
  title: v.string(),
  slug: v.string(),
});

export const bookmarkGroupNavValidator = v.object({
  _id: v.id("bookmarkGroups"),
  name: v.string(),
  slug: v.string(),
  posts: v.array(bookmarkNavPostValidator),
});

export const adminPostSummaryValidator = v.object({
  ...postSummaryValidator.fields,
  channels: v.array(channelRefValidator),
  imageCount: v.number(),
  characterCount: v.number(),
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
  bookmarkGroups: v.array(bookmarkGroupRefValidator),
  imageCount: v.number(),
  characterCount: v.number(),
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

export const themeIdValidator = v.union(
  v.literal("paper"),
  v.literal("ink"),
  v.literal("ocean"),
  v.literal("forest"),
  v.literal("sunset"),
  v.literal("violet"),
  v.literal("contrast"),
  v.literal("news"),
  v.literal("midnight"),
  v.literal("ember"),
  v.literal("signal"),
  v.literal("citrus"),
);

export const postSortValidator = v.union(v.literal("created"), v.literal("updated"));

export const featuresValidator = v.object({
  bookmarks: featureModeValidator,
  timings: featureModeValidator,
  calendar: featureModeValidator,
  photos: featureModeValidator,
  infiniteScroll: featureModeValidator,
  tagNav: featureModeValidator,
  readReceipts: featureModeValidator,
  imagesOnly: v.boolean(),
  sortOrder: postSortValidator,
  theme: v.object({
    enabled: v.boolean(),
    id: themeIdValidator,
  }),
});

export const siteSettingsValidator = v.object({
  requireAuth: v.boolean(),
  bookmarksEnabled: v.boolean(),
  googleSignIn: v.boolean(),
  passwordSignIn: v.boolean(),
  pushoverEnabled: v.boolean(),
  features: featuresValidator,
});

export const calendarPostValidator = v.object({
  title: v.string(),
  slug: v.string(),
  publishedAt: v.number(),
});

export const inviteValidator = v.object({
  _id: v.id("invites"),
  _creationTime: v.number(),
  email: v.string(),
  userType: v.string(),
  tokenPrefix: v.string(),
  expiresAt: v.number(),
  acceptedAt: v.union(v.number(), v.null()),
  acceptedUserId: v.union(v.id("users"), v.null()),
  acceptedUserName: v.union(v.string(), v.null()),
  acceptedUserEmail: v.union(v.string(), v.null()),
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

export const photoCursorValidator = v.object({
  publishedAt: v.number(),
  creationTime: v.number(),
  postId: v.id("posts"),
  skip: v.number(),
});

export const photoKindValidator = v.union(v.literal("image"), v.literal("video"));

export const photoValidator = v.object({
  key: v.string(),
  kind: photoKindValidator,
  src: v.string(),
  alt: v.string(),
  postId: v.id("posts"),
  slug: v.string(),
  title: v.string(),
  publishedAt: v.number(),
  // Position of this item in its post's media, and how many the post has.
  postIndex: v.number(),
  postMediaCount: v.number(),
  seen: v.union(v.boolean(), v.null()),
});

export const photoPageValidator = v.object({
  photos: v.array(photoValidator),
  nextCursor: v.union(photoCursorValidator, v.null()),
});
