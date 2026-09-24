import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import type { DataModel, Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const publishedByDay = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "posts";
}>(components.publishedByDay, {
  sortKey: (doc) => doc.publishedAt ?? 0,
});

export function isListedPublished(post: Doc<"posts">): boolean {
  return post.status === "published" && post.visibility === "listed" && post.publishedAt !== null;
}

export async function syncPublishedByDay(
  ctx: MutationCtx,
  oldDoc: Doc<"posts"> | null,
  newDoc: Doc<"posts"> | null,
): Promise<void> {
  const was = oldDoc !== null && isListedPublished(oldDoc);
  const is = newDoc !== null && isListedPublished(newDoc);
  if (was && is) {
    if (oldDoc.publishedAt !== newDoc.publishedAt) {
      await publishedByDay.replaceOrInsert(ctx, oldDoc, newDoc);
    }
    return;
  }
  if (is) {
    await publishedByDay.insertIfDoesNotExist(ctx, newDoc);
    return;
  }
  if (was) {
    await publishedByDay.deleteIfExists(ctx, oldDoc);
  }
}

export function dayCountQueries(days: Array<{ start: number; end: number }>) {
  return days.map((day) => {
    const start = Math.min(day.start, day.end);
    const end = Math.max(day.start, day.end);
    return {
      bounds: {
        lower: { key: start, inclusive: true as const },
        upper: { key: end, inclusive: false as const },
      },
    };
  });
}
