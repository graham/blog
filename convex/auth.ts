import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import {
  envGoogleAuthAvailable,
  envPasswordAuthAvailable,
  isAdminEmail,
  parseList,
} from "./lib/env";
import { readSiteSettings } from "./siteSettings/internal";
import { pbkdf2Hash, verifyPassword } from "./lib/password";
import { consumeInvite, findPendingInviteByEmail, normalizeEmail } from "./invites/internal";
import { findUserByEmail } from "./users/internal";

const passwordCrypto = {
  async hashSecret(password: string): Promise<string> {
    return pbkdf2Hash(password);
  },
  async verifySecret(password: string, hash: string): Promise<boolean> {
    return verifyPassword(password, hash);
  },
};

const rejectUsers: Array<string> = parseList(process.env.REJECT_USERS);

const passwordAuthEnabled = envPasswordAuthAvailable();
const googleAuthEnabled = envGoogleAuthAvailable();

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

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 90;
const JWT_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

function safeOAuthRedirect(redirectTo: string): string {
  const fallback = (process.env.SITE_URL ?? process.env.CONVEX_SITE_URL ?? "").replace(
    /\/$/,
    "",
  );
  const allowed = new Set(
    [
      process.env.SITE_URL,
      process.env.CONVEX_SITE_URL,
      "https://blog.grahamalot.com",
      "http://localhost:5173",
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.replace(/\/$/, "")),
  );
  try {
    const url = new URL(redirectTo, fallback || "http://localhost:5173");
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    if (allowed.has(url.origin)) return url.toString();
  } catch {
    if (redirectTo.startsWith("/") && fallback) return `${fallback}${redirectTo}`;
  }
  return fallback;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers,
  session: {
    totalDurationMs: SESSION_DURATION_MS,
    inactiveDurationMs: SESSION_DURATION_MS,
  },
  jwt: {
    durationMs: JWT_DURATION_MS,
  },
  callbacks: {
    async redirect({ redirectTo }) {
      return safeOAuthRedirect(redirectTo);
    },
    async createOrUpdateUser(ctx: any, args: any) {
      if (!args.profile.email) {
        throw new Error("No email, no access");
      }

      const settings = await readSiteSettings(ctx);
      if (args.type === "oauth" && !settings.googleSignIn) {
        throw new Error("Google sign-in is turned off");
      }
      if (args.type === "credentials" && !settings.passwordSignIn) {
        throw new Error("Password sign-in is turned off");
      }

      if (rejectUsers.includes(args.profile.email)) {
        throw new Error(`User ${args.profile.email} is banned.`);
      }

      const existingUser = await findUserByEmail(ctx, args.profile.email);

      if (!existingUser) {
        throw new Error(`User ${args.profile.email} does not exist`);
      }

      if (existingUser.disabledAt !== undefined) {
        throw new Error(`User ${args.profile.email} is disabled.`);
      }

      if (args.type === "oauth") {
        const invite = await findPendingInviteByEmail(
          ctx,
          normalizeEmail(args.profile.email),
        );
        if (invite) {
          await consumeInvite(ctx, invite._id, existingUser._id);
          console.log(`Invite accepted via Google by ${args.profile.email}`);
        }
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
    },
  },
});
