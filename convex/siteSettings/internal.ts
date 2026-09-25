import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  featuresValidator,
  postSortValidator,
  siteSettingsValidator,
  themeIdValidator,
} from "../lib/validators";
import {
  coerceFeatureMode,
  featureModeValidator,
  parseFeatureMode,
} from "../lib/featureMode";

import type { Infer } from "convex/values";

type Ctx = QueryCtx | MutationCtx;
type Features = Infer<typeof featuresValidator>;
type ThemeId = Infer<typeof themeIdValidator>;
type PostSort = Infer<typeof postSortValidator>;
type Settings = Infer<typeof siteSettingsValidator>;

const THEME_IDS: ThemeId[] = [
  "paper",
  "ink",
  "ocean",
  "forest",
  "sunset",
  "violet",
  "contrast",
  "news",
  "midnight",
  "ember",
  "signal",
  "citrus",
];

export const DEFAULT_FEATURES: Features = {
  bookmarks: "off",
  timings: "off",
  calendar: "off",
  photos: "off",
  infiniteScroll: "off",
  tagNav: "off",
  readReceipts: "off",
  imagesOnly: false,
  sortOrder: "created",
  theme: { enabled: false, id: "paper" },
};

export const DEFAULT_SETTINGS: Settings = {
  requireAuth: false,
  bookmarksEnabled: false,
  googleSignIn: true,
  passwordSignIn: true,
  pushoverEnabled: false,
  features: DEFAULT_FEATURES,
};

function parseThemeId(value: string | undefined): ThemeId {
  if (value && (THEME_IDS as string[]).includes(value)) {
    return value as ThemeId;
  }
  return "paper";
}

function parseSortOrder(value: string | undefined): PostSort {
  return value === "updated" ? "updated" : "created";
}

export async function readSiteSettings(ctx: Ctx): Promise<Settings> {
  const row = await ctx.db.query("siteSettings").first();
  if (!row) return { ...DEFAULT_SETTINGS, features: { ...DEFAULT_FEATURES } };
  const features: Features = {
    bookmarks: parseFeatureMode(row.bookmarksEnabled),
    timings: parseFeatureMode(row.timingsShowDelta),
    calendar:
      row.calendar === undefined && row.timingsPage === true
        ? "on"
        : parseFeatureMode(row.calendar),
    photos: parseFeatureMode(row.photos),
    infiniteScroll: parseFeatureMode(row.infiniteScroll),
    tagNav: parseFeatureMode(row.tagNav),
    readReceipts: parseFeatureMode(row.readReceipts),
    imagesOnly: row.imagesOnly === true,
    sortOrder: parseSortOrder(row.postSort),
    theme: {
      enabled: row.themeEnabled === true,
      id: parseThemeId(row.themeId),
    },
  };
  return {
    requireAuth: row.requireAuth,
    bookmarksEnabled: features.bookmarks !== "off",
    googleSignIn: row.googleSignIn !== false,
    passwordSignIn: row.passwordSignIn !== false,
    pushoverEnabled: row.pushoverEnabled === true,
    features,
  };
}

function toRow(settings: Settings, updatedBy: Id<"users">) {
  return {
    requireAuth: settings.requireAuth,
    bookmarksEnabled: settings.features.bookmarks,
    timingsShowDelta: settings.features.timings,
    timingsPage: settings.features.calendar === "on",
    calendar: settings.features.calendar,
    photos: settings.features.photos,
    infiniteScroll: settings.features.infiniteScroll,
    tagNav: settings.features.tagNav,
    readReceipts: settings.features.readReceipts,
    imagesOnly: settings.features.imagesOnly,
    postSort: settings.features.sortOrder,
    themeEnabled: settings.features.theme.enabled,
    themeId: settings.features.theme.id,
    googleSignIn: settings.googleSignIn,
    passwordSignIn: settings.passwordSignIn,
    pushoverEnabled: settings.pushoverEnabled,
    updatedAt: Date.now(),
    updatedBy,
  };
}

async function writeSettings(
  ctx: MutationCtx,
  settings: Settings,
  updatedBy: Id<"users">,
): Promise<Settings> {
  const row = await ctx.db.query("siteSettings").first();
  const next = toRow(settings, updatedBy);
  if (row) {
    await ctx.db.patch("siteSettings", row._id, next);
  } else {
    await ctx.db.insert("siteSettings", next);
  }
  return {
    requireAuth: settings.requireAuth,
    bookmarksEnabled: settings.features.bookmarks !== "off",
    googleSignIn: settings.googleSignIn,
    passwordSignIn: settings.passwordSignIn,
    pushoverEnabled: settings.pushoverEnabled,
    features: settings.features,
  };
}

export const get = internalQuery({
  args: {},
  returns: siteSettingsValidator,
  handler: async (ctx) => {
    return await readSiteSettings(ctx);
  },
});

export const setRequireAuth = internalMutation({
  args: { requireAuth: v.boolean(), updatedBy: v.id("users") },
  returns: siteSettingsValidator,
  handler: async (ctx, args) => {
    const current = await readSiteSettings(ctx);
    return await writeSettings(ctx, { ...current, requireAuth: args.requireAuth }, args.updatedBy);
  },
});

export const setBookmarksEnabled = internalMutation({
  args: { bookmarksEnabled: v.boolean(), updatedBy: v.id("users") },
  returns: siteSettingsValidator,
  handler: async (ctx, args) => {
    const current = await readSiteSettings(ctx);
    const features: Features = {
      ...current.features,
      bookmarks: args.bookmarksEnabled ? "on" : "off",
    };
    return await writeSettings(
      ctx,
      { ...current, bookmarksEnabled: args.bookmarksEnabled, features },
      args.updatedBy,
    );
  },
});

export const setPushoverEnabled = internalMutation({
  args: { pushoverEnabled: v.boolean(), updatedBy: v.id("users") },
  returns: siteSettingsValidator,
  handler: async (ctx, args) => {
    const current = await readSiteSettings(ctx);
    return await writeSettings(
      ctx,
      { ...current, pushoverEnabled: args.pushoverEnabled },
      args.updatedBy,
    );
  },
});

export const setSignInMethods = internalMutation({
  args: {
    updatedBy: v.id("users"),
    googleSignIn: v.optional(v.boolean()),
    passwordSignIn: v.optional(v.boolean()),
  },
  returns: siteSettingsValidator,
  handler: async (ctx, args) => {
    const current = await readSiteSettings(ctx);
    const googleSignIn = args.googleSignIn ?? current.googleSignIn;
    const passwordSignIn = args.passwordSignIn ?? current.passwordSignIn;
    if (!googleSignIn && !passwordSignIn) {
      throw new ConvexError("Keep at least one sign-in method on");
    }
    const row = await ctx.db.query("siteSettings").first();
    const patch = {
      googleSignIn,
      passwordSignIn,
      updatedAt: Date.now(),
      updatedBy: args.updatedBy,
    };
    if (row) {
      await ctx.db.patch("siteSettings", row._id, patch);
    } else {
      await ctx.db.insert("siteSettings", {
        requireAuth: current.requireAuth,
        ...patch,
      });
    }
    return await readSiteSettings(ctx);
  },
});

export const setFeatures = internalMutation({
  args: {
    updatedBy: v.id("users"),
    bookmarks: v.optional(v.union(v.boolean(), featureModeValidator)),
    timings: v.optional(v.union(v.boolean(), featureModeValidator)),
    calendar: v.optional(v.union(v.boolean(), featureModeValidator)),
    photos: v.optional(v.union(v.boolean(), featureModeValidator)),
    infiniteScroll: v.optional(v.union(v.boolean(), featureModeValidator)),
    tagNav: v.optional(v.union(v.boolean(), featureModeValidator)),
    readReceipts: v.optional(v.union(v.boolean(), featureModeValidator)),
    imagesOnly: v.optional(v.boolean()),
    sortOrder: v.optional(postSortValidator),
    themeEnabled: v.optional(v.boolean()),
    themeId: v.optional(themeIdValidator),
  },
  returns: featuresValidator,
  handler: async (ctx, args) => {
    const current = await readSiteSettings(ctx);
    const features: Features = {
      bookmarks: coerceFeatureMode(args.bookmarks, current.features.bookmarks),
      timings: coerceFeatureMode(args.timings, current.features.timings),
      calendar: coerceFeatureMode(args.calendar, current.features.calendar),
      photos: coerceFeatureMode(args.photos, current.features.photos),
      infiniteScroll: coerceFeatureMode(args.infiniteScroll, current.features.infiniteScroll),
      tagNav: coerceFeatureMode(args.tagNav, current.features.tagNav),
      readReceipts: coerceFeatureMode(args.readReceipts, current.features.readReceipts),
      imagesOnly: args.imagesOnly ?? current.features.imagesOnly,
      sortOrder: args.sortOrder ?? current.features.sortOrder,
      theme: {
        enabled: args.themeEnabled ?? current.features.theme.enabled,
        id: args.themeId ?? current.features.theme.id,
      },
    };
    const saved = await writeSettings(
      ctx,
      { ...current, features },
      args.updatedBy,
    );
    return saved.features;
  },
});
