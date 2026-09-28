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

describe("draft read receipts", () => {
  test("admin sees draft unread, then read, then updated-since-read, tracked apart from posts", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    await admin.mutation(api.features.mutations.set, { readReceipts: true });
    const postId = await admin.mutation(api.posts.mutations.create, {});
    await admin.mutation(api.posts.mutations.save, {
      postId,
      title: "Wip",
      excerpt: "",
      body: "hello",
      visibility: "listed",
      tags: [],
    });

    const first = await admin.query(api.posts.queries.listDrafts, { paginationOpts: pageOpts });
    expect(first.page[0]?.read).toMatchObject({ unread: true, updatedSinceRead: false });
    const preview = await admin.query(api.posts.queries.getBySlug, { slug: "wip" });
    expect(preview?.read?.unread).toBe(true);

    await admin.mutation(api.draftReads.mutations.markRead, { postId });
    const afterRead = await admin.query(api.posts.queries.listDrafts, { paginationOpts: pageOpts });
    expect(afterRead.page[0]?.read).toMatchObject({ unread: false, updatedSinceRead: false });

    await t.run(async (ctx) => {
      await ctx.db.patch("posts", postId, { updatedAt: Date.now() + 60_000, body: "changed" });
    });
    const updated = await admin.query(api.posts.queries.listDrafts, { paginationOpts: pageOpts });
    expect(updated.page[0]?.read).toMatchObject({ unread: false, updatedSinceRead: true });

    const postReads = await t.run(async (ctx) => await ctx.db.query("postReads").collect());
    expect(postReads).toHaveLength(0);

    await admin.mutation(api.draftReads.mutations.markAllRead, {});
    await t.run(async (ctx) => {
      await ctx.db.patch("posts", postId, { updatedAt: Date.now() - 1_000 });
    });
    const afterAll = await admin.query(api.posts.queries.listDrafts, { paginationOpts: pageOpts });
    expect(afterAll.page[0]?.read).toMatchObject({ unread: false, updatedSinceRead: false });
  });

  test("draft reads are off when the feature is off and rejected for non-admins", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    const { asUser: reader } = await seedUser(t, "reader@example.com", "user");
    const postId = await admin.mutation(api.posts.mutations.create, {});
    const off = await admin.query(api.posts.queries.listDrafts, { paginationOpts: pageOpts });
    expect(off.page[0]?.read).toBeNull();
    await admin.mutation(api.draftReads.mutations.markRead, { postId });
    await expect(reader.mutation(api.draftReads.mutations.markRead, { postId })).rejects.toThrow();
  });
});
