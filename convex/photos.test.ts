/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { registerAggregate } from "../tests/registerAggregate";

const modules = import.meta.glob("./**/*.ts");

function createT() {
  const t = convexTest(schema, modules);
  registerAggregate(t);
  return t;
}

type T = ReturnType<typeof createT>;

async function seedUser(t: T, email: string, userType: string) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email, name: email, userType }),
  );
  return { userId, asUser: t.withIdentity({ subject: `${userId}|testsession` }) };
}

// Inserts a listed published post whose cover is its first image and whose
// body references the rest, plus one video that must never show as a photo.
async function seedPost(
  t: T,
  authorId: Id<"users">,
  slug: string,
  publishedAt: number,
  imageCount: number,
) {
  return await t.run(async (ctx) => {
    const postId = await ctx.db.insert("posts", {
      title: slug,
      slug,
      excerpt: "",
      body: "",
      status: "published",
      visibility: "listed",
      publishedAt,
      createdAt: publishedAt,
      authorId,
      updatedAt: publishedAt,
      coverImageId: null,
      searchText: slug,
    });
    const storageIds: Id<"_storage">[] = [];
    for (let index = 0; index < imageCount; index += 1) {
      const storageId = await ctx.storage.store(new Blob([`${slug}-${index}`]));
      await ctx.db.insert("postAssets", {
        postId,
        storageId,
        filename: `${slug}-${index}.jpg`,
        contentType: "image/jpeg",
        alt: `${slug} ${index}`,
      });
      storageIds.push(storageId);
    }
    const video = await ctx.storage.store(new Blob([`${slug}-video`]));
    await ctx.db.insert("postAssets", {
      postId,
      storageId: video,
      filename: `${slug}.mp4`,
      contentType: "video/mp4",
    });
    const [cover, ...rest] = storageIds;
    const body = [
      ...rest.map((id) => `![image](convex://${id})`),
      `![clip](convex://${video})`,
    ].join("\n\n");
    await ctx.db.patch("posts", postId, { coverImageId: cover ?? null, body });
    return postId;
  });
}

describe("photos", () => {
  test("returns nothing while the feature is off", async () => {
    const t = createT();
    const { userId } = await seedUser(t, "admin@example.com", "admin");
    await seedPost(t, userId, "one", Date.now(), 3);
    const page = await t.query(api.posts.publicQueries.listPhotos, { cursor: null });
    expect(page).toEqual({ photos: [], nextCursor: null });
  });

  test("pages 24 photos at a time newest first, splitting a post across pages", async () => {
    const t = createT();
    const { userId, asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    await admin.mutation(api.features.mutations.set, { photos: "on" });
    const now = Date.now();
    await seedPost(t, userId, "older", now - 2000, 15);
    await seedPost(t, userId, "newer", now - 1000, 21);
    await seedPost(t, userId, "text-only", now - 1500, 0);

    const first = await t.query(api.posts.publicQueries.listPhotos, { cursor: null });
    expect(first.photos).toHaveLength(24);
    expect(first.photos.slice(0, 21).every((photo) => photo.slug === "newer")).toBe(true);
    expect(first.photos[0].alt).toBe("newer 0");
    expect(first.photos.slice(21).map((photo) => photo.alt)).toEqual([
      "older 0",
      "older 1",
      "older 2",
    ]);
    expect(first.photos.every((photo) => photo.seen === null)).toBe(true);
    expect(first.nextCursor).toMatchObject({ skip: 3 });
    expect(first.photos[0].postPhotoCount).toBe(21);
    expect(first.photos[23].postPhotoCount).toBe(15);

    const second = await t.query(api.posts.publicQueries.listPhotos, {
      cursor: first.nextCursor,
    });
    expect(second.photos.map((photo) => photo.alt)).toEqual(
      Array.from({ length: 12 }, (_, index) => `older ${index + 3}`),
    );
    expect(second.nextCursor).toBeNull();
  });

  test("anonymous visitors see photos only when the settings allow it", async () => {
    const t = createT();
    const { userId, asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    await seedPost(t, userId, "public", Date.now(), 2);
    const anonymousCount = async () =>
      (await t.query(api.posts.publicQueries.listPhotos, { cursor: null })).photos.length;

    await admin.mutation(api.features.mutations.set, { photos: "on" });
    expect(await anonymousCount()).toBe(2);

    await admin.mutation(api.features.mutations.set, { photos: "adminOnly" });
    expect(await anonymousCount()).toBe(0);
    expect(
      (await admin.query(api.posts.publicQueries.listPhotos, { cursor: null })).photos,
    ).toHaveLength(2);

    await admin.mutation(api.features.mutations.set, { photos: "on" });
    await admin.mutation(api.siteSettings.mutations.setRequireAuth, { requireAuth: true });
    expect(await anonymousCount()).toBe(0);
  });

  test("marks photos seen from the reader's post read receipts", async () => {
    const t = createT();
    const { userId, asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    const { asUser: reader } = await seedUser(t, "reader@example.com", "user");
    await admin.mutation(api.features.mutations.set, { photos: "on", readReceipts: "on" });
    const now = Date.now();
    const readPost = await seedPost(t, userId, "read", now - 2000, 2);
    await seedPost(t, userId, "unread", now - 1000, 2);
    await reader.mutation(api.postReads.mutations.markRead, { postId: readPost });

    const page = await reader.query(api.posts.publicQueries.listPhotos, { cursor: null });
    expect(page.photos.map((photo) => [photo.slug, photo.seen])).toEqual([
      ["unread", false],
      ["unread", false],
      ["read", true],
      ["read", true],
    ]);
  });
});
