import { v } from "convex/values";

// Every palette is either light or dark. The site has one of each; viewers see
// the one that matches their light/dark toggle.
export const LIGHT_THEME_IDS = [
  "paper",
  "ocean",
  "forest",
  "sunset",
  "violet",
  "contrast",
  "news",
  "signal",
  "citrus",
] as const;

export const DARK_THEME_IDS = ["ink", "midnight", "ember"] as const;

export type LightThemeId = (typeof LIGHT_THEME_IDS)[number];
export type DarkThemeId = (typeof DARK_THEME_IDS)[number];

export const DEFAULT_LIGHT_THEME: LightThemeId = "paper";
export const DEFAULT_DARK_THEME: DarkThemeId = "ink";

export const lightThemeIdValidator = v.union(
  ...LIGHT_THEME_IDS.map((id) => v.literal(id)),
);
export const darkThemeIdValidator = v.union(...DARK_THEME_IDS.map((id) => v.literal(id)));

export function isLightThemeId(value: unknown): value is LightThemeId {
  return (LIGHT_THEME_IDS as readonly unknown[]).includes(value);
}

export function isDarkThemeId(value: unknown): value is DarkThemeId {
  return (DARK_THEME_IDS as readonly unknown[]).includes(value);
}
