import { v } from "convex/values";
import { generateText } from "ai";
import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

function parseSuggestion(text: string): { titles: string[]; summary: string } {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed: unknown = JSON.parse(trimmed);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("AI returned invalid JSON");
  }
  const record = parsed as Record<string, unknown>;
  const titles = Array.isArray(record.titles)
    ? record.titles.filter((title): title is string => typeof title === "string")
    : [];
  const summary = typeof record.summary === "string" ? record.summary : "";
  if (titles.length === 0 || summary.trim().length === 0) {
    throw new Error("AI did not return titles and a summary");
  }
  return { titles, summary };
}

export const generate = internalAction({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const post: { title: string; body: string; excerpt: string } | null =
        await ctx.runQuery(internal.posts.internal.getDraftForAi, {
          postId: args.postId,
        });
      if (!post) {
        throw new Error("Post not found");
      }
      const draft = [post.title, post.excerpt, post.body]
        .filter((part) => part.trim().length > 0)
        .join("\n\n")
        .slice(0, 6000);
      if (draft.trim().length === 0) {
        throw new Error("Write some post content first");
      }
      const { text } = await generateText({
        model: convexGateway("x-ai/grok-4.5"),
        prompt: `You help a blog editor. Propose 3 short titles and one 1-2 sentence summary for this draft.

Return ONLY JSON with this shape:
{"titles":["...","...","..."],"summary":"..."}

Draft:
${draft}`,
      });
      const suggestion = parseSuggestion(text);
      await ctx.runMutation(internal.postAi.internal.complete, {
        postId: args.postId,
        titles: suggestion.titles,
        summary: suggestion.summary,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI generation failed";
      await ctx.runMutation(internal.postAi.internal.fail, {
        postId: args.postId,
        error: message,
      });
      throw error;
    }
    return null;
  },
});

export const remove = action({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.posts.internal.assertAdmin, {});
    const storageIds: Id<"_storage">[] = await ctx.runMutation(internal.posts.internal.remove, {
      postId: args.postId,
    });
    for (const storageId of storageIds) {
      try {
        await ctx.storage.delete(storageId);
      } catch (error) {
        console.error("Failed to delete post file", storageId, error);
      }
    }
    return null;
  },
});
