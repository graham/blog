/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function createT() {
  return convexTest(schema, modules);
}

async function seedUser(t: ReturnType<typeof createT>, email: string, userType: string) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", { email, name: email, userType });
  });
  return {
    userId,
    asUser: t.withIdentity({ subject: `${userId}|testsession`, name: email }),
  };
}

const pageOpts = { numItems: 20, cursor: null as string | null };

describe("read receipts", () => {
  test("logged-in reader sees unread, then last-read, then updated-since-read", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    const { asUser: reader } = await seedUser(t, "reader@example.com", "user");
    await admin.mutation(api.features.mutations.set, { readReceipts: true });
    const postId = await admin.mutation(api.posts.mutations.create, {});
    await admin.mutation(api.posts.mutations.save, {
      postId,
      title: "Note",
      excerpt: "",
      body: "hello",
      visibility: "listed",
      tags: [],
    });
    await admin.mutation(api.posts.mutations.setPublished, { postId, published: true });

    const first = await reader.query(api.posts.publicQueries.listPublished, {
      paginationOpts: pageOpts,
    });
    expect(first.page[0]?.read).toMatchObject({ unread: true, updatedSinceRead: false });

    await reader.mutation(api.postReads.mutations.markRead, { postId });
    const afterRead = await reader.query(api.posts.publicQueries.getBySlug, { slug: "note" });
    expect(afterRead?.read?.unread).toBe(false);
    expect(afterRead?.read?.updatedSinceRead).toBe(false);

    await t.run(async (ctx) => {
      await ctx.db.patch("posts", postId, { updatedAt: Date.now() + 60_000, body: "hello again" });
    });
    const updated = await reader.query(api.posts.publicQueries.getBySlug, { slug: "note" });
    expect(updated?.read?.updatedSinceRead).toBe(true);

    await reader.mutation(api.postReads.mutations.markAllRead, {});
    await t.run(async (ctx) => {
      await ctx.db.patch("posts", postId, { updatedAt: Date.now() - 1_000 });
    });
    const afterAll = await reader.query(api.posts.publicQueries.listPublished, {
      paginationOpts: pageOpts,
    });
    expect(afterAll.page[0]?.read).toMatchObject({ unread: false, updatedSinceRead: false });
  });

  test("unreadOnly skips read posts and is done when nothing unread remains", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    const { asUser: reader } = await seedUser(t, "reader@example.com", "user");
    await admin.mutation(api.features.mutations.set, { readReceipts: true });

    const ids = [];
    for (const title of ["One", "Two", "Three"]) {
      const postId = await admin.mutation(api.posts.mutations.create, {});
      await admin.mutation(api.posts.mutations.save, {
        postId,
        title,
        excerpt: "",
        body: title,
        visibility: "listed",
        tags: [],
      });
      await admin.mutation(api.posts.mutations.setPublished, { postId, published: true });
      ids.push(postId);
    }

    await reader.mutation(api.postReads.mutations.markRead, { postId: ids[1] });
    await reader.mutation(api.postReads.mutations.markRead, { postId: ids[2] });

    const unread = await reader.query(api.posts.publicQueries.listPublished, {
      paginationOpts: { numItems: 2, cursor: null },
      unreadOnly: true,
    });
    expect(unread.page.map((post) => post.title)).toEqual(["One"]);
    expect(unread.isDone).toBe(true);

    await reader.mutation(api.postReads.mutations.markRead, { postId: ids[0] });
    const empty = await reader.query(api.posts.publicQueries.listPublished, {
      paginationOpts: { numItems: 2, cursor: null },
      unreadOnly: true,
    });
    expect(empty.page).toEqual([]);
    expect(empty.isDone).toBe(true);
  });
});
