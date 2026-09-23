/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as apiKeys_auth from "../apiKeys/auth.js";
import type * as apiKeys_httpActions from "../apiKeys/httpActions.js";
import type * as apiKeys_internal from "../apiKeys/internal.js";
import type * as apiKeys_mutations from "../apiKeys/mutations.js";
import type * as apiKeys_queries from "../apiKeys/queries.js";
import type * as apiKeys_token from "../apiKeys/token.js";
import type * as apiKeys_validators from "../apiKeys/validators.js";
import type * as auth from "../auth.js";
import type * as bookmarkGroupPosts_internal from "../bookmarkGroupPosts/internal.js";
import type * as bookmarkGroupPosts_mutations from "../bookmarkGroupPosts/mutations.js";
import type * as bookmarkGroupPosts_queries from "../bookmarkGroupPosts/queries.js";
import type * as bookmarkGroups_internal from "../bookmarkGroups/internal.js";
import type * as bookmarkGroups_mutations from "../bookmarkGroups/mutations.js";
import type * as bookmarkGroups_publicQueries from "../bookmarkGroups/publicQueries.js";
import type * as bookmarkGroups_queries from "../bookmarkGroups/queries.js";
import type * as channelMembers_internal from "../channelMembers/internal.js";
import type * as channelMembers_mutations from "../channelMembers/mutations.js";
import type * as channelMembers_queries from "../channelMembers/queries.js";
import type * as channelPosts_internal from "../channelPosts/internal.js";
import type * as channelPosts_mutations from "../channelPosts/mutations.js";
import type * as channelPosts_queries from "../channelPosts/queries.js";
import type * as channels_internal from "../channels/internal.js";
import type * as channels_mutations from "../channels/mutations.js";
import type * as channels_queries from "../channels/queries.js";
import type * as config from "../config.js";
import type * as crons from "../crons.js";
import type * as features_mutations from "../features/mutations.js";
import type * as features_publicQueries from "../features/publicQueries.js";
import type * as http from "../http.js";
import type * as invites_internal from "../invites/internal.js";
import type * as invites_mutations from "../invites/mutations.js";
import type * as invites_publicMutations from "../invites/publicMutations.js";
import type * as invites_publicQueries from "../invites/publicQueries.js";
import type * as invites_queries from "../invites/queries.js";
import type * as invites_token from "../invites/token.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_featureMode from "../lib/featureMode.js";
import type * as lib_mediaOnly from "../lib/mediaOnly.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_sha256 from "../lib/sha256.js";
import type * as lib_text from "../lib/text.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_workpool from "../lib/workpool.js";
import type * as migrations from "../migrations.js";
import type * as notifications_actions from "../notifications/actions.js";
import type * as notifications_internal from "../notifications/internal.js";
import type * as notifications_mutations from "../notifications/mutations.js";
import type * as postReads_internal from "../postReads/internal.js";
import type * as postReads_mutations from "../postReads/mutations.js";
import type * as postReads_publicQueries from "../postReads/publicQueries.js";
import type * as postAi_internal from "../postAi/internal.js";
import type * as postAi_mutations from "../postAi/mutations.js";
import type * as postAssets_contentTypes from "../postAssets/contentTypes.js";
import type * as postAssets_internal from "../postAssets/internal.js";
import type * as postAssets_mutations from "../postAssets/mutations.js";
import type * as postAssets_queries from "../postAssets/queries.js";
import type * as posts_actions from "../posts/actions.js";
import type * as posts_internal from "../posts/internal.js";
import type * as posts_mutations from "../posts/mutations.js";
import type * as posts_publicQueries from "../posts/publicQueries.js";
import type * as posts_queries from "../posts/queries.js";
import type * as tags_internal from "../tags/internal.js";
import type * as tags_mutations from "../tags/mutations.js";
import type * as tags_publicQueries from "../tags/publicQueries.js";
import type * as tags_queries from "../tags/queries.js";
import type * as siteSettings_internal from "../siteSettings/internal.js";
import type * as siteSettings_mutations from "../siteSettings/mutations.js";
import type * as users_internal from "../users/internal.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_publicQueries from "../users/publicQueries.js";
import type * as users_queries from "../users/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  "apiKeys/auth": typeof apiKeys_auth;
  "apiKeys/httpActions": typeof apiKeys_httpActions;
  "apiKeys/internal": typeof apiKeys_internal;
  "apiKeys/mutations": typeof apiKeys_mutations;
  "apiKeys/queries": typeof apiKeys_queries;
  "apiKeys/token": typeof apiKeys_token;
  "apiKeys/validators": typeof apiKeys_validators;
  auth: typeof auth;
  "bookmarkGroupPosts/internal": typeof bookmarkGroupPosts_internal;
  "bookmarkGroupPosts/mutations": typeof bookmarkGroupPosts_mutations;
  "bookmarkGroupPosts/queries": typeof bookmarkGroupPosts_queries;
  "bookmarkGroups/internal": typeof bookmarkGroups_internal;
  "bookmarkGroups/mutations": typeof bookmarkGroups_mutations;
  "bookmarkGroups/publicQueries": typeof bookmarkGroups_publicQueries;
  "bookmarkGroups/queries": typeof bookmarkGroups_queries;
  "channelMembers/internal": typeof channelMembers_internal;
  "channelMembers/mutations": typeof channelMembers_mutations;
  "channelMembers/queries": typeof channelMembers_queries;
  "channelPosts/internal": typeof channelPosts_internal;
  "channelPosts/mutations": typeof channelPosts_mutations;
  "channelPosts/queries": typeof channelPosts_queries;
  "channels/internal": typeof channels_internal;
  "channels/mutations": typeof channels_mutations;
  "channels/queries": typeof channels_queries;
  config: typeof config;
  crons: typeof crons;
  "features/mutations": typeof features_mutations;
  "features/publicQueries": typeof features_publicQueries;
  http: typeof http;
  "invites/internal": typeof invites_internal;
  "invites/mutations": typeof invites_mutations;
  "invites/publicMutations": typeof invites_publicMutations;
  "invites/publicQueries": typeof invites_publicQueries;
  "invites/queries": typeof invites_queries;
  "invites/token": typeof invites_token;
  "lib/access": typeof lib_access;
  "lib/auth": typeof lib_auth;
  "lib/env": typeof lib_env;
  "lib/featureMode": typeof lib_featureMode;
  "lib/mediaOnly": typeof lib_mediaOnly;
  "lib/password": typeof lib_password;
  "lib/sha256": typeof lib_sha256;
  "lib/text": typeof lib_text;
  "lib/validators": typeof lib_validators;
  "lib/workpool": typeof lib_workpool;
  migrations: typeof migrations;
  "notifications/actions": typeof notifications_actions;
  "notifications/internal": typeof notifications_internal;
  "notifications/mutations": typeof notifications_mutations;
  "postReads/internal": typeof postReads_internal;
  "postReads/mutations": typeof postReads_mutations;
  "postReads/publicQueries": typeof postReads_publicQueries;
  "postAi/internal": typeof postAi_internal;
  "postAi/mutations": typeof postAi_mutations;
  "postAssets/contentTypes": typeof postAssets_contentTypes;
  "postAssets/internal": typeof postAssets_internal;
  "postAssets/mutations": typeof postAssets_mutations;
  "postAssets/queries": typeof postAssets_queries;
  "posts/actions": typeof posts_actions;
  "posts/internal": typeof posts_internal;
  "posts/mutations": typeof posts_mutations;
  "posts/publicQueries": typeof posts_publicQueries;
  "posts/queries": typeof posts_queries;
  "tags/internal": typeof tags_internal;
  "tags/mutations": typeof tags_mutations;
  "tags/publicQueries": typeof tags_publicQueries;
  "tags/queries": typeof tags_queries;
  "siteSettings/internal": typeof siteSettings_internal;
  "siteSettings/mutations": typeof siteSettings_mutations;
  "users/internal": typeof users_internal;
  "users/mutations": typeof users_mutations;
  "users/publicQueries": typeof users_publicQueries;
  "users/queries": typeof users_queries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  aiWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"aiWorkpool">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
