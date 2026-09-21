"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { pbkdf2, randomBytes } from "crypto";
import { promisify } from "util";
import { assertUsablePassword } from "./lib/password";

const pbkdf2Async = promisify(pbkdf2);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await pbkdf2Async(password, salt, 100000, 32, "sha256");
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export const createUser = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { email, password, name }) => {
    const hashedPassword = await hashPassword(password);
    await ctx.runMutation(internal.users.internal.insertAdminUser, {
      email,
      hashedPassword,
      name: name ?? email,
    });
    console.log(`Admin user created or updated: ${email}`);
  },
});

// CLI-only. Hash in this Node action, then write via internal mutation.
// Run: npx convex run admin:resetPassword '{"email":"...","password":"..."}'
export const resetPassword = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
  },
  returns: v.object({
    email: v.string(),
    sessionsRevoked: v.number(),
  }),
  handler: async (ctx, { email, password }) => {
    assertUsablePassword(password);
    const hashedPassword = await hashPassword(password);
    const result: { email: string; sessionsRevoked: number } = await ctx.runMutation(
      internal.users.internal.resetPassword,
      { email, hashedPassword },
    );
    console.log(
      `Password reset for ${result.email}; revoked ${result.sessionsRevoked} session(s)`,
    );
    return result;
  },
});
