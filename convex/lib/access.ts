import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getAuthedUser } from "./auth";
import { readSiteSettings } from "../siteSettings/internal";

type Ctx = QueryCtx | MutationCtx;

export const MAX_CHANNELS = 32;

export type PublicViewer = {
  viewerUserId: Id<"users"> | null;
  asAdmin: boolean;
  blocked: boolean;
};

// Single entry point for every anonymous-callable read. `blocked` means the
// site-wide requireAuth switch is on and nobody is signed in, so the caller
// returns an empty result instead of reaching the data layer.
export async function resolvePublicViewer(ctx: Ctx): Promise<PublicViewer> {
  const user = await getAuthedUser(ctx);
  const { requireAuth } = await readSiteSettings(ctx);
  return {
    viewerUserId: user?._id ?? null,
    asAdmin: user?.userType === "admin",
    blocked: requireAuth && user === null,
  };
}

export async function listPostChannelIds(
  ctx: Ctx,
  postId: Id<"posts">,
): Promise<Array<Id<"channels">>> {
  const rows = await ctx.db
    .query("channelPosts")
    .withIndex("by_postId", (q) => q.eq("postId", postId))
    .take(MAX_CHANNELS);
  return rows.map((row) => row.channelId);
}

export async function listPostChannels(ctx: Ctx, postId: Id<"posts">) {
  const ids = await listPostChannelIds(ctx, postId);
  const channels = [];
  for (const id of ids) {
    const channel = await ctx.db.get("channels", id);
    if (channel) {
      channels.push({ _id: channel._id, name: channel.name });
    }
  }
  return channels;
}

export async function listUserChannelIdSet(
  ctx: Ctx,
  userId: Id<"users">,
): Promise<Set<Id<"channels">>> {
  const rows = await ctx.db
    .query("channelMembers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(MAX_CHANNELS);
  return new Set(rows.map((row) => row.channelId));
}

export async function canViewPost(
  ctx: Ctx,
  post: Doc<"posts">,
  viewer: { userId: Id<"users"> | null; isAdmin: boolean } | null,
  userChannelIds?: Set<Id<"channels">>,
): Promise<boolean> {
  if (viewer?.isAdmin) return true;
  if (post.status !== "published") return false;
  if (!viewer?.userId) {
    const { requireAuth } = await readSiteSettings(ctx);
    if (requireAuth) return false;
  }
  const channelIds = await listPostChannelIds(ctx, post._id);
  if (channelIds.length === 0) return true;
  if (!viewer?.userId) return false;
  const memberships =
    userChannelIds ?? (await listUserChannelIdSet(ctx, viewer.userId));
  return channelIds.some((id) => memberships.has(id));
}

export async function syncPostChannels(
  ctx: MutationCtx,
  postId: Id<"posts">,
  channelIds: Array<Id<"channels">>,
): Promise<void> {
  const unique = [...new Set(channelIds)].slice(0, MAX_CHANNELS);
  const wanted = new Set<Id<"channels">>();
  for (const id of unique) {
    const channel = await ctx.db.get("channels", id);
    if (channel) wanted.add(id);
  }
  const existing = await ctx.db
    .query("channelPosts")
    .withIndex("by_postId", (q) => q.eq("postId", postId))
    .take(MAX_CHANNELS);
  for (const row of existing) {
    if (!wanted.has(row.channelId)) {
      await ctx.db.delete("channelPosts", row._id);
    } else {
      wanted.delete(row.channelId);
    }
  }
  for (const channelId of wanted) {
    await ctx.db.insert("channelPosts", { channelId, postId });
  }
}

export async function deletePostChannelLinks(
  ctx: MutationCtx,
  postId: Id<"posts">,
): Promise<void> {
  const rows = await ctx.db
    .query("channelPosts")
    .withIndex("by_postId", (q) => q.eq("postId", postId))
    .take(MAX_CHANNELS);
  for (const row of rows) {
    await ctx.db.delete("channelPosts", row._id);
  }
}
