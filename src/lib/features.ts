export type Features = {
  bookmarks: boolean;
  timings: boolean;
  calendar: boolean;
  infiniteScroll: boolean;
  theme: {
    enabled: boolean;
    id: "paper" | "ink" | "ocean" | "forest" | "sunset" | "violet" | "contrast" | "news";
  };
};

export const DEFAULT_FEATURES: Features = {
  bookmarks: false,
  timings: false,
  calendar: false,
  infiniteScroll: false,
  theme: { enabled: false, id: "paper" },
};
