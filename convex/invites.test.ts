/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { verifyPassword } from "./lib/password";

const modules = import.meta.glob("./**/*.ts");

function createT() {
  return convexTest(schema, modules);
}

async function seedUser(
  t: ReturnType<typeof createT>,
  email: string,
  userType: string,
) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", { email, name: email, userType });
  });
  return {
    userId,
    asUser: t.withIdentity({ subject: `${userId}|testsession`, name: email }),
  };
}

const pageOpts = { numItems: 10, cursor: null as string | null };

describe("invites", () => {
  test("only an admin can invite, and the token is hashed at rest", async () => {
    const t = createT();
    const { asUser } = await seedUser(t, "reader@example.com", "user");
    await expect(
      asUser.mutation(api.invites.mutations.create, {
        email: "new@example.com",
        userType: "user",
      }),
    ).rejects.toThrow(/Forbidden/);

    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const created = await asAdmin.mutation(api.invites.mutations.create, {
      email: "  New@Example.com ",
      userType: "user",
    });
    expect(created.token).toMatch(/^inv_[0-9a-f]{64}$/);
    expect(created.invite.email).toBe("new@example.com");
    expect(created.invite.status).toBe("pending");
    const invitedUser = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "new@example.com"))
        .first(),
    );
    expect(invitedUser).toMatchObject({
      email: "new@example.com",
      userType: "user",
    });

    const stored = await t.run(async (ctx) =>
      ctx.db.get("invites", created.invite._id),
    );
    expect(stored!.tokenHash).not.toBe(created.token);
    expect(stored!.tokenPrefix).toBe(created.token.slice(0, 12));
  });

  test("preview reports the invited email without leaking anything else", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const created = await asAdmin.mutation(api.invites.mutations.create, {
      email: "new@example.com",
      userType: "user",
    });

    expect(
      await t.query(api.invites.publicQueries.preview, { token: created.token }),
    ).toEqual({ status: "valid", email: "new@example.com" });
    expect(
      await t.query(api.invites.publicQueries.preview, { token: "inv_nope" }),
    ).toEqual({ status: "unknown", email: null });
  });

  test("accepting with a password creates a working account exactly once", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const created = await asAdmin.mutation(api.invites.mutations.create, {
      email: "new@example.com",
      userType: "user",
    });

    const accepted = await t.mutation(api.invites.publicMutations.acceptWithPassword, {
      token: created.token,
      name: "New Person",
      password: "correct horse battery",
    });
    expect(accepted.email).toBe("new@example.com");

    const stored = await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "new@example.com"))
        .first();
      const account = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", "new@example.com"),
        )
        .first();
      const invite = await ctx.db.get("invites", created.invite._id);
      return { user, account, invite };
    });
    expect(stored.user!.userType).toBe("user");
    expect(stored.user!.name).toBe("New Person");
    expect(stored.invite!.acceptedAt).toBeTypeOf("number");
    expect(stored.invite!.acceptedUserId).toBe(stored.user!._id);
    const listed = await asAdmin.query(api.invites.queries.list, {
      paginationOpts: pageOpts,
    });
    const row = listed.page.find((invite) => invite._id === created.invite._id);
    expect(row).toMatchObject({
      status: "accepted",
      acceptedUserId: stored.user!._id,
      acceptedUserEmail: "new@example.com",
      acceptedUserName: "New Person",
    });
    expect(await verifyPassword("correct horse battery", stored.account!.secret!)).toBe(
      true,
    );
    expect(await verifyPassword("wrong password", stored.account!.secret!)).toBe(false);

    await expect(
      t.mutation(api.invites.publicMutations.acceptWithPassword, {
        token: created.token,
        name: "Impostor",
        password: "another password",
      }),
    ).rejects.toThrow(/no longer valid/);
  });

  test("an invite marked admin creates an admin", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const created = await asAdmin.mutation(api.invites.mutations.create, {
      email: "boss@example.com",
      userType: "admin",
    });
    await t.mutation(api.invites.publicMutations.acceptWithPassword, {
      token: created.token,
      name: "Boss",
      password: "a long enough password",
    });
    const user = await t.run(async (ctx) =>
      ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "boss@example.com"))
        .first(),
    );
    expect(user!.userType).toBe("admin");
  });

  test("short passwords are refused", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const created = await asAdmin.mutation(api.invites.mutations.create, {
      email: "new@example.com",
      userType: "user",
    });
    await expect(
      t.mutation(api.invites.publicMutations.acceptWithPassword, {
        token: created.token,
        name: "New",
        password: "short",
      }),
    ).rejects.toThrow(/at least 8 characters/);
  });

  test("revoked and expired invites are dead", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const revoked = await asAdmin.mutation(api.invites.mutations.create, {
      email: "revoked@example.com",
      userType: "user",
    });
    await asAdmin.mutation(api.invites.mutations.revoke, {
      inviteId: revoked.invite._id,
    });
    expect(
      await t.query(api.invites.publicQueries.preview, { token: revoked.token }),
    ).toEqual({ status: "revoked", email: null });
    await expect(
      t.mutation(api.invites.publicMutations.acceptWithPassword, {
        token: revoked.token,
        name: "Nope",
        password: "a long enough password",
      }),
    ).rejects.toThrow(/no longer valid/);

    const expired = await asAdmin.mutation(api.invites.mutations.create, {
      email: "expired@example.com",
      userType: "user",
    });
    await t.run(async (ctx) => {
      await ctx.db.patch("invites", expired.invite._id, {
        expiresAt: Date.now() - 1000,
      });
    });
    expect(
      await t.query(api.invites.publicQueries.preview, { token: expired.token }),
    ).toEqual({ status: "expired", email: null });
  });

  test("issuing a second invite retires the first", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const first = await asAdmin.mutation(api.invites.mutations.create, {
      email: "new@example.com",
      userType: "user",
    });
    const second = await asAdmin.mutation(api.invites.mutations.create, {
      email: "new@example.com",
      userType: "user",
    });
    expect(
      (await t.query(api.invites.publicQueries.preview, { token: first.token })).status,
    ).toBe("revoked");
    expect(
      (await t.query(api.invites.publicQueries.preview, { token: second.token })).status,
    ).toBe("valid");
  });

  test("an email that already has a password cannot be invited", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    await asAdmin.mutation(api.users.mutations.create, {
      email: "google@example.com",
      userType: "user",
    });
    const created = await asAdmin.mutation(api.invites.mutations.create, {
      email: "google@example.com",
      userType: "user",
    });
    expect(created.invite.status).toBe("pending");
    await t.mutation(api.invites.publicMutations.acceptWithPassword, {
      token: created.token,
      name: "G",
      password: "a long enough password",
    });
    await expect(
      asAdmin.mutation(api.invites.mutations.create, {
        email: "google@example.com",
        userType: "user",
      }),
    ).rejects.toThrow(/already has a password/);
  });

  test("a bad email address is refused", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    await expect(
      asAdmin.mutation(api.invites.mutations.create, {
        email: "not-an-email",
        userType: "user",
      }),
    ).rejects.toThrow(/valid email/);
  });

  test("admins can list invites, readers cannot", async () => {
    const t = createT();
    const { asUser: asAdmin } = await seedUser(t, "admin@example.com", "admin");
    const { asUser } = await seedUser(t, "reader@example.com", "user");
    await asAdmin.mutation(api.invites.mutations.create, {
      email: "new@example.com",
      userType: "user",
    });
    await expect(
      asUser.query(api.invites.queries.list, { paginationOpts: pageOpts }),
    ).rejects.toThrow(/Forbidden/);
    const listed = await asAdmin.query(api.invites.queries.list, {
      paginationOpts: pageOpts,
    });
    expect(listed.page).toHaveLength(1);
    expect(listed.page[0]).toMatchObject({
      email: "new@example.com",
      status: "pending",
    });
  });
});
