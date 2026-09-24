/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
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
    return await ctx.db.insert("users", {
      email,
      name: email,
      userType,
    });
  });
  const asUser = t.withIdentity({
    subject: `${userId}|testsession`,
    name: email,
  });
  return { userId, asUser };
}

const pageOpts = { numItems: 10, cursor: null as string | null };

describe("posts", () => {
  test("unauthenticated caller cannot create a post", async () => {
    const t = createT();
    await expect(t.mutation(api.posts.mutations.create, {})).rejects.toThrow(/Not authenticated/);
  });

  test("non-admin cannot create or list all posts", async () => {
    const t = createT();
    const { asUser } = await seedUser(t, "reader@example.com", "user");
    await expect(asUser.mutation(api.posts.mutations.create, {})).rejects.toThrow(/Forbidden/);
    await expect(
      asUser.query(api.posts.queries.listAll, { paginationOpts: pageOpts }),
    ).rejects.toThrow(/Forbidden/);
  });

  test("admin can create a draft that stays off the public list", async () => {
    const t = createT();
    const { asUser } = await seedUser(t, "admin@example.com", "admin");
    const postId = await asUser.mutation(api.posts.mutations.create, {});
    await asUser.mutation(api.posts.mutations.save, {
      postId,
      title: "Secret draft",
      excerpt: "n/a",
      body: "draft body about widgets",
      visibility: "listed",
      tags: ["notes"],
    });

    const listed = await t.query(api.posts.publicQueries.listPublished, {
      paginationOpts: pageOpts,
    });
    expect(listed.page).toEqual([]);

    const bySlug = await t.query(api.posts.publicQueries.getBySlug, {
      slug: "secret-draft",
    });
    expect(bySlug).toBeNull();

    const adminPublic = await asUser.query(api.posts.publicQueries.getBySlug, {
      slug: "secret-draft",
    });
    expect(adminPublic).toBeNull();

    const editorView = await asUser.query(api.posts.queries.getById, { postId });
    expect(editorView?.title).toBe("Secret draft");
    expect(editorView?.status).toBe("draft");

    const adminPreview = await asUser.query(api.posts.queries.getBySlug, {
      slug: "secret-draft",
    });
    expect(adminPreview?.title).toBe("Secret draft");
    expect(adminPreview?.status).toBe("draft");
    await expect(t.query(api.posts.queries.getBySlug, { slug: "secret-draft" })).rejects.toThrow(
      /Not authenticated/,
    );
  });

  test("unpublishing hides a post from public getBySlug", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    const postId = await admin.mutation(api.posts.mutations.create, {});
    await admin.mutation(api.posts.mutations.save, {
      postId,
      title: "Live then gone",
      excerpt: "",
      body: "visible then not",
      visibility: "listed",
      tags: [],
    });
    await admin.mutation(api.posts.mutations.setPublished, { postId, published: true });
    expect(
      (await t.query(api.posts.publicQueries.getBySlug, { slug: "live-then-gone" }))?.title,
    ).toBe("Live then gone");
    await admin.mutation(api.posts.mutations.setPublished, { postId, published: false });
    expect(await t.query(api.posts.publicQueries.getBySlug, { slug: "live-then-gone" })).toBeNull();
    expect(
      await admin.query(api.posts.publicQueries.getBySlug, { slug: "live-then-gone" }),
    ).toBeNull();
  });

  test("published listed posts appear publicly; unlisted published do not", async () => {
    const t = createT();
    const { asUser } = await seedUser(t, "admin@example.com", "admin");

    const listedId = await asUser.mutation(api.posts.mutations.create, {});
    await asUser.mutation(api.posts.mutations.save, {
      postId: listedId,
      title: "Public post",
      excerpt: "hello",
      body: "visible widgets",
      visibility: "listed",
      tags: ["news"],
    });
    await asUser.mutation(api.posts.mutations.setPublished, {
      postId: listedId,
      published: true,
    });

    const unlistedId = await asUser.mutation(api.posts.mutations.create, {});
    await asUser.mutation(api.posts.mutations.save, {
      postId: unlistedId,
      title: "Hidden post",
      excerpt: "shh",
      body: "unlisted widgets",
      visibility: "unlisted",
      tags: ["news"],
    });
    await asUser.mutation(api.posts.mutations.setPublished, {
      postId: unlistedId,
      published: true,
    });

    const listed = await t.query(api.posts.publicQueries.listPublished, {
      paginationOpts: pageOpts,
    });
    expect(listed.page.map((p: { title: string }) => p.title)).toEqual(["Public post"]);

    const unlisted = await t.query(api.posts.publicQueries.getBySlug, {
      slug: "hidden-post",
    });
    expect(unlisted?.title).toBe("Hidden post");
    expect(unlisted?.visibility).toBe("unlisted");

    const tagged = await t.query(api.posts.publicQueries.listByTag, {
      tag: "news",
      paginationOpts: pageOpts,
    });
    expect(tagged.page.map((p: { title: string }) => p.title)).toEqual(["Public post"]);
  });

  test("post navigation points to the adjacent published posts", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    for (const title of ["Old post", "Middle post", "New post"]) {
      const postId = await admin.mutation(api.posts.mutations.create, {});
      await admin.mutation(api.posts.mutations.save, {
        postId,
        title,
        excerpt: "",
        body: title,
        visibility: "listed",
        tags: [],
      });
      await admin.mutation(api.posts.mutations.setPublished, {
        postId,
        published: true,
      });
    }

    await expect(
      t.query(api.posts.publicQueries.getAdjacentBySlug, {
        slug: "middle-post",
      }),
    ).resolves.toEqual({
      previous: { title: "Old post", slug: "old-post" },
      next: { title: "New post", slug: "new-post" },
    });

    await admin.mutation(api.siteSettings.mutations.setBookmarksEnabled, {
      bookmarksEnabled: true,
    });
    const groupId = await admin.mutation(api.bookmarkGroups.mutations.create, {
      name: "Favorites",
    });
    const middle = await t.run(async (ctx) =>
      ctx.db
        .query("posts")
        .withIndex("by_slug", (q) => q.eq("slug", "middle-post"))
        .first(),
    );
    await admin.mutation(api.bookmarkGroupPosts.mutations.add, {
      groupId,
      postId: middle!._id,
    });
    await expect(
      t.query(api.posts.publicQueries.getAdjacentBySlug, {
        slug: "middle-post",
      }),
    ).resolves.toEqual({
      previous: { title: "Old post", slug: "old-post" },
      next: { title: "New post", slug: "new-post" },
    });
  });

  test("search only returns published listed posts", async () => {
    const t = createT();
    const { asUser } = await seedUser(t, "admin@example.com", "admin");

    const listedId = await asUser.mutation(api.posts.mutations.create, {});
    await asUser.mutation(api.posts.mutations.save, {
      postId: listedId,
      title: "Banana bread",
      excerpt: "",
      body: "a recipe for banana bread",
      visibility: "listed",
      tags: ["food"],
    });
    await asUser.mutation(api.posts.mutations.setPublished, {
      postId: listedId,
      published: true,
    });

    const unlistedId = await asUser.mutation(api.posts.mutations.create, {});
    await asUser.mutation(api.posts.mutations.save, {
      postId: unlistedId,
      title: "Banana secret",
      excerpt: "",
      body: "unlisted banana notes",
      visibility: "unlisted",
      tags: ["food"],
    });
    await asUser.mutation(api.posts.mutations.setPublished, {
      postId: unlistedId,
      published: true,
    });

    const hits = await t.query(api.posts.publicQueries.searchPublished, {
      query: "banana",
      tag: null,
    });
    expect(hits.map((p: { title: string }) => p.title)).toEqual(["Banana bread"]);
  });

  test("non-admin cannot upload assets", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    const { asUser: reader } = await seedUser(t, "reader@example.com", "user");
    await admin.mutation(api.posts.mutations.create, {});
    await expect(reader.mutation(api.postAssets.mutations.generateUploadUrl, {})).rejects.toThrow(
      /Forbidden/,
    );
  });

  test("non-admin cannot list assets for a post", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    const { asUser: reader } = await seedUser(t, "reader@example.com", "user");
    const postId = await admin.mutation(api.posts.mutations.create, {});
    await expect(reader.query(api.postAssets.queries.listForPost, { postId })).rejects.toThrow(
      /Forbidden/,
    );
  });

  test("admin can set image alt and description; non-admin cannot", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    const { asUser: reader } = await seedUser(t, "reader@example.com", "user");
    const postId = await admin.mutation(api.posts.mutations.create, {});
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["img"], { type: "image/png" }));
    });
    const assetId = await admin.mutation(api.postAssets.mutations.save, {
      postId,
      storageId,
      filename: "cat.png",
      contentType: "image/png",
      sha256: "a".repeat(64),
    });

    await expect(
      reader.mutation(api.postAssets.mutations.updateText, {
        assetId,
        alt: "stolen",
        description: "nope",
      }),
    ).rejects.toThrow(/Forbidden/);

    await admin.mutation(api.postAssets.mutations.updateText, {
      assetId,
      alt: "Orange cat",
      description: "Asleep on a windowsill",
    });

    const files = await admin.query(api.postAssets.queries.listForPost, {
      postId,
    });
    expect(files).toMatchObject([
      {
        filename: "cat.png",
        alt: "Orange cat",
        description: "Asleep on a windowsill",
      },
    ]);
    const detail = await admin.query(api.posts.queries.getById, { postId });
    expect(detail).not.toBeNull();
    expect(detail).not.toHaveProperty("assets");
  });

  test("channel posts are hidden from outsiders and visible to members", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    const { userId: parentId, asUser: parent } = await seedUser(t, "parent@example.com", "user");
    const { asUser: other } = await seedUser(t, "other@example.com", "user");

    const channelId = await admin.mutation(api.channels.mutations.create, {
      name: "parents",
    });
    await admin.mutation(api.channelMembers.mutations.add, {
      channelId,
      userId: parentId,
    });

    const postId = await admin.mutation(api.posts.mutations.create, {});
    await admin.mutation(api.posts.mutations.save, {
      postId,
      title: "For parents only",
      excerpt: "private",
      body: "channel widgets",
      visibility: "listed",
      tags: ["family"],
      channelIds: [channelId],
    });
    await admin.mutation(api.posts.mutations.setPublished, {
      postId,
      published: true,
    });

    const publicPostId = await admin.mutation(api.posts.mutations.create, {});
    await admin.mutation(api.posts.mutations.save, {
      postId: publicPostId,
      title: "Open post",
      excerpt: "hello",
      body: "public widgets",
      visibility: "listed",
      tags: ["family"],
      channelIds: [],
    });
    await admin.mutation(api.posts.mutations.setPublished, {
      postId: publicPostId,
      published: true,
    });

    const anonList = await t.query(api.posts.publicQueries.listPublished, {
      paginationOpts: pageOpts,
    });
    expect(anonList.page.map((p: { title: string }) => p.title)).toEqual(["Open post"]);
    expect(
      await t.query(api.posts.publicQueries.getBySlug, {
        slug: "for-parents-only",
      }),
    ).toBeNull();
    expect(
      await t.query(api.posts.publicQueries.searchPublished, {
        query: "widgets",
        tag: null,
      }),
    ).toMatchObject([{ title: "Open post" }]);

    const otherList = await other.query(api.posts.publicQueries.listPublished, {
      paginationOpts: pageOpts,
    });
    expect(otherList.page.map((p: { title: string }) => p.title)).toEqual(["Open post"]);
    expect(
      await other.query(api.posts.publicQueries.getBySlug, {
        slug: "for-parents-only",
      }),
    ).toBeNull();

    const parentList = await parent.query(api.posts.publicQueries.listPublished, {
      paginationOpts: pageOpts,
    });
    expect(parentList.page.map((p: { title: string }) => p.title)).toEqual([
      "Open post",
      "For parents only",
    ]);
    expect(
      (
        await parent.query(api.posts.publicQueries.getBySlug, {
          slug: "for-parents-only",
        })
      )?.title,
    ).toBe("For parents only");

    await expect(other.mutation(api.channels.mutations.create, { name: "stolen" })).rejects.toThrow(
      /Forbidden/,
    );
  });

  test("non-admin cannot request AI suggestions; admin can apply a completed job", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    const { asUser: reader } = await seedUser(t, "reader@example.com", "user");
    const postId = await admin.mutation(api.posts.mutations.create, {});
    await admin.mutation(api.posts.mutations.save, {
      postId,
      title: "Draft",
      excerpt: "",
      body: "A long article about widgets and parents.",
      visibility: "listed",
      tags: [],
    });

    await expect(reader.mutation(api.postAi.mutations.request, { postId })).rejects.toThrow(
      /Forbidden/,
    );

    await t.mutation(internal.postAi.internal.start, { postId });
    await t.mutation(internal.postAi.internal.complete, {
      postId,
      titles: ["Widgets for parents", "A widget guide"],
      summary: "A short guide to widgets.",
    });

    await admin.mutation(api.postAi.mutations.applyTitle, {
      postId,
      title: "Widgets for parents",
    });
    await admin.mutation(api.postAi.mutations.applySummary, {
      postId,
      asExcerpt: true,
    });

    const detail = await admin.query(api.posts.queries.getById, { postId });
    expect(detail?.title).toBe("Widgets for parents");
    expect(detail?.excerpt).toBe("A short guide to widgets.");
    expect(detail?.aiSummary).toBe("A short guide to widgets.");
    expect(detail?.ai).toMatchObject({
      status: "ready",
      titles: ["Widgets for parents", "A widget guide"],
    });
  });

  test("duplicate files on a post reuse one storage object and one asset row", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    const { asUser: reader } = await seedUser(t, "reader@example.com", "user");
    const postId = await admin.mutation(api.posts.mutations.create, {});
    const hash = "b".repeat(64);
    const firstStorage = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["same-bytes"], { type: "image/png" }));
    });
    const secondStorage = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["same-bytes"], { type: "image/png" }));
    });

    await expect(
      reader.query(api.postAssets.queries.findByHash, { postId, sha256: hash }),
    ).rejects.toThrow(/Forbidden/);

    const first = await admin.mutation(api.postAssets.mutations.save, {
      postId,
      storageId: firstStorage,
      filename: "a.png",
      contentType: "image/png",
      sha256: hash,
    });
    expect(
      await admin.query(api.postAssets.queries.findByHash, {
        postId,
        sha256: hash,
      }),
    ).toBe(first);

    const second = await admin.mutation(api.postAssets.mutations.save, {
      postId,
      storageId: secondStorage,
      filename: "b.png",
      contentType: "image/png",
      sha256: hash,
    });
    expect(second).toBe(first);

    const files = await admin.query(api.postAssets.queries.listForPost, {
      postId,
    });
    expect(files).toHaveLength(1);
    expect(files[0]._id).toBe(first);

    const leftover = await t.run(async (ctx) => {
      return await ctx.db.system.get("_storage", secondStorage);
    });
    expect(leftover).toBeNull();
  });

  test("backfillSha256 copies storage checksums onto existing assets", async () => {
    const t = createT();
    const postId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "admin@example.com",
        name: "admin",
        userType: "admin",
      });
      const storageId = await ctx.storage.store(new Blob(["hashed"], { type: "image/png" }));
      const id = await ctx.db.insert("posts", {
        title: "t",
        slug: "t",
        excerpt: "",
        body: "b",
        status: "draft",
        visibility: "listed",
        publishedAt: null,
        authorId: userId,
        updatedAt: Date.now(),
        coverImageId: null,
        searchText: "",
      });
      await ctx.db.insert("postAssets", {
        postId: id,
        storageId,
        filename: "x.png",
        contentType: "image/png",
      });
      return id;
    });
    const result = await t.mutation(internal.postAssets.internal.backfillSha256, {});
    expect(result.updated).toBe(1);
    const detail = await t.run(async (ctx) => {
      return await ctx.db
        .query("postAssets")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .first();
    });
    expect(detail?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  test("images-only does not change public query or API payloads", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const postId = await asAdmin.mutation(api.posts.mutations.create, {});
    const body = [
      "A secret paragraph.",
      "",
      "![leaky alt](https://cdn.example/pic.jpg)",
      "",
      "https://youtu.be/abcdefghijk",
    ].join("\n");
    await asAdmin.mutation(api.posts.mutations.save, {
      postId,
      title: "Photo essay",
      excerpt: "secret excerpt",
      body,
      visibility: "listed",
      tags: ["secrets"],
    });
    await asAdmin.mutation(api.posts.mutations.setPublished, {
      postId,
      published: true,
    });
    await asAdmin.mutation(api.features.mutations.set, { imagesOnly: true });

    const listed = await t.query(api.posts.publicQueries.listPublished, {
      paginationOpts: pageOpts,
    });
    expect(listed.page).toMatchObject([
      { title: "Photo essay", excerpt: "secret excerpt", tags: ["secrets"], slug: "photo-essay" },
    ]);

    const anonymous = await t.query(api.posts.publicQueries.getBySlug, {
      slug: "photo-essay",
    });
    expect(anonymous).toMatchObject({
      title: "Photo essay",
      excerpt: "secret excerpt",
      tags: ["secrets"],
      body,
    });
  });

  test("timeline sort defaults to created and can switch to last updated", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");

    const olderId = await admin.mutation(api.posts.mutations.create, {});
    await admin.mutation(api.posts.mutations.save, {
      postId: olderId,
      title: "Older created",
      excerpt: "",
      body: "first",
      visibility: "listed",
      tags: ["order"],
    });
    await admin.mutation(api.posts.mutations.setPublished, {
      postId: olderId,
      published: true,
    });

    const newerId = await admin.mutation(api.posts.mutations.create, {});
    await admin.mutation(api.posts.mutations.save, {
      postId: newerId,
      title: "Newer created",
      excerpt: "",
      body: "second",
      visibility: "listed",
      tags: ["order"],
    });
    await admin.mutation(api.posts.mutations.setPublished, {
      postId: newerId,
      published: true,
    });

    const byCreated = await t.query(api.posts.publicQueries.listPublished, {
      paginationOpts: pageOpts,
    });
    expect(byCreated.page.map((post: { title: string }) => post.title)).toEqual([
      "Newer created",
      "Older created",
    ]);

    await t.run(async (ctx) => {
      await ctx.db.patch("posts", olderId, { updatedAt: Date.now() + 60_000 });
    });
    await admin.mutation(api.features.mutations.set, { sortOrder: "updated" });

    const byUpdated = await t.query(api.posts.publicQueries.listPublished, {
      paginationOpts: pageOpts,
    });
    expect(byUpdated.page.map((post: { title: string }) => post.title)).toEqual([
      "Older created",
      "Newer created",
    ]);
  });

  test("setTimes updates created and updated timestamps", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    const postId = await admin.mutation(api.posts.mutations.create, {});
    await admin.mutation(api.posts.mutations.save, {
      postId,
      title: "Dated",
      excerpt: "",
      body: "body",
      visibility: "listed",
      tags: [],
    });
    await admin.mutation(api.posts.mutations.setPublished, { postId, published: true });
    const createdAt = Date.parse("2020-01-02T03:04:00Z");
    const updatedAt = Date.parse("2021-05-06T07:08:00Z");
    await admin.mutation(api.posts.mutations.setTimes, { postId, createdAt, updatedAt });
    const post = await t.query(api.posts.publicQueries.getBySlug, { slug: "dated" });
    expect(post?.createdAt).toBe(createdAt);
    expect(post?.updatedAt).toBe(updatedAt);
  });

  describe("scheduled publishing", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    async function seedPublished(t: ReturnType<typeof createT>) {
      const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
      const postId = await admin.mutation(api.posts.mutations.create, {});
      await admin.mutation(api.posts.mutations.save, {
        postId,
        title: "Later",
        excerpt: "",
        body: "scheduled body",
        visibility: "listed",
        tags: ["soon"],
      });
      await admin.mutation(api.posts.mutations.setPublished, { postId, published: true });
      return { admin, postId };
    }

    async function publicView(t: ReturnType<typeof createT>) {
      const post = await t.query(api.posts.publicQueries.getBySlug, { slug: "later" });
      const listed = await t.query(api.posts.publicQueries.listPublished, {
        paginationOpts: pageOpts,
      });
      const tagged = await t.query(api.posts.publicQueries.listByTag, {
        tag: "soon",
        paginationOpts: pageOpts,
      });
      return { post, listed: listed.page.length, tagged: tagged.page.length };
    }

    test("a future published date hides the post until the scheduled time", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
      const t = createT();
      const { admin, postId } = await seedPublished(t);
      const now = Date.now();
      const publishAt = now + 60 * 60 * 1000;

      await admin.mutation(api.posts.mutations.setTimes, {
        postId,
        createdAt: now,
        updatedAt: now,
        publishedAt: publishAt,
      });
      expect(await publicView(t)).toEqual({ post: null, listed: 0, tagged: 0 });
      const preview = await admin.query(api.posts.queries.getBySlug, { slug: "later" });
      expect(preview).toMatchObject({ status: "scheduled", publishedAt: publishAt });

      vi.setSystemTime(publishAt);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const view = await publicView(t);
      expect(view.post).toMatchObject({ status: "published", publishedAt: publishAt });
      expect(view.listed).toBe(1);
      expect(view.tagged).toBe(1);
    });

    test("moving the date back to the past publishes immediately and old jobs no-op", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
      const t = createT();
      const { admin, postId } = await seedPublished(t);
      const now = Date.now();
      await admin.mutation(api.posts.mutations.setTimes, {
        postId,
        createdAt: now,
        updatedAt: now,
        publishedAt: now + 60 * 60 * 1000,
      });
      await admin.mutation(api.posts.mutations.setTimes, {
        postId,
        createdAt: now,
        updatedAt: now,
        publishedAt: now - 1000,
      });
      expect((await publicView(t)).post).toMatchObject({ publishedAt: now - 1000 });

      await admin.mutation(api.posts.mutations.setPublished, { postId, published: false });
      vi.setSystemTime(now + 2 * 60 * 60 * 1000);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect((await publicView(t)).post).toBeNull();
    });

    test("a draft with a future date is scheduled when published", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-24T12:00:00Z"));
      const t = createT();
      const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
      const postId = await admin.mutation(api.posts.mutations.create, {});
      await admin.mutation(api.posts.mutations.save, {
        postId,
        title: "Later",
        excerpt: "",
        body: "b",
        visibility: "listed",
        tags: [],
      });
      const now = Date.now();
      await admin.mutation(api.posts.mutations.setTimes, {
        postId,
        createdAt: now,
        updatedAt: now,
        publishedAt: now + 60_000,
      });
      await admin.mutation(api.posts.mutations.setPublished, { postId, published: true });
      expect((await publicView(t)).post).toBeNull();
      vi.setSystemTime(now + 60_000);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect((await publicView(t)).post).toMatchObject({ status: "published" });
    });
  });

  test("createdAt backfill copies _creationTime and then no-ops", async () => {
    const t = createT();
    const ids = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "admin@example.com",
        name: "admin",
        userType: "admin",
      });
      const postId = await ctx.db.insert("posts", {
        title: "Old",
        slug: "old",
        excerpt: "",
        body: "b",
        status: "published",
        visibility: "listed",
        publishedAt: Date.now(),
        authorId: userId,
        updatedAt: Date.now(),
        coverImageId: null,
        searchText: "old",
      });
      return { postId, creationTime: (await ctx.db.get("posts", postId))!._creationTime };
    });
    await t.mutation(internal.migrations.backfillPostsCreatedAt, {
      cursor: null,
    });
    const post = await t.run(async (ctx) => ctx.db.get("posts", ids.postId));
    expect(post?.createdAt).toBe(ids.creationTime);
    const state = await t.run(async (ctx) =>
      ctx.db
        .query("migrationState")
        .withIndex("by_name", (q) => q.eq("name", "posts.createdAt"))
        .unique(),
    );
    expect(state?.done).toBe(true);
    await t.mutation(internal.migrations.backfillPostsCreatedAt, { cursor: null });
    const again = await t.run(async (ctx) => ctx.db.get("posts", ids.postId));
    expect(again?.createdAt).toBe(ids.creationTime);
  });

  test("publishedByDay backfill inserts existing listed published posts", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    await admin.mutation(api.features.mutations.set, { calendar: true });
    const publishedAt = Date.now();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "author@example.com",
        name: "author",
        userType: "admin",
      });
      await ctx.db.insert("posts", {
        title: "Old",
        slug: "old-listed",
        excerpt: "",
        body: "b",
        status: "published",
        visibility: "listed",
        publishedAt,
        authorId: userId,
        updatedAt: publishedAt,
        coverImageId: null,
        searchText: "old",
      });
    });
    const window = { start: publishedAt - 60_000, end: publishedAt + 60_000 };
    expect(
      await t.query(api.posts.publicQueries.countPublishedDays, { days: [window] }),
    ).toEqual([0]);
    await t.mutation(internal.migrations.backfillPublishedByDay, { cursor: null });
    expect(
      await t.query(api.posts.publicQueries.countPublishedDays, { days: [window] }),
    ).toEqual([1]);
    const state = await t.run(async (ctx) =>
      ctx.db
        .query("migrationState")
        .withIndex("by_name", (q) => q.eq("name", "posts.publishedByDay"))
        .unique(),
    );
    expect(state?.done).toBe(true);
  });

  test("publishedAt backfill copies createdAt onto published posts and moves calendar days", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    await admin.mutation(api.features.mutations.set, { calendar: true });
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const createdAt = now - 10 * day;
    const ids = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "author@example.com",
        name: "author",
        userType: "admin",
      });
      const base = {
        excerpt: "",
        body: "b",
        visibility: "listed" as const,
        authorId: userId,
        updatedAt: now,
        coverImageId: null,
        searchText: "b",
      };
      const published = await ctx.db.insert("posts", {
        ...base,
        title: "Published",
        slug: "published",
        status: "published",
        publishedAt: now,
        createdAt,
      });
      const future = await ctx.db.insert("posts", {
        ...base,
        title: "Future created",
        slug: "future-created",
        status: "published",
        publishedAt: now,
        createdAt: now + 10 * day,
      });
      const draft = await ctx.db.insert("posts", {
        ...base,
        title: "Draft",
        slug: "draft",
        status: "draft",
        publishedAt: null,
        createdAt,
      });
      return { published, future, draft };
    });
    await t.mutation(internal.migrations.backfillPublishedByDay, { cursor: null });

    await t.mutation(internal.migrations.backfillPublishedAtFromCreatedAt, { cursor: null });
    const [published, future, draft] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.get("posts", ids.published),
        ctx.db.get("posts", ids.future),
        ctx.db.get("posts", ids.draft),
      ]),
    );
    expect(published).toMatchObject({ status: "published", publishedAt: createdAt });
    expect(future).toMatchObject({ status: "published", publishedAt: now });
    expect(draft?.publishedAt).toBeNull();
    const oldDay = { start: createdAt - 60_000, end: createdAt + 60_000 };
    const today = { start: now - 60_000, end: now + 60_000 };
    expect(
      await t.query(api.posts.publicQueries.countPublishedDays, { days: [oldDay, today] }),
    ).toEqual([1, 1]);
  });

  test("admin can delete a draft and its files; published posts stay", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    const { asUser: reader } = await seedUser(t, "reader@example.com", "user");
    const postId = await admin.mutation(api.posts.mutations.create, {});
    await admin.mutation(api.posts.mutations.save, {
      postId,
      title: "Throwaway",
      excerpt: "",
      body: "draft body",
      visibility: "listed",
      tags: ["notes"],
    });
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["img"], { type: "image/png" }));
    });
    await admin.mutation(api.postAssets.mutations.save, {
      postId,
      storageId,
      filename: "cat.png",
      contentType: "image/png",
      sha256: "b".repeat(64),
    });
    await expect(reader.action(api.posts.actions.remove, { postId })).rejects.toThrow(/Forbidden/);
    await admin.action(api.posts.actions.remove, { postId });
    expect(await admin.query(api.posts.queries.getById, { postId })).toBeNull();
    const leftover = await t.run(async (ctx) => {
      const assets = await ctx.db
        .query("postAssets")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .collect();
      const tags = await ctx.db
        .query("postTags")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .collect();
      const blob = await ctx.db.system.get("_storage", storageId);
      return { assets: assets.length, tags: tags.length, blob };
    });
    expect(leftover).toEqual({ assets: 0, tags: 0, blob: null });

    const liveId = await admin.mutation(api.posts.mutations.create, {});
    await admin.mutation(api.posts.mutations.save, {
      postId: liveId,
      title: "Keep me",
      excerpt: "",
      body: "published",
      visibility: "listed",
      tags: [],
    });
    await admin.mutation(api.posts.mutations.setPublished, { postId: liveId, published: true });
    await expect(admin.action(api.posts.actions.remove, { postId: liveId })).rejects.toThrow(
      /Published posts cannot be deleted/,
    );
    expect((await admin.query(api.posts.queries.getById, { postId: liveId }))?.title).toBe(
      "Keep me",
    );
  });
});
