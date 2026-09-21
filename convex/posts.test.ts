/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");

function createT() {
  return convexTest(schema, modules);
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

    const adminView = await asUser.query(api.posts.publicQueries.getBySlug, {
      slug: "secret-draft",
    });
    expect(adminView?.title).toBe("Secret draft");
    expect(adminView?.status).toBe("draft");
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
});
