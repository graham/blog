/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function createT() {
  return convexTest(schema, modules);
}

async function seedUser(
  t: ReturnType<typeof createT>,
  email: string,
  userType: "user" | "admin",
) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", { email, name: email, userType });
  });
  const asUser = t.withIdentity({
    subject: `${userId}|testsession`,
    name: email,
  });
  return { userId, asUser };
}

async function seedPublishedPost(
  t: ReturnType<typeof createT>,
  asAdmin: ReturnType<typeof createT>,
) {
  const postId = await asAdmin.mutation(api.posts.mutations.create, {});
  await asAdmin.mutation(api.posts.mutations.save, {
    postId,
    title: "Public thoughts",
    excerpt: "an excerpt",
    body: "a body about widgets",
    visibility: "listed",
    tags: ["widgets"],
  });
  await asAdmin.mutation(api.posts.mutations.setPublished, {
    postId,
    published: true,
  });
  const post = await t.run(async (ctx) => ctx.db.get("posts", postId));
  return { postId, slug: post!.slug };
}

const pageOpts = { numItems: 10, cursor: null as string | null };

describe("site-wide requireAuth", () => {
  test("defaults to off so anonymous readers still see published posts", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const { slug } = await seedPublishedPost(t, asAdmin);

    expect(await t.query(api.config.getConfig, {})).toEqual({
      googleAuthAvailable: false,
      googleAuthEnabled: false,
      passwordAuthAvailable: true,
      passwordAuthEnabled: true,
      pushoverAvailable: false,
      pushoverEnabled: false,
      requireAuth: false,
      bookmarksEnabled: false,
      features: {
        bookmarks: "off",
        timings: "off",
        calendar: "off",
        infiniteScroll: "off",
        tagNav: "off",
        readReceipts: "off",
        imagesOnly: false,
        sortOrder: "created",
        theme: { enabled: false, id: "paper" },
      },
    });
    const list = await t.query(api.posts.publicQueries.listPublished, {
      paginationOpts: pageOpts,
    });
    expect(list.page).toHaveLength(1);
    expect(await t.query(api.posts.publicQueries.getBySlug, { slug })).not.toBeNull();
  });

  test("when on, every public read path is empty for anonymous callers", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const { slug } = await seedPublishedPost(t, asAdmin);
    await asAdmin.mutation(api.siteSettings.mutations.setRequireAuth, {
      requireAuth: true,
    });

    expect((await t.query(api.config.getConfig, {})).requireAuth).toBe(true);
    const list = await t.query(api.posts.publicQueries.listPublished, {
      paginationOpts: pageOpts,
    });
    expect(list.page).toEqual([]);
    expect(list.isDone).toBe(true);
    expect(await t.query(api.posts.publicQueries.getBySlug, { slug })).toBeNull();
    expect(
      await t.query(api.posts.publicQueries.searchPublished, {
        query: "widgets",
        tag: null,
      }),
    ).toEqual([]);
    const byTag = await t.query(api.posts.publicQueries.listByTag, {
      tag: "widgets",
      paginationOpts: pageOpts,
    });
    expect(byTag.page).toEqual([]);
  });

  test("when on, a signed-in reader still sees the same posts", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const { slug } = await seedPublishedPost(t, asAdmin);
    await asAdmin.mutation(api.siteSettings.mutations.setRequireAuth, {
      requireAuth: true,
    });

    const { asUser } = await seedUser(t, "reader@example.com", "user");
    const list = await asUser.query(api.posts.publicQueries.listPublished, {
      paginationOpts: pageOpts,
    });
    expect(list.page).toHaveLength(1);
    expect(await asUser.query(api.posts.publicQueries.getBySlug, { slug })).not.toBeNull();
  });

  test("when requireAuth is on, a guest session does not see published posts", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const { slug } = await seedPublishedPost(t, asAdmin);
    await asAdmin.mutation(api.siteSettings.mutations.setRequireAuth, {
      requireAuth: true,
    });
    const guestId = await t.run(async (ctx) => ctx.db.insert("users", { userType: "guest" }));
    const asGuest = t.withIdentity({ subject: `${guestId}|testsession` });
    const list = await asGuest.query(api.posts.publicQueries.listPublished, {
      paginationOpts: pageOpts,
    });
    expect(list.page).toEqual([]);
    expect(await asGuest.query(api.posts.publicQueries.getBySlug, { slug })).toBeNull();
  });

  test("when requireAuth is off, a guest session still sees published posts", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const { slug } = await seedPublishedPost(t, asAdmin);
    const guestId = await t.run(async (ctx) => ctx.db.insert("users", { userType: "guest" }));
    const asGuest = t.withIdentity({ subject: `${guestId}|testsession` });
    const list = await asGuest.query(api.posts.publicQueries.listPublished, {
      paginationOpts: pageOpts,
    });
    expect(list.page).toHaveLength(1);
    expect(await asGuest.query(api.posts.publicQueries.getBySlug, { slug })).not.toBeNull();
  });

  test("only an admin can flip the switch", async () => {
    const t = createT();
    const { asUser } = await seedUser(t, "reader@example.com", "user");
    await expect(
      t.mutation(api.siteSettings.mutations.setRequireAuth, { requireAuth: true }),
    ).rejects.toThrow(/Not authenticated/);
    await expect(
      asUser.mutation(api.siteSettings.mutations.setRequireAuth, {
        requireAuth: true,
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  test("the switch is a single row no matter how often it is flipped", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    await asAdmin.mutation(api.siteSettings.mutations.setRequireAuth, {
      requireAuth: true,
    });
    await asAdmin.mutation(api.siteSettings.mutations.setRequireAuth, {
      requireAuth: false,
    });
    const rows = await t.run(async (ctx) => ctx.db.query("siteSettings").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].requireAuth).toBe(false);
  });
});

describe("disabled users", () => {
  test("an admin can disable and re-enable another user", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const { userId, asUser } = await seedUser(t, "reader@example.com", "user");

    const disabled = await asAdmin.mutation(api.users.mutations.setDisabled, {
      userId,
      disabled: true,
    });
    expect(disabled.disabledAt).toBeTypeOf("number");

    const enabled = await asAdmin.mutation(api.users.mutations.setDisabled, {
      userId,
      disabled: false,
    });
    expect(enabled.disabledAt).toBeNull();
    expect(await asUser.query(api.users.publicQueries.getCurrentUser, {})).toMatchObject({
      disabled: false,
    });
  });

  test("disabling revokes live sessions and their refresh tokens", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const { userId } = await seedUser(t, "reader@example.com", "user");
    await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert("authSessions", {
        userId,
        expirationTime: Date.now() + 60_000,
      });
      await ctx.db.insert("authRefreshTokens", {
        sessionId,
        expirationTime: Date.now() + 60_000,
      });
    });

    await asAdmin.mutation(api.users.mutations.setDisabled, {
      userId,
      disabled: true,
    });

    const left = await t.run(async (ctx) => ({
      sessions: await ctx.db.query("authSessions").collect(),
      tokens: await ctx.db.query("authRefreshTokens").collect(),
    }));
    expect(left.sessions).toEqual([]);
    expect(left.tokens).toEqual([]);
  });

  test("a disabled user reads as anonymous and loses admin access", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const { userId: otherAdminId, asUser: asOtherAdmin } = await seedUser(
      t,
      "second@example.com",
      "admin",
    );
    const { slug } = await seedPublishedPost(t, asAdmin);
    await asAdmin.mutation(api.siteSettings.mutations.setRequireAuth, {
      requireAuth: true,
    });
    await asAdmin.mutation(api.users.mutations.setDisabled, {
      userId: otherAdminId,
      disabled: true,
    });

    expect(await asOtherAdmin.query(api.posts.publicQueries.getBySlug, { slug })).toBeNull();
    await expect(
      asOtherAdmin.query(api.posts.queries.listAll, { paginationOpts: pageOpts }),
    ).rejects.toThrow(/Not authenticated/);
    expect(await asOtherAdmin.query(api.users.publicQueries.getCurrentUser, {})).toMatchObject({
      disabled: true,
      isAdmin: false,
    });
  });

  test("an admin cannot disable or demote themselves", async () => {
    const t = createT();
    const { userId, asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    await seedUser(t, "second@example.com", "admin");
    await expect(
      asAdmin.mutation(api.users.mutations.setDisabled, { userId, disabled: true }),
    ).rejects.toThrow(/your own account/);
    await expect(
      asAdmin.mutation(api.users.mutations.setUserType, {
        userId,
        userType: "user",
      }),
    ).rejects.toThrow(/your own admin access/);
  });

  test("the last enabled admin cannot be disabled or demoted", async () => {
    // Unreachable through the public mutation (a caller must be a second
    // enabled admin), so the guard is exercised where an operator can hit it.
    const t = createT();
    const { userId: adminId } = await seedUser(t, "admin@example.com", "admin");
    const { userId: readerId } = await seedUser(t, "reader@example.com", "user");
    await expect(
      t.mutation(internal.users.internal.setDisabled, {
        userId: adminId,
        disabled: true,
        actorId: readerId,
      }),
    ).rejects.toThrow(/last enabled admin/);
    await expect(
      t.mutation(internal.users.internal.setUserType, {
        userId: adminId,
        userType: "user",
        actorId: readerId,
      }),
    ).rejects.toThrow(/last enabled admin/);
  });

  test("only an admin can list users or change their state", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const { userId, asUser } = await seedUser(t, "reader@example.com", "user");
    await expect(
      asUser.query(api.users.queries.listForAdmin, { paginationOpts: pageOpts }),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      asUser.mutation(api.users.mutations.setDisabled, { userId, disabled: true }),
    ).rejects.toThrow(/Forbidden/);
    const listed = await asAdmin.query(api.users.queries.listForAdmin, {
      paginationOpts: pageOpts,
    });
    expect(listed.page).toHaveLength(2);
  });
});
