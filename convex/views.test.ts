/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { registerAggregate } from "../tests/registerAggregate";

const modules = import.meta.glob("./**/*.ts");

function createT() {
  const t = convexTest(schema, modules);
  registerAggregate(t);
  return t;
}

type T = ReturnType<typeof createT>;

async function seed(t: T) {
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      email: "admin@example.com",
      name: "admin",
      userType: "admin",
    });
    const storageId = await ctx.storage.store(new Blob(["image"]));
    const post = (slug: string, status: "published" | "draft", body: string) =>
      ctx.db.insert("posts", {
        title: slug,
        slug,
        excerpt: "",
        body,
        status,
        visibility: "listed",
        publishedAt: status === "published" ? now : null,
        createdAt: now,
        updatedAt: now,
        authorId: userId,
        coverImageId: null,
        searchText: slug,
      });
    const postId = await post("first", "published", `![a](convex://${storageId})`);
    await ctx.db.insert("postAssets", {
      postId,
      storageId,
      filename: "a.jpg",
      contentType: "image/jpeg",
    });
    const otherId = await post("second", "published", "text");
    const draftId = await post("draft", "draft", "text");
    const src = (await ctx.storage.getUrl(storageId))!;
    return { userId, postId, otherId, draftId, src };
  });
  return { ...ids, admin: t.withIdentity({ subject: `${ids.userId}|testsession` }) };
}

describe("view counts", () => {
  test("posts and images default to 0 and count every view", async () => {
    const t = createT();
    const { postId, src } = await seed(t);
    expect(await t.query(api.postViews.publicQueries.getCount, { postId })).toBe(0);
    expect(await t.query(api.imageViews.publicQueries.getCount, { postId, src })).toBe(0);

    await t.mutation(api.postViews.publicMutations.record, { postId });
    await t.mutation(api.postViews.publicMutations.record, { postId });
    await t.mutation(api.imageViews.publicMutations.record, { postId, src });

    expect(await t.query(api.postViews.publicQueries.getCount, { postId })).toBe(2);
    expect(await t.query(api.imageViews.publicQueries.getCount, { postId, src })).toBe(1);
  });

  test("drafts and images outside the post are not counted", async () => {
    const t = createT();
    const { postId, draftId } = await seed(t);
    await t.mutation(api.postViews.publicMutations.record, { postId: draftId });
    await t.mutation(api.imageViews.publicMutations.record, {
      postId,
      src: "https://example.com/elsewhere.jpg",
    });
    const rows = await t.run(async (ctx) => ({
      posts: await ctx.db.query("postViews").collect(),
      images: await ctx.db.query("imageViews").collect(),
    }));
    expect(rows.posts).toHaveLength(0);
    expect(rows.images).toHaveLength(0);
  });

  test("admin lists are sorted by count and paginated", async () => {
    const t = createT();
    const { postId, otherId, src, admin } = await seed(t);
    await t.mutation(api.postViews.publicMutations.record, { postId });
    for (let i = 0; i < 3; i += 1) {
      await t.mutation(api.postViews.publicMutations.record, { postId: otherId });
    }
    await t.mutation(api.imageViews.publicMutations.record, { postId, src });

    await expect(
      t.query(api.postViews.queries.listByCount, {
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow(/Not authenticated/);

    const first = await admin.query(api.postViews.queries.listByCount, {
      paginationOpts: { numItems: 1, cursor: null },
    });
    expect(first.page.map((row) => [row.slug, row.count])).toEqual([["second", 3]]);
    const second = await admin.query(api.postViews.queries.listByCount, {
      paginationOpts: { numItems: 1, cursor: first.continueCursor },
    });
    expect(second.page.map((row) => [row.slug, row.count])).toEqual([["first", 1]]);

    const images = await admin.query(api.imageViews.queries.listByCount, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(images.page.map((row) => [row.src, row.slug, row.count])).toEqual([
      [src, "first", 1],
    ]);
  });
});
