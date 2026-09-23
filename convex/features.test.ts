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
  const asUser = t.withIdentity({
    subject: `${userId}|testsession`,
    name: email,
  });
  return { userId, asUser };
}

const DEFAULT_FEATURES = {
  bookmarks: "off",
  timings: "off",
  calendar: "off",
  infiniteScroll: "off",
  tagNav: "off",
  readReceipts: "off",
  imagesOnly: false,
  sortOrder: "created",
  theme: { enabled: false, id: "paper" },
};

describe("features", () => {
  test("defaults to every feature off", async () => {
    const t = createT();
    expect(await t.query(api.features.publicQueries.get, {})).toEqual(DEFAULT_FEATURES);
    expect(await t.query(api.config.getConfig, {})).toMatchObject({
      googleAuthAvailable: false,
      googleAuthEnabled: false,
      passwordAuthAvailable: true,
      passwordAuthEnabled: true,
      requireAuth: false,
      bookmarksEnabled: false,
      features: DEFAULT_FEATURES,
    });
  });

  test("password sign-in cannot be the last method turned off", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    await expect(
      asAdmin.mutation(api.siteSettings.mutations.setSignInMethods, {
        googleSignIn: false,
        passwordSignIn: false,
      }),
    ).rejects.toThrow(/at least one sign-in method/);
  });

  test("admin can turn password sign-in on", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    await asAdmin.mutation(api.siteSettings.mutations.setSignInMethods, {
      googleSignIn: true,
      passwordSignIn: false,
    });
    const enabled = await asAdmin.mutation(api.siteSettings.mutations.setSignInMethods, {
      passwordSignIn: true,
    });
    expect(enabled.passwordSignIn).toBe(true);
    expect(enabled.googleSignIn).toBe(true);
    expect((await t.query(api.config.getConfig, {})).passwordAuthEnabled).toBe(true);
  });

  test("only an admin can change features", async () => {
    const t = createT();
    const { asUser } = await seedUser(t, "reader@example.com", "user");
    await expect(t.mutation(api.features.mutations.set, { infiniteScroll: true })).rejects.toThrow(
      /Not authenticated/,
    );
    await expect(
      asUser.mutation(api.features.mutations.set, { infiniteScroll: true }),
    ).rejects.toThrow(/Forbidden/);
  });

  test("admin can toggle timings, calendar, infinite scroll, theme, and bookmarks", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const features = await asAdmin.mutation(api.features.mutations.set, {
      bookmarks: true,
      timings: true,
      calendar: true,
      infiniteScroll: true,
      imagesOnly: true,
      themeEnabled: true,
      themeId: "ink",
    });
    expect(features).toEqual({
      bookmarks: "on",
      timings: "on",
      calendar: "on",
      infiniteScroll: "on",
      tagNav: "off",
      readReceipts: "off",
      imagesOnly: true,
      sortOrder: "created",
      theme: { enabled: true, id: "ink" },
    });
    expect(await t.query(api.features.publicQueries.get, {})).toEqual(features);
    expect((await t.query(api.config.getConfig, {})).bookmarksEnabled).toBe(true);
  });

  test("admin-only calendar is empty for anonymous readers", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    await asAdmin.mutation(api.features.mutations.set, { calendar: "adminOnly" });
    const postId = await asAdmin.mutation(api.posts.mutations.create, {});
    await asAdmin.mutation(api.posts.mutations.save, {
      postId,
      title: "Dated",
      excerpt: "",
      body: "body",
      visibility: "listed",
      tags: [],
    });
    await asAdmin.mutation(api.posts.mutations.setPublished, {
      postId,
      published: true,
    });
    const publishedAt = Date.parse("2026-01-15T12:00:00.000Z");
    await t.run(async (ctx) => {
      await ctx.db.patch("posts", postId, { publishedAt });
    });
    const start = Date.parse("2026-01-01T00:00:00.000Z");
    const end = Date.parse("2026-02-01T00:00:00.000Z");
    expect(
      await t.query(api.posts.publicQueries.listPublishedBetween, { start, end }),
    ).toEqual([]);
    const adminRows = await asAdmin.query(api.posts.publicQueries.listPublishedBetween, {
      start,
      end,
    });
    expect(adminRows).toEqual([{ title: "Dated", slug: "dated", publishedAt }]);
  });

  test("admin can set post sort order", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    expect((await t.query(api.features.publicQueries.get, {})).sortOrder).toBe("created");
    const features = await asAdmin.mutation(api.features.mutations.set, {
      sortOrder: "updated",
    });
    expect(features.sortOrder).toBe("updated");
    expect((await t.query(api.features.publicQueries.get, {})).sortOrder).toBe("updated");
  });

  test("rejects an unknown theme id", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    await expect(
      asAdmin.mutation(api.features.mutations.set, { themeId: "neon" as "paper" }),
    ).rejects.toThrow();
  });

  test("admin can pick the extra dark and high-contrast themes", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    for (const themeId of ["midnight", "ember", "signal", "citrus"] as const) {
      const features = await asAdmin.mutation(api.features.mutations.set, {
        themeEnabled: true,
        themeId,
      });
      expect(features.theme).toEqual({ enabled: true, id: themeId });
    }
  });
});

describe("calendar page query", () => {
  test("returns nothing while the calendar is off", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const postId = await asAdmin.mutation(api.posts.mutations.create, {});
    await asAdmin.mutation(api.posts.mutations.save, {
      postId,
      title: "Dated",
      excerpt: "",
      body: "body",
      visibility: "listed",
      tags: [],
    });
    await asAdmin.mutation(api.posts.mutations.setPublished, {
      postId,
      published: true,
    });
    const start = Date.parse("2026-01-01T00:00:00.000Z");
    const end = Date.parse("2026-02-01T00:00:00.000Z");
    await t.run(async (ctx) => {
      await ctx.db.patch("posts", postId, {
        publishedAt: Date.parse("2026-01-15T12:00:00.000Z"),
      });
    });
    expect(await t.query(api.posts.publicQueries.listPublishedBetween, { start, end })).toEqual([]);
  });

  test("when on, returns listed published posts in the window", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    await asAdmin.mutation(api.features.mutations.set, { calendar: true });
    const postId = await asAdmin.mutation(api.posts.mutations.create, {});
    await asAdmin.mutation(api.posts.mutations.save, {
      postId,
      title: "Dated",
      excerpt: "",
      body: "body",
      visibility: "listed",
      tags: [],
    });
    await asAdmin.mutation(api.posts.mutations.setPublished, {
      postId,
      published: true,
    });
    const publishedAt = Date.parse("2026-01-15T12:00:00.000Z");
    await t.run(async (ctx) => {
      await ctx.db.patch("posts", postId, { publishedAt });
    });
    const start = Date.parse("2026-01-01T00:00:00.000Z");
    const end = Date.parse("2026-02-01T00:00:00.000Z");
    const rows = await t.query(api.posts.publicQueries.listPublishedBetween, {
      start,
      end,
    });
    expect(rows).toEqual([{ title: "Dated", slug: "dated", publishedAt }]);
    expect(
      await t.query(api.posts.publicQueries.listPublishedBetween, {
        start: Date.parse("2026-02-01T00:00:00.000Z"),
        end: Date.parse("2026-03-01T00:00:00.000Z"),
      }),
    ).toEqual([]);
  });
});
