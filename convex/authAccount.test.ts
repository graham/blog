/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { pbkdf2Hash, verifyPassword } from "./lib/password";
import { assertNotLastMethod } from "./users/account";

const modules = import.meta.glob("./**/*.ts");

function createT() {
  return convexTest(schema, modules);
}

async function seedMember(
  t: ReturnType<typeof createT>,
  email: string,
  userType: "user" | "admin" = "user",
) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email,
      name: email,
      userType,
      authGeneration: "v1",
    });
  });
  const asUser = t.withIdentity({ subject: `${userId}` });
  return { userId, asUser };
}

describe("account", () => {
  test("assertNotLastMethod throws when google is the only method", () => {
    expect(() =>
      assertNotLastMethod({ password: false, google: true, passkeyCount: 0 }),
    ).toThrow(/at least one sign-in method/i);
  });

  test("guest getAccount is null", async () => {
    const t = createT();
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", { userType: "guest" });
    });
    const asGuest = t.withIdentity({ subject: `${userId}` });
    expect(await asGuest.query(api.users.publicQueries.getAccount, {})).toBeNull();
  });

  test("member can update display name", async () => {
    const t = createT();
    const { asUser, userId } = await seedMember(t, "n@example.com");
    await asUser.mutation(api.users.publicMutations.updateProfile, {
      name: "New Name",
    });
    const user = await t.run(async (ctx) => ctx.db.get("users", userId));
    expect(user?.name).toBe("New Name");
  });

  test("member can add then change a password", async () => {
    const t = createT();
    const { asUser, userId } = await seedMember(t, "p@example.com");
    await asUser.mutation(api.users.publicMutations.addPassword, {
      password: "first-password",
    });
    await asUser.mutation(api.users.publicMutations.changePassword, {
      currentPassword: "first-password",
      newPassword: "second-password",
    });
    const secret = await t.run(async (ctx) => {
      const account = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", userId).eq("provider", "password"),
        )
        .first();
      return account?.secret ?? null;
    });
    expect(await verifyPassword("second-password", secret!)).toBe(true);
    expect(await verifyPassword("first-password", secret!)).toBe(false);
  });

  test("changePassword rejects a wrong current password", async () => {
    const t = createT();
    const { asUser } = await seedMember(t, "w@example.com");
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "w@example.com"))
        .first();
      await ctx.db.insert("authAccounts", {
        userId: user!._id,
        provider: "password",
        providerAccountId: "w@example.com",
        secret: await pbkdf2Hash("real-password"),
      });
    });
    await expect(
      asUser.mutation(api.users.publicMutations.changePassword, {
        currentPassword: "wrong-password",
        newPassword: "other-password",
      }),
    ).rejects.toThrow(/Incorrect current password/);
  });

  test("unlinkGoogle fails when it is the only method", async () => {
    const t = createT();
    const { asUser, userId } = await seedMember(t, "g@example.com");
    await t.run(async (ctx) => {
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "google",
        providerAccountId: "g@example.com",
      });
    });
    await expect(
      asUser.mutation(api.users.publicMutations.unlinkGoogle, {}),
    ).rejects.toThrow(/at least one sign-in method/i);
  });

  test("unlinkGoogle succeeds when a password remains", async () => {
    const t = createT();
    const { asUser, userId } = await seedMember(t, "both@example.com");
    await t.run(async (ctx) => {
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "google",
        providerAccountId: "both@example.com",
      });
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: "both@example.com",
        secret: await pbkdf2Hash("keep-this-password"),
      });
    });
    await asUser.mutation(api.users.publicMutations.unlinkGoogle, {});
    const google = await t.run(async (ctx) =>
      ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", userId).eq("provider", "google"),
        )
        .first(),
    );
    expect(google).toBeNull();
  });
});
