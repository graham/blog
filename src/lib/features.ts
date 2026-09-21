import type { ThemeId } from "./themes";

export type Features = {
  bookmarks: boolean;
  timings: boolean;
  calendar: boolean;
  infiniteScroll: boolean;
  imagesOnly: boolean;
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
  theme: { enabled: false, id: "paper" },
};
