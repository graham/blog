import type { ThemeId } from "./themes";

export type FeatureMode = "off" | "on" | "members" | "adminOnly";

export type Features = {
  bookmarks: FeatureMode;
  timings: FeatureMode;
  calendar: FeatureMode;
  infiniteScroll: FeatureMode;
  tagNav: FeatureMode;
  readReceipts: FeatureMode;
  imagesOnly: boolean;
  sortOrder: "created" | "updated";
  theme: {
    enabled: boolean;
    id: ThemeId;
  };
};

export const DEFAULT_FEATURES: Features = {
  bookmarks: "off",
  timings: "off",
  calendar: "off",
  infiniteScroll: "off",
  tagNav: "off",
  readReceipts: "off",
  imagesOnly: false,
  sortOrder: "created",
  theme: { enabled: false, id: "paper" },
};

export function featureOn(
  mode: FeatureMode,
  viewer: { isMember: boolean; isAdmin: boolean },
): boolean {
  if (mode === "off") return false;
  if (mode === "on") return true;
  if (mode === "members") return viewer.isMember;
  return viewer.isAdmin;
}
