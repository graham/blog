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
  const asUser = t.withIdentity({
    subject: `${userId}|testsession`,
    name: email,
  });
  return { userId, asUser };
}

async function publishPost(
  asAdmin: ReturnType<ReturnType<typeof createT>["withIdentity"]>,
  fields: {
    title: string;
    body?: string;
    visibility?: "listed" | "unlisted";
    channelIds?: Array<string>;
    bookmarkGroupIds?: Array<string>;
  },
) {
  const postId = await asAdmin.mutation(api.posts.mutations.create, {});
  await asAdmin.mutation(api.posts.mutations.save, {
    postId,
    title: fields.title,
    excerpt: fields.title,
    body: fields.body ?? `${fields.title} body`,
    visibility: fields.visibility ?? "listed",
    tags: [],
    ...(fields.channelIds ? { channelIds: fields.channelIds as never } : {}),
    ...(fields.bookmarkGroupIds
      ? { bookmarkGroupIds: fields.bookmarkGroupIds as never }
      : {}),
  });
  await asAdmin.mutation(api.posts.mutations.setPublished, {
    postId,
    published: true,
  });
  return postId;
}

const pageOpts = { numItems: 20, cursor: null as string | null };

describe("bookmarks feature flag", () => {
  test("defaults to off and hides groups from every reader", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const groupId = await asAdmin.mutation(api.bookmarkGroups.mutations.create, {
      name: "Favorites",
    });
    await publishPost(asAdmin, {
      title: "Pinned essay",
      bookmarkGroupIds: [groupId],
    });

    expect(await t.query(api.config.getConfig, {})).toMatchObject({
      bookmarksEnabled: false,
    });
    expect(await t.query(api.bookmarkGroups.publicQueries.listForViewer, {})).toEqual(
      [],
    );
  });

  test("only an admin can flip the switch", async () => {
    const t = createT();
    const { asUser } = await seedUser(t, "reader@example.com", "user");
    await expect(
      t.mutation(api.siteSettings.mutations.setBookmarksEnabled, {
        bookmarksEnabled: true,
      }),
    ).rejects.toThrow(/Not authenticated/);
    await expect(
      asUser.mutation(api.siteSettings.mutations.setBookmarksEnabled, {
        bookmarksEnabled: true,
      }),
    ).rejects.toThrow(/Forbidden/);
  });
});

describe("bookmark groups", () => {
  test("non-admin cannot create or list groups", async () => {
    const t = createT();
    const { asUser } = await seedUser(t, "reader@example.com", "user");
    await expect(
      asUser.mutation(api.bookmarkGroups.mutations.create, { name: "Nope" }),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      asUser.query(api.bookmarkGroups.queries.listAll, {}),
    ).rejects.toThrow(/Forbidden/);
  });

  test("admin can create, rename, assign, and delete a group", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    await asAdmin.mutation(api.siteSettings.mutations.setBookmarksEnabled, {
      bookmarksEnabled: true,
    });

    const groupId = await asAdmin.mutation(api.bookmarkGroups.mutations.create, {
      name: "Reading list",
    });
    const postId = await publishPost(asAdmin, { title: "A kept post" });
    await asAdmin.mutation(api.bookmarkGroupPosts.mutations.add, {
      groupId,
      postId,
    });

    await asAdmin.mutation(api.bookmarkGroups.mutations.rename, {
      groupId,
      name: "Keepers",
    });

    const assigned = await asAdmin.query(api.bookmarkGroupPosts.queries.listByGroup, {
      groupId,
      paginationOpts: pageOpts,
    });
    expect(assigned.page).toHaveLength(1);
    expect(assigned.page[0]?.title).toBe("A kept post");

    const detail = await asAdmin.query(api.posts.queries.getById, { postId });
    expect(detail?.bookmarkGroups.map((group) => group.name)).toEqual(["Keepers"]);

    await asAdmin.mutation(api.bookmarkGroups.mutations.remove, { groupId });
    expect(await t.query(api.bookmarkGroups.publicQueries.listForViewer, {})).toEqual(
      [],
    );
  });

  test("when on, readers only see listed published posts they can already open", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const { userId: memberId, asUser: member } = await seedUser(
      t,
      "member@example.com",
      "user",
    );
    const { asUser: outsider } = await seedUser(t, "outsider@example.com", "user");
    await asAdmin.mutation(api.siteSettings.mutations.setBookmarksEnabled, {
      bookmarksEnabled: true,
    });

    const channelId = await asAdmin.mutation(api.channels.mutations.create, {
      name: "parents",
    });
    await asAdmin.mutation(api.channelMembers.mutations.add, {
      channelId,
      userId: memberId,
    });

    const groupId = await asAdmin.mutation(api.bookmarkGroups.mutations.create, {
      name: "Picks",
    });
    await publishPost(asAdmin, {
      title: "Public pick",
      bookmarkGroupIds: [groupId],
    });
    await publishPost(asAdmin, {
      title: "Secret pick",
      visibility: "unlisted",
      bookmarkGroupIds: [groupId],
    });
    const draftId = await asAdmin.mutation(api.posts.mutations.create, {});
    await asAdmin.mutation(api.posts.mutations.save, {
      postId: draftId,
      title: "Draft pick",
      excerpt: "draft",
      body: "draft body",
      visibility: "listed",
      tags: [],
      bookmarkGroupIds: [groupId],
    });
    await publishPost(asAdmin, {
      title: "Family pick",
      channelIds: [channelId],
      bookmarkGroupIds: [groupId],
    });

    const anon = await t.query(api.bookmarkGroups.publicQueries.listForViewer, {});
    expect(anon).toEqual([
      {
        _id: groupId,
        name: "Picks",
        slug: "picks",
        posts: [{ title: "Public pick", slug: "public-pick" }],
      },
    ]);

    const outsiderView = await outsider.query(
      api.bookmarkGroups.publicQueries.listForViewer,
      {},
    );
    expect(outsiderView[0]?.posts.map((post) => post.title)).toEqual(["Public pick"]);

    const memberView = await member.query(
      api.bookmarkGroups.publicQueries.listForViewer,
      {},
    );
    expect(memberView[0]?.posts.map((post) => post.title)).toEqual([
      "Public pick",
      "Family pick",
    ]);

    const adminView = await asAdmin.query(
      api.bookmarkGroups.publicQueries.listForViewer,
      {},
    );
    expect(adminView[0]?.posts.map((post) => post.title)).toEqual([
      "Public pick",
      "Family pick",
    ]);
  });

  test("an empty group, or a group whose posts are all hidden, is omitted", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    await asAdmin.mutation(api.siteSettings.mutations.setBookmarksEnabled, {
      bookmarksEnabled: true,
    });
    await asAdmin.mutation(api.bookmarkGroups.mutations.create, {
      name: "Empty",
    });
    const hiddenId = await asAdmin.mutation(api.bookmarkGroups.mutations.create, {
      name: "Hidden",
    });
    await publishPost(asAdmin, {
      title: "Unlisted only",
      visibility: "unlisted",
      bookmarkGroupIds: [hiddenId],
    });

    expect(await t.query(api.bookmarkGroups.publicQueries.listForViewer, {})).toEqual(
      [],
    );
  });

  test("requireAuth still blocks anonymous bookmark reads", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    await asAdmin.mutation(api.siteSettings.mutations.setBookmarksEnabled, {
      bookmarksEnabled: true,
    });
    await asAdmin.mutation(api.siteSettings.mutations.setRequireAuth, {
      requireAuth: true,
    });
    const groupId = await asAdmin.mutation(api.bookmarkGroups.mutations.create, {
      name: "Picks",
    });
    await publishPost(asAdmin, {
      title: "Public pick",
      bookmarkGroupIds: [groupId],
    });

    expect(await t.query(api.bookmarkGroups.publicQueries.listForViewer, {})).toEqual(
      [],
    );
    const { asUser } = await seedUser(t, "reader@example.com", "user");
    const signedIn = await asUser.query(
      api.bookmarkGroups.publicQueries.listForViewer,
      {},
    );
    expect(signedIn[0]?.posts.map((post) => post.title)).toEqual(["Public pick"]);
  });
});
