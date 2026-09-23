import { setupCore } from "@convex-dev/auth/core/setup";
import { setupAnonymous } from "@convex-dev/auth/providers/anonymous/setup";
import { setupUsernamePassword } from "@convex-dev/auth/providers/password/setup";
import { setupUsernamePasskey } from "@convex-dev/auth/providers/passkey/setup";
import { setupGoogle } from "@convex-dev/auth/providers/oauth/google";
import { components, internal } from "./_generated/api";

const SESSION_SECONDS = 60 * 60 * 24 * 90;

function redirectOrigins(): string[] {
  const fromEnv = process.env.AUTH_REDIRECT_ORIGINS;
  if (fromEnv) {
    return fromEnv.split(",").map((origin) => origin.trim()).filter((origin) => origin.length > 0);
  }
  const origins = ["http://localhost:5173"];
  const site = process.env.SITE_URL?.replace(/\/$/, "");
  if (site) origins.push(site);
  return origins;
}

export const core = setupCore({
  component: components.auth,
  usersTable: "users",
  accessTokenTtlSeconds: 60,
  refreshTokenTtlSeconds: SESSION_SECONDS,
});

export const { signOut, refreshSession, isAuthenticated } = core;

export const { signInAnonymous } = setupAnonymous(core, {
  component: components.authAnonymous,
}).attachUserCallbacks({
  createUser: internal.auth.users.createAnonymousUser,
});

export const {
  signUpWithPassword,
  signInWithPassword: signInWithPasswordV2,
  changePassword,
} = setupUsernamePassword(core, {
  component: components.authPasswordProvider,
  usernameComponent: components.authUsername,
}).attachUserCallbacks({
  createUser: internal.auth.users.createPasswordUser,
});

export const { startSignInGoogle, completeSignInGoogle } = setupGoogle(core, {
  component: components.oauthGoogle,
  allowedRedirectOrigins: redirectOrigins(),
}).attachUserCallbacks({
  createUser: internal.auth.users.createGoogleUser,
  onSignIn: internal.auth.users.onGoogleSignIn,
});

const passkey = setupUsernamePasskey(core, {
  component: components.authPasskey,
  usernameComponent: components.authUsername,
  rpId: process.env.AUTH_PASSKEY_RP_ID ?? "localhost",
  origin: process.env.AUTH_PASSKEY_ORIGIN ?? "http://localhost:5173",
}).attachUserCallbacks({
  createUser: internal.auth.users.createPasskeyUser,
});

export const {
  startSignIn: startPasskeySignIn,
  startAutofillSignIn: startPasskeyAutofillSignIn,
  finishSignIn: finishPasskeySignIn,
  listPasskeys,
  renamePasskey,
  startAddPasskey,
  verifyAddPasskey,
  finishAddPasskey,
  startRemovePasskey,
  finishRemovePasskey,
} = passkey;
