import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { aiJobValidator } from "../lib/validators";

export const start = internalMutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("posts", args.postId);
    if (!post) {
      throw new Error("Post not found");
    }
    const existing = await ctx.db
      .query("postAiJobs")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .first();
    const fields = {
      postId: args.postId,
      status: "pending" as const,
      titles: [] as string[],
      summary: "",
      error: null,
      requestedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch("postAiJobs", existing._id, fields);
    } else {
      await ctx.db.insert("postAiJobs", fields);
    }
    return null;
  },
});

export const complete = internalMutation({
  args: {
    postId: v.id("posts"),
    titles: v.array(v.string()),
    summary: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("postAiJobs")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .first();
    if (!job) {
      throw new Error("AI job not found");
    }
    const titles = args.titles.map((title) => title.trim()).filter(Boolean).slice(0, 5);
    const summary = args.summary.trim().slice(0, 600);
    await ctx.db.patch("postAiJobs", job._id, {
      status: "ready",
      titles,
      summary,
      error: null,
    });
    await ctx.db.patch("posts", args.postId, {
      aiSummary: summary,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const fail = internalMutation({
  args: {
    postId: v.id("posts"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("postAiJobs")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .first();
    if (!job) return null;
    await ctx.db.patch("postAiJobs", job._id, {
      status: "error",
      error: args.error.slice(0, 500),
    });
    return null;
  },
});

export const applyTitle = internalMutation({
  args: {
    postId: v.id("posts"),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get("posts", args.postId);
    if (!post) {
      throw new Error("Post not found");
    }
    const title = args.title.trim();
    if (title.length === 0) {
      throw new Error("Title is required");
    }
    await ctx.db.patch("posts", post._id, {
      title: title.slice(0, 160),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const applySummary = internalMutation({
  args: {
    postId: v.id("posts"),
    asExcerpt: v.boolean(),
  },
  returns: aiJobValidator,
  handler: async (ctx, args) => {
    const post = await ctx.db.get("posts", args.postId);
    if (!post) {
      throw new Error("Post not found");
    }
    const job = await ctx.db
      .query("postAiJobs")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .first();
    if (!job || job.status !== "ready" || job.summary.length === 0) {
      throw new Error("No AI summary ready");
    }
    await ctx.db.patch("posts", post._id, {
      aiSummary: job.summary,
      ...(args.asExcerpt ? { excerpt: job.summary } : {}),
      updatedAt: Date.now(),
    });
    return {
      status: job.status,
      titles: job.titles,
      summary: job.summary,
      error: job.error,
    };
  },
});
