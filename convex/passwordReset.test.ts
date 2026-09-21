/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { pbkdf2Hash, verifyPassword } from "./lib/password";

const modules = import.meta.glob("./**/*.ts");

function createT() {
  return convexTest(schema, modules);
}

describe("password reset", () => {
  test("refuses an unknown email", async () => {
    const t = createT();
    await expect(
      t.mutation(internal.users.internal.resetPassword, {
        email: "missing@example.com",
        hashedPassword: "unused",
      }),
    ).rejects.toThrow(/No user with that email/);
  });

  test("replaces the password secret and revokes sessions", async () => {
    const t = createT();
    const userId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", {
        email: "reader@example.com",
        name: "Reader",
        userType: "user",
      });
      await ctx.db.insert("authAccounts", {
        userId: id,
        provider: "password",
        providerAccountId: "reader@example.com",
        secret: await pbkdf2Hash("old-password-value"),
      });
      const sessionId = await ctx.db.insert("authSessions", {
        userId: id,
        expirationTime: Date.now() + 60_000,
      });
      await ctx.db.insert("authRefreshTokens", {
        sessionId,
        expirationTime: Date.now() + 60_000,
      });
      return id;
    });

    const hashed = await pbkdf2Hash("new-password-value");
    const result = await t.mutation(internal.users.internal.resetPassword, {
      email: "reader@example.com",
      hashedPassword: hashed,
    });
    expect(result).toEqual({
      email: "reader@example.com",
      sessionsRevoked: 1,
    });

    const stored = await t.run(async (ctx) => {
      const account = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", "reader@example.com"),
        )
        .first();
      return {
        secret: account?.secret ?? null,
        userId: account?.userId,
        sessions: await ctx.db.query("authSessions").collect(),
        tokens: await ctx.db.query("authRefreshTokens").collect(),
      };
    });
    expect(stored.userId).toBe(userId);
    expect(await verifyPassword("new-password-value", stored.secret!)).toBe(true);
    expect(await verifyPassword("old-password-value", stored.secret!)).toBe(false);
    expect(stored.sessions).toEqual([]);
    expect(stored.tokens).toEqual([]);
  });

  test("the CLI action rejects a short password", async () => {
    const t = createT();
    await expect(
      t.action(internal.admin.resetPassword, {
        email: "reader@example.com",
        password: "short",
      }),
    ).rejects.toThrow(/at least 8 characters/);
  });
});
