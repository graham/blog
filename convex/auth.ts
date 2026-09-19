import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { isAdminEmail, parseList } from "./lib/env";
import { pbkdf2Hash, verifyPassword } from "./lib/password";
import { consumeInvite, findPendingInviteByEmail, normalizeEmail } from "./invites/internal";

const passwordCrypto = {
  async hashSecret(password: string): Promise<string> {
    return pbkdf2Hash(password);
  },
  async verifySecret(password: string, hash: string): Promise<boolean> {
    return verifyPassword(password, hash);
  },
};

const rejectUsers: Array<string> = parseList(process.env.REJECT_USERS);
const allowUsers: Array<string> = parseList(process.env.ALLOW_USERS);
const allowDomains: Array<string> = parseList(process.env.ALLOW_DOMAINS);

const passwordAuthEnabled = process.env.AUTH_PASSWORD_ENABLED !== "false";
const googleAuthEnabled =
  process.env.AUTH_GOOGLE_ENABLED === "true" ||
  (process.env.AUTH_GOOGLE_ENABLED !== "false" &&
    Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET));

// Accounts still need a password secret (via `npm run create-user` or an
// accepted invite); OAuth-only users cannot sign in with a password.
const providers: any[] = [];
if (googleAuthEnabled) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}
if (passwordAuthEnabled) {
  providers.push(Password({ crypto: passwordCrypto }));
}

if (providers.length === 0) {
  throw new Error(
    "Enable at least one sign-in provider with AUTH_PASSWORD_ENABLED=true or AUTH_GOOGLE_ENABLED=true",
  );
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers,
  callbacks: {
    async createOrUpdateUser(ctx: any, args: any) {
      if (!args.profile.email) {
        throw new Error("No email, no access");
      }

      if (rejectUsers.includes(args.profile.email)) {
        throw new Error(`User ${args.profile.email} is banned.`);
      }

      const existingUser = await ctx.db
        .query("users")
        .withIndex("email", (q: any) => q.eq("email", args.profile.email))
        .first();

      if (existingUser) {
        if (existingUser.disabledAt !== undefined) {
          throw new Error(`User ${args.profile.email} is disabled.`);
        }
        await ctx.db.patch(existingUser._id, {
          email: args.profile.email,
          ...(args.profile.name !== undefined && { name: args.profile.name }),
          ...(args.profile.image !== undefined && { image: args.profile.image }),
          ...(isAdminEmail(args.profile.email) && existingUser.userType !== "admin"
            ? { userType: "admin" }
            : {}),
        });
        return existingUser._id;
      }

      // Password users must be pre-created via the admin CLI tool or by
      // accepting an invite, which creates the account before sign-in.
      if (args.type === "credentials") {
        throw new Error(`User ${args.profile.email} does not exist`);
      }

      // An invite is one of two doors: the env allowlist still works, and an
      // invite for this email opens it too. OAuth carries no invite token
      // through the redirect, so the email is what we match on.
      const invite = await findPendingInviteByEmail(ctx, normalizeEmail(args.profile.email));

      const emailDomain = args.profile.email.split("@")[1];
      const isAllowedByEmail = allowUsers.includes(args.profile.email);
      const isAllowedByDomain = allowDomains.length > 0 && allowDomains.includes(emailDomain);

      if (!invite && !isAllowedByEmail && !isAllowedByDomain) {
        throw new Error(`User ${args.profile.email} is not authorized`);
      }

      if (args.type === "oauth") {
        const userType = isAdminEmail(args.profile.email) ? "admin" : (invite?.userType ?? "user");
        const userId = await ctx.db.insert("users", {
          email: args.profile.email,
          name: args.profile.name,
          image: args.profile.image,
          userType,
        });
        if (invite) {
          await consumeInvite(ctx, invite._id, userId);
          console.log(`Invite accepted via OAuth by ${args.profile.email}`);
        }
        return userId;
      }

      throw new Error(`User ${args.profile.email} doesn't exist`);
    },
  },
});
