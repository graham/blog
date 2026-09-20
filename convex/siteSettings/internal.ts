import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  featuresValidator,
  siteSettingsValidator,
  themeIdValidator,
} from "../lib/validators";
import type { Infer } from "convex/values";

type Ctx = QueryCtx | MutationCtx;
type Features = Infer<typeof featuresValidator>;
type ThemeId = Infer<typeof themeIdValidator>;
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
];

export const DEFAULT_FEATURES: Features = {
  bookmarks: false,
  timings: false,
  calendar: false,
  infiniteScroll: false,
  theme: { enabled: false, id: "paper" },
};

export const DEFAULT_SETTINGS: Settings = {
  requireAuth: false,
  bookmarksEnabled: false,
  features: DEFAULT_FEATURES,
};

function parseThemeId(value: string | undefined): ThemeId {
  if (value && (THEME_IDS as string[]).includes(value)) {
    return value as ThemeId;
  }
  return "paper";
}

export async function readSiteSettings(ctx: Ctx): Promise<Settings> {
  const row = await ctx.db.query("siteSettings").first();
  if (!row) return { ...DEFAULT_SETTINGS, features: { ...DEFAULT_FEATURES } };
  const features: Features = {
    bookmarks: row.bookmarksEnabled === true,
    timings: row.timingsShowDelta === true,
    calendar: row.calendar === true || row.timingsPage === true,
    infiniteScroll: row.infiniteScroll === true,
    theme: {
      enabled: row.themeEnabled === true,
      id: parseThemeId(row.themeId),
    },
  };
  return {
    requireAuth: row.requireAuth,
    bookmarksEnabled: features.bookmarks,
    features,
  };
}

function toRow(settings: Settings, updatedBy: Id<"users">) {
  return {
    requireAuth: settings.requireAuth,
    bookmarksEnabled: settings.features.bookmarks,
    timingsShowDelta: settings.features.timings,
    timingsPage: settings.features.calendar,
    calendar: settings.features.calendar,
    infiniteScroll: settings.features.infiniteScroll,
    themeEnabled: settings.features.theme.enabled,
    themeId: settings.features.theme.id,
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
    bookmarksEnabled: settings.features.bookmarks,
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
    return await writeSettings(
      ctx,
      { ...current, requireAuth: args.requireAuth },
      args.updatedBy,
    );
  },
});

export const setBookmarksEnabled = internalMutation({
  args: { bookmarksEnabled: v.boolean(), updatedBy: v.id("users") },
  returns: siteSettingsValidator,
  handler: async (ctx, args) => {
    const current = await readSiteSettings(ctx);
    const features: Features = {
      ...current.features,
      bookmarks: args.bookmarksEnabled,
    };
    return await writeSettings(
      ctx,
      { ...current, bookmarksEnabled: args.bookmarksEnabled, features },
      args.updatedBy,
    );
  },
});

export const setFeatures = internalMutation({
  args: {
    updatedBy: v.id("users"),
    bookmarks: v.optional(v.boolean()),
    timings: v.optional(v.boolean()),
    calendar: v.optional(v.boolean()),
    infiniteScroll: v.optional(v.boolean()),
    themeEnabled: v.optional(v.boolean()),
    themeId: v.optional(themeIdValidator),
  },
  returns: featuresValidator,
  handler: async (ctx, args) => {
    const current = await readSiteSettings(ctx);
    const features: Features = {
      bookmarks: args.bookmarks ?? current.features.bookmarks,
      timings: args.timings ?? current.features.timings,
      calendar: args.calendar ?? current.features.calendar,
      infiniteScroll: args.infiniteScroll ?? current.features.infiniteScroll,
      theme: {
        enabled: args.themeEnabled ?? current.features.theme.enabled,
        id: args.themeId ?? current.features.theme.id,
      },
    };
    const saved = await writeSettings(
      ctx,
      { ...current, bookmarksEnabled: features.bookmarks, features },
      args.updatedBy,
    );
    return saved.features;
  },
});
