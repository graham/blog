import type { ThemeId } from "./themes";

export type FeatureMode = "off" | "on" | "adminOnly";

export type Features = {
  bookmarks: FeatureMode;
  timings: FeatureMode;
  calendar: FeatureMode;
  photos: FeatureMode;
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
  photos: "off",
  infiniteScroll: "off",
  tagNav: "off",
  readReceipts: "off",
  imagesOnly: false,
  sortOrder: "created",
  theme: { enabled: false, id: "paper" },
};

export function featureOn(mode: FeatureMode, isAdmin: boolean): boolean {
  return mode === "on" || (mode === "adminOnly" && isAdmin);
}
