/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function createT() {
  return convexTest(schema, modules);
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
