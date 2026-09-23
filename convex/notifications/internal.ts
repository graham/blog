import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { readSiteSettings } from "../siteSettings/internal";

function siteOrigin(): string {
  const raw = process.env.SITE_URL ?? process.env.CONVEX_SITE_URL ?? "";
  return raw.replace(/\/$/, "");
}

export const enqueuePostChange = internalMutation({
  args: {
    kind: v.union(v.literal("created"), v.literal("updated")),
    postId: v.id("posts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const settings = await readSiteSettings(ctx);
    if (!settings.pushoverEnabled) return null;
    const post = await ctx.db.get("posts", args.postId);
    if (!post) return null;
    const title = post.title.trim() || "Untitled";
    const origin = siteOrigin();
    const publicUrl =
      post.status === "published" && post.visibility === "listed" && origin
        ? `${origin}/posts/${post.slug}`
        : undefined;
    await ctx.scheduler.runAfter(0, internal.notifications.actions.send, {
      title: args.kind === "created" ? "Blog post created" : "Blog post updated",
      message: `${title} (${post.status})`,
      url: publicUrl,
      urlTitle: publicUrl ? "Open post" : undefined,
    });
    return null;
  },
});
