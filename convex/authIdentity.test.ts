/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { isGuest, isMember } from "./lib/auth";

const modules = import.meta.glob("./**/*.ts");

describe("identity helpers", () => {
  test("guest is not a member; user and admin are", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const guestId = await ctx.db.insert("users", { userType: "guest" });
      const userId = await ctx.db.insert("users", {
        email: "a@example.com",
        name: "A",
        userType: "user",
        authGeneration: "v1",
      });
      const adminId = await ctx.db.insert("users", {
        email: "b@example.com",
        name: "B",
        userType: "admin",
        authGeneration: "v1",
      });
      return { guestId, userId, adminId };
    });
    await t.run(async (ctx) => {
      const guest = await ctx.db.get("users", ids.guestId);
      const user = await ctx.db.get("users", ids.userId);
      const admin = await ctx.db.get("users", ids.adminId);
      expect(isGuest(guest)).toBe(true);
      expect(isMember(guest)).toBe(false);
      expect(isMember(user)).toBe(true);
      expect(isMember(admin)).toBe(true);
      expect(isGuest(user)).toBe(false);
    });
  });
});
