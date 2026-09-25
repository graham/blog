/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { registerAggregate } from "../tests/registerAggregate";

const modules = import.meta.glob("./**/*.ts");

function createT() {
  const t = convexTest(schema, modules);
  registerAggregate(t);
  return t;
}

async function seedAdmin(t: ReturnType<typeof createT>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "admin@example.com",
      name: "admin@example.com",
      userType: "admin",
    });
  });
  return t.withIdentity({ subject: `${userId}|testsession`, name: "admin@example.com" });
}

describe("pushover settings", () => {
  test("defaults off and only an admin can toggle", async () => {
    const t = createT();
    expect((await t.query(api.config.getConfig, {})).pushoverEnabled).toBe(false);
    await expect(
      t.mutation(api.siteSettings.mutations.setPushoverEnabled, { pushoverEnabled: true }),
    ).rejects.toThrow(/Not authenticated/);
    const asAdmin = await seedAdmin(t);
    const settings = await asAdmin.mutation(api.siteSettings.mutations.setPushoverEnabled, {
      pushoverEnabled: true,
    });
    expect(settings.pushoverEnabled).toBe(true);
  });

  test("test button requires admin and the toggle on", async () => {
    const t = createT();
    const asAdmin = await seedAdmin(t);
    await expect(asAdmin.mutation(api.notifications.mutations.testPushover, {})).rejects.toThrow(
      /Turn Pushover on first|credentials are not set/,
    );
    await asAdmin.mutation(api.siteSettings.mutations.setPushoverEnabled, {
      pushoverEnabled: true,
    });
    await expect(asAdmin.mutation(api.notifications.mutations.testPushover, {})).rejects.toThrow(
      /credentials are not set|Turn Pushover on first/,
    );
  });

  test("creating a post succeeds while pushover is off", async () => {
    const t = createT();
    const asAdmin = await seedAdmin(t);
    const postId = await asAdmin.mutation(api.posts.mutations.create, {});
    expect(postId).toBeTruthy();
  });
});

describe("post change notifications", () => {
  async function pushoverSends(t: ReturnType<typeof createT>) {
    const jobs = await t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").collect());
    return jobs.filter((job) => job.name.includes("notifications/actions"));
  }

  test("website edits do not notify but API writes do", async () => {
    process.env.API_KEY_ENCRYPTION_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
    const t = createT();
    const asAdmin = await seedAdmin(t);
    await asAdmin.mutation(api.siteSettings.mutations.setPushoverEnabled, {
      pushoverEnabled: true,
    });

    const postId = await asAdmin.mutation(api.posts.mutations.create, {});
    await asAdmin.mutation(api.posts.mutations.save, {
      postId,
      title: "From the site",
      excerpt: "",
      body: "b",
      visibility: "listed",
      tags: [],
    });
    expect(await pushoverSends(t)).toHaveLength(0);

    const { token } = await asAdmin.mutation(api.apiKeys.mutations.create, { name: "writer" });
    const created = await t.mutation(internal.apiKeys.internal.createPost, {
      token,
      input: { title: "From the API", body: "b" },
    });
    await t.mutation(internal.apiKeys.internal.updatePost, {
      token,
      postId: created.id,
      input: { body: "edited" },
    });
    expect(await pushoverSends(t)).toHaveLength(2);
  });
});
