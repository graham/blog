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

describe("tags", () => {
  test("admin can create a tag, attach a post, and the nav lists it when enabled", async () => {
    const t = createT();
    const { asUser: admin } = await seedUser(t, "admin@example.com", "admin");
    const postId = await admin.mutation(api.posts.mutations.create, {});
    await admin.mutation(api.posts.mutations.save, {
      postId,
      title: "Tagged",
      excerpt: "",
      body: "body",
      visibility: "listed",
      tags: ["garden"],
    });
    await admin.mutation(api.posts.mutations.setPublished, { postId, published: true });

    expect(await t.query(api.tags.publicQueries.listForViewer, {})).toEqual([]);
    await admin.mutation(api.features.mutations.set, { tagNav: true });
    const nav = await t.query(api.tags.publicQueries.listForViewer, {});
    expect(nav).toEqual([
      { name: "garden", slug: "garden", posts: [{ title: "Tagged", slug: "tagged" }] },
    ]);

    const tagId = await admin.mutation(api.tags.mutations.create, { name: "kitchen" });
    await admin.mutation(api.tags.mutations.addPost, { tagId, postId });
    await admin.mutation(api.tags.mutations.removePost, { tagId, postId });
    const after = await t.query(api.tags.publicQueries.listForViewer, {});
    expect(after.map((group) => group.name)).toEqual(["garden"]);
  });
});
