import type { ThemeId } from "./themes";

export type Features = {
  bookmarks: boolean;
  timings: boolean;
  calendar: boolean;
  infiniteScroll: boolean;
  imagesOnly: boolean;
  sortOrder: "created" | "updated";
  theme: {
    enabled: boolean;
    id: ThemeId;
  };
};

export const DEFAULT_FEATURES: Features = {
  bookmarks: false,
  timings: false,
  calendar: false,
  infiniteScroll: false,
  imagesOnly: false,
  sortOrder: "created",
  theme: { enabled: false, id: "paper" },
};
