# Convex Auth v2 upgrade

Date: 2026-09-23
Status: approved for implementation planning
Branch / worktree: `auth-v2` at `.worktrees/auth-v2`
Do not merge to `main` until the human partner confirms.

## Goal

Replace `@convex-dev/auth` v1 (`^0.0.95`, Auth.js-style `convexAuth`) with Convex Auth v2 (`@convex-dev/auth@alpha`) using the v2 default wiring: `setupCore`, provider components, and `attachUserCallbacks`. Keep every current product auth behavior, then add:

- automatic guest (anonymous) sessions for personalization
- passkeys for members
- a member account page
- Google domain auto-create for members
- `members` feature gating
- a documented, observable cutover off v1 password hashes

Post tags, channels, API keys, and publishing are unchanged except where they read identity.

## Constraints and risks

Convex Auth v2 is alpha. APIs and component schemas can change. There is no guaranteed upgrade path to stable v2. Official docs currently say not to use it in production. This spec still targets the existing personal-dev and production deployments because that is the requested work. Revisit before a production ship if the alpha has moved.

There is no official v1 → v2 data migration. Password hashes cannot be converted without the plaintext password. The cutover is lazy: verify the leftover v1 pbkdf2 `authAccounts` row on sign-in, then enroll a v2 Argon2id credential.

Work happens only on `auth-v2`. No merge to `main` until explicit confirmation.

## Current system (v1)

- Providers: Google OAuth and/or password, independently toggled on `siteSettings` (`googleSignIn`, `passwordSignIn`), gated by env (`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`, `AUTH_PASSWORD_ENABLED`). At least one available method must stay on.
- Member creation: a `users` row must already exist. `createOrUpdateUser` throws if the email is missing. Admin Users, invites, and `npm run create-user` provision the row. Google does not auto-create.
- Password crypto: app-supplied pbkdf2 in `convex/lib/password.ts`, stored on `authAccounts`.
- Sessions: 90 days (`SESSION_DURATION_MS`) for `totalDurationMs` and `inactiveDurationMs`.
- Access: `getAuthedUser` treats disabled users as signed out. `requireAuth` empties public reads when nobody is signed in. `SiteGate` redirects signed-out visitors to `/signin` when `requireAuth` is on.
- FeatureMode today: `off | on | adminOnly`.
- Password reset: signed-in users have no UI. Admins use `npm run reset-password` / `admin:resetPassword`.
- Account UI: `/whoami` is display-only.
- HTTP: `auth.addHttpRoutes(http)` at `/api/auth`. Static hosting is registered after that so it does not swallow auth.

## Target architecture

v2 owns sessions, password hashes, usernames, passkeys, anonymous accounts, and Google OAuth in components. The app keeps the `users` table as the product identity document.

```
Browser
  ConvexAuthProvider (refreshSession, signOut)
  auto signInAnonymous when requireAuth is off and there is no session
  Sign-in: Google / password / passkey
  /account: profile, password, passkeys, Google link
       |
Convex app functions
  convex/auth.ts          setupCore + provider setups
  convex/auth/users.ts    createUser / onSignIn per provider
  convex/lib/auth.ts      getAuthedUser, getMember, requireAdmin
  convex/lib/access.ts    resolvePublicViewer (members-only when requireAuth)
       |
users table (app)         guest | user | admin + email, name, authGeneration
v2 components             auth, password, username, passkey, anonymous, oauthGoogle
legacy tables (temporary) authAccounts + v1 session tables until cutover
```

`setupCore({ component: components.auth, usersTable: "users" })`. Session duration remains 90 days if the v2 core accepts the same options; if the alpha API names differ, set the equivalent total and idle lifetime to 90 days.

## Identity model

### `users` table

Keep the table. Stop spreading `authTables.users` fields that v2 no longer owns. App fields:

| Field | Meaning |
| --- | --- |
| `email` | Optional. Required for members. Guests have none. Unique when present (existing `email` index). |
| `name` | Display name. Editable on `/account` for members. Guests may be empty. |
| `image` | Optional. Google profile image when present. |
| `userType` | `"guest" \| "user" \| "admin"`. Stored as those literals (validator becomes a union). |
| `disabledAt` | Members only. Guests are deleted, not disabled. |
| `authGeneration` | Members only: `"v1" \| "v2"`. Absent on guests. |

Indexes: keep `email`. Add `by_userType` for Admin Users vs Guests queries.

`userType === "guest"` is a personalization identity. `user` and `admin` are members.

### Who may exist

| Path | Result |
| --- | --- |
| Auto anonymous (requireAuth off, no session) | Insert `userType: "guest"`. No email. |
| Admin create-user / invite / CLI | Insert `user` or `admin` with email. No username until they add password or passkey. After this upgrade, those tools write v2 credentials only and set `authGeneration: "v2"` when a password is included; email-only provisioned members stay `"v1"` until their first v2 sign-in (Google, password, or passkey). Existing members with a leftover pbkdf2 hash stay `"v1"` until lazy migrate or another v2 sign-in. |
| Google, invited email | Look up member by email. Consume invite. Do not insert. |
| Google, email domain on the admin allowlist | If a member exists, sign them in. If not, insert `user` (or `admin` when `ADMIN_USERS` matches) with that email. |
| Google, no invite and domain not allowed | Reject. Do not create a guest-to-member upgrade through Google without one of those two. |
| Password or passkey `createUser` | Never insert a member. Resolve the existing member by username (password/passkey) or reject. |
| Passkey for an unknown username | Fail. No account creation. |

`REJECT_USERS` still bans emails. Disabled members still fail sign-in (except `getCurrentUser` for `/limbo`).

### Helpers

Replace the current “any non-disabled user” notion with two layers:

- `getAuthedUser(ctx)` — non-disabled `users` row for the session, including guests. Used for read receipts and other personalization.
- `getMember(ctx)` — `getAuthedUser` whose `userType` is `user` or `admin`.
- `requireMember` — throws if `getMember` is null. Rename current `requireUser` call sites in the same change.
- `requireAdmin` — member with `userType === "admin"`.
- `isMember(user)` / `isGuest(user)`.

Disabled members still read as signed out everywhere except `getCurrentUser`.

Guests are never admins, never channel members, never authors, never API-key owners.

## Access control

### `requireAuth`

Existing admin toggle. New meaning: **members-only site**.

When on:

- `resolvePublicViewer.blocked` is true unless `getMember` returns a user.
- Guests and signed-out callers get empty public reads.
- `SiteGate` redirects to `/signin` unless the session is a member (not merely `isAuthenticated`).
- Do not auto-start a guest session.

When off:

- Listed published posts stay readable as they are today.
- If there is no session, the client starts an anonymous session so read receipts and similar features have a stable `users` id.

API keys continue to skip `requireAuth`. Channel rules still apply to members.

### FeatureMode

`FeatureMode` becomes `"off" | "on" | "members" | "adminOnly"`.

| Mode | Visible when |
| --- | --- |
| `off` | Never |
| `on` | Viewer can see the site at all (guests included if `requireAuth` is off) |
| `members` | `userType` is `user` or `admin` |
| `adminOnly` | `userType` is `admin` |

`storedFeatureModeValidator` still accepts booleans and the three old strings for rows that have not been rewritten. `parseFeatureMode` treats unknown values as `"off"`. Client `src/lib/features.ts` matches.

`featureVisible` / `featureOn` take a viewer `{ isMember, isAdmin }` (or the user doc). Queries for a feature that is not visible still use Convex `skip`.

Admin Settings `ModePicker` gains a Members button.

Post tags stay an organizational feature. They do not affect visibility. Tag UI uses the same FeatureMode rules as today (`tagNav`), now with a Members option.

## Providers (v2 components)

Register in `convex/convex.config.ts`:

- `@convex-dev/auth/core`
- password
- username
- passkey
- anonymous
- Google OAuth (`name: "oauthGoogle"`, `httpPrefix: "/oauth/google"`)

Env on the app:

- `AUTH_PRIVATE_KEY`, `AUTH_JWKS` (v2 names; generate with `jose` headlessly, never the interactive `npx @convex-dev/auth` wizard)
- `AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET` (read `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` as fallback during cutover)
- `AUTH_PASSWORD_ENABLED`, `AUTH_GOOGLE_ENABLED` keep their current meaning
- `AUTH_PASSKEY_RP_ID`, `AUTH_PASSKEY_ORIGIN` (rpId without scheme/port; origin with scheme and port)

`http.ts` stops calling `auth.addHttpRoutes`. Component HTTP prefixes must be registered so static hosting does not swallow `/auth` and `/oauth/google`. Google Cloud console must add `https://<CONVEX_SITE_URL>/oauth/google/callback` (dev and prod). Keep the old Auth.js callback URL until cutover is done if it still receives traffic; after v2 is live, only the new callback is valid.

`allowedRedirectOrigins` for Google: Vite origin (`http://localhost:5173`), the static-hosting origin for the deployment (`https://peaceful-magpie-541.convex.site` on personal dev, `https://blog.grahamalot.com` on prod). Drive this from env rather than hard-coding.

### Google

`setupGoogle` + `useSignInWithGoogle`.

`createUser` / `onSignIn`:

1. Require a verified email on the Google profile.
2. Reject if Google sign-in is off in settings or env.
3. Reject `REJECT_USERS` and disabled members.
4. If a member with that email exists: return that id, consume a pending invite, patch name/image, promote via `ADMIN_USERS` if needed, set `authGeneration: "v2"`.
5. Else if the email’s domain is in `siteSettings.googleAllowedDomains` (normalized lowercase, no `@`): insert a member, then the same patches.
6. Else reject.

Linking: a member signed in with password/passkey whose email matches can attach Google from `/account` (same `createUser` lookup). Unlink is an app mutation that removes the Google account from the v2 OAuth component if another member method remains.

### Password

`setupUsernamePassword`. Identifier is the **username** stored in the username component, not the email. Email remains on `users` for invites and Google.

Public app wrapper around v2 `signInWithPassword`:

1. If password sign-in is off, reject.
2. Try v2 `signInWithPassword`.
3. On `USER_NOT_FOUND` / `INVALID_CREDENTIALS`, run legacy verify: look up member, then leftover `authAccounts` password row, `verifyPassword` (pbkdf2).
4. If legacy verifies: create the v2 username (default `email` local-part, uniqueness suffix `-2`, `-3`, … if needed), enroll the plaintext password into the v2 password component, mark `authGeneration: "v2"`, issue the v2 session, leave the old hash in place until cutover (do not delete until the removal checklist).
5. Merge the current guest into this member (see Merge).

Sign-up from the public Sign-in page does not exist. Invite accept with password, `/account` add-password, and CLI are the only ways to set a password.

`changePassword` is exported and used on `/account` when the member already has a v2 password.

Add-password (no current password): member is signed in, has no password credential, chooses username + password. App mutation talks to the username + password components. Reject if password sign-in is unavailable and they would have no remaining method… they are already a member via Google/passkey, so adding a password is always allowed as a second method even if the password **sign-in** toggle is off. (They cannot use it at `/signin` until the toggle is on.)

CLI `admin:resetPassword` and `create-user` with a password must write v2 credentials (Argon2id via the password component, or the component’s documented admin/internal set-password). They must not write new pbkdf2 `authAccounts` rows after the upgrade ships. If the alpha exposes no admin set-password, wrap the same enroll path used by add-password.

### Passkey

`setupUsernamePasskey` with `rpId` / `origin` from env.

Passkey **never** creates a member. The identifier-first “free username signs up” behavior is disabled in app code: `finishSignUp` is not offered on `/signin`; unknown username is an error. Adding a passkey happens only on `/account` via `useAddPasskey` after they are a member.

If they have no username yet, adding the first passkey (or first password) is when they choose it.

Sign-in: username field + passkey. Do not wire `finishSignUp` on `/signin`. If the hook requires the argument, pass it and treat a sign-up result as failure in `createUser` (no insert). Autofill is allowed on that one mounted hook.

Export management functions: `listPasskeys`, `renamePasskey`, add and remove ceremonies. Last passkey: follow v2 (`LAST_PASSKEY` — cannot remove the only passkey). Also cannot remove a passkey if it is the last remaining member sign-in method (no password and no Google).

### Anonymous / guests

`setupAnonymous`. Client: after auth state is known, if `requireAuth` is off and the viewer is unauthenticated, call `signInAnonymous` once. Do not loop. Do not run this on `/signin` in a way that races a member sign-in; start guest from the provider after a failed or absent session on pages that are not completing OAuth.

`createUser` for anonymous always inserts a guest.

## Guest → member merge

When a member session is established and the browser still holds a guest user id (OAuth `state`, or a client-passed previous user id stored before redirect, or `onSignIn` seeing a different signed-in user in a handoff table), merge:

Owned rows to re-point from guest → member:

- `readCursors` (one row per user; if both exist, keep `max(readBefore)` and delete the guest row)
- `postReads` (per post: keep the later `lastReadAt`; delete the other)

Do not merge:

- `channelMembers` (guests are never members)
- `bookmarkGroups` (admin-owned)
- posts, API keys, invites

Then delete leftover v2 anonymous credentials for the guest if the API allows, and delete the guest `users` row.

If merge cannot see the guest id (user signed in on another device), skip. No cross-device guest merge.

## Account page

Route: `/account`. `/whoami` redirects to `/account`. Header: members get an Account link; guests do not. Sign out stays in the menu.

Visible only to members. Guests hitting `/account` go to `/signin`.

Contents:

- Display: name, email, username (or “not set”), user type, auth generation, profile image if any
- Edit display name
- Change username (v2 username component; uniqueness errors surface)
- Change password if a password exists (current + new, hidden username field for password managers)
- Add first password + username if none exists
- Passkeys: list, add, rename, remove
- Link Google / Unlink Google
- Cannot unlink or remove the last remaining member method
- Sign out
- `/.well-known/change-password` redirects to `/account#password` (static hosting SPA fallback or a tiny HTTP route)

No forgot-password email. Admin CLI remains for that.

## Admin

### Settings

Existing rows stay. Add:

- Passkey sign-in On/Off, same pattern as Google/password. Keep at least one of Google, password, passkey on. Guest is not a member method and does not count.
- Google allowed domains: list of domains (e.g. `company.com`), add/remove. Empty list = no domain auto-create (invite/admin/CLI only, plus existing members).
- FeatureMode picker includes Members.
- Copy for Require sign-in: members-only; guests and signed-out cannot read; auto-guest is skipped while on.

### Users

Two sections on `/admin/users`:

1. **Members** — current table (`user` and `admin` only), plus an Auth column (`v1` / `v2`). Disable / role changes unchanged.
2. **Guests** — paginated guest rows: id, created time, optional delete. No role, no invite, no disable. A count at the top.

Do not mix guests into the members pagination.

## Sign-in and invite UI

`/signin`:

- Continue with Google when enabled
- Email is **not** the password identifier. Password form is username + password when password is on
- Continue with a passkey when passkey is on (username field, `autoComplete="username webauthn"`). Only one passkey hook mounted
- No “create account”. Copy points at invite / admin
- No “continue as guest” button (automatic when `requireAuth` is off)

`/invite/:token`:

- Same method picker as today (Google vs password when both on)
- Password accept: choose username + password, then v2 sign-in
- After Google, they may add a passkey on `/account`

## Legacy password cutover

### During overlap

- Keep v1 `authAccounts` (and any other v1 auth tables still in the app schema) as **legacy**, not via `authTables` from v1 once the package is gone. Copy the leftover table validators needed for reads/deletes into `convex/schema.ts`.
- `authGeneration`:
  - `"v1"` — member has a leftover v1 password hash and has not completed v2 password enroll or any other v2 sign-in
  - `"v2"` — member has signed in through v2 (Google, migrated password, new password, or passkey)
- Admin members list shows this field. Optional filter: still on v1.
- Sign-in logs a single info line on successful lazy migrate: email (redact in production if noisy), user id, `authGeneration v1 → v2`.

### Removal checklist (run later, separate change)

Document this in `docs/auth-v1-removal.md` in the same PR/branch so it is not tribal knowledge:

1. Admin Users shows zero members with `authGeneration: "v1"`.
2. Confirm no code path writes `authAccounts`.
3. Remove legacy verify in the password sign-in wrapper.
4. Delete leftover v1 tables from the schema (`authAccounts`, `authSessions`, `authRefreshTokens`, `authVerificationCodes`, `authVerifiers`, `authRateLimits`, or whichever remain).
5. Remove `convex/lib/password.ts` pbkdf2 helpers if unused.
6. Remove `JWT_PRIVATE_KEY` / `JWKS` if v2 uses only `AUTH_PRIVATE_KEY` / `AUTH_JWKS`.
7. Remove old Google callback URLs from the Google Cloud client.
8. Ship that cleanup as its own change after this upgrade is on `main`.

Until step 1 is true, do not delete v1 hashes (a user might still need the lazy path).

## Client wiring

- `ConvexAuthProvider` receives `api={{ refreshSession, signOut }}` (or `api.auth` if that is the v2 shape).
- Replace `useAuthActions().signIn("google"|"password")` with v2 hooks.
- `useConvexAuth().isAuthenticated` is true for guests. Every UI that meant “member” (`Header` admin links, `SiteGate` requireAuth, Sign-in redirect to `/admin`) must use `getCurrentUser.userType` / `isAdmin`, not auth-alone.
- Auto-guest effect lives in one place (provider or a small `GuestSession` component under the provider) so it cannot double-mount.

## CLI and env

- `scripts/create_user.cjs` / `scripts/reset_password.cjs`: same UX, v2 backend.
- `scripts/setup.mjs`: generate `AUTH_PRIVATE_KEY` / `AUTH_JWKS`; keep Google env; set passkey rpId/origin per deployment.
- Google OAuth setup doc: new callback path and env names.

## Testing

convex-test (and existing siteAccess / passwordReset / invites tests, updated):

- Guest insert on anonymous `createUser`; guest is not `getMember`; `requireAdmin` fails.
- `requireAuth` on: guest and signed-out public reads empty; member succeeds.
- `requireAuth` off: guest can read listed published posts.
- FeatureMode `members`: hidden from guest, visible to user/admin.
- Google `createUser`: existing email; domain allowlist insert; reject unknown domain; reject `REJECT_USERS`; consume invite.
- Password: v2 sign-in; lazy migrate from pbkdf2 fixture; unknown user fails; public sign-up does not exist.
- Passkey: unknown username does not create; member can add; cannot remove last method.
- Merge: guest `postReads` / `readCursors` move; guest row gone.
- Unlink Google refused when it is the only method.
- Keep-one-member-method-on includes passkey.
- Disabled member still hits limbo.

Frontend: tsc, oxlint, vitest. Do not start Vite unless asked. Browser-verify later against a server the human partner started.

## Out of scope

- Forgot-password email / Resend
- Apple / GitHub OAuth
- Open public registration
- Merging guests across devices
- Deleting v1 tables in this change
- Merging `auth-v2` to `main` without confirmation
- Changing API key auth

## Implementation notes

- Follow Convex guidelines in `convex/_generated/ai/guidelines.md`. Internal mutations first; public functions check auth then call internal.
- Auth-related functions live under `convex/auth/` (or keep `convex/auth.ts` as the setup barrel that re-exports provider functions the client must call from one module, which v2 examples require).
- Do not run the interactive `@convex-dev/auth` CLI.
- Pin `@convex-dev/auth@alpha` and verify exports against `node_modules` types; the preview docs can lag the package.
- `jose` is already a dependency for key generation.
- Static hosting vs auth HTTP: preserve the current “auth routes win, static hosting catches the rest” ordering using v2 prefixes.

## Success criteria

- Members can sign in with Google (including domain auto-create and invited emails), username+password (including one-time lazy v1 migrate), and username+passkey.
- Visitors get a guest session when `requireAuth` is off; guests never satisfy `requireAuth` or admin.
- `/account` supports profile, password add/change, passkeys, Google link/unlink, username and name edits.
- Admin Settings and Users expose the new toggles, domain list, FeatureMode Members, auth generation, and Guests section.
- Existing users rows, posts, channels, tags, and API keys keep working.
- A written v1-removal checklist exists, and Admin can see who is still on v1.
- All of the above is on `auth-v2` only until the human partner confirms a merge.
