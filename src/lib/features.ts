export type Features = {
  bookmarks: boolean;
  timings: {
    showTimeDelta: boolean;
    timingsPage: boolean;
  };
  infiniteScroll: boolean;
  theme: {
    enabled: boolean;
    id: "paper" | "ink" | "ocean" | "forest" | "sunset" | "violet" | "contrast" | "news";
  };
};

export const DEFAULT_FEATURES: Features = {
  bookmarks: false,
  timings: { showTimeDelta: false, timingsPage: false },
  infiniteScroll: false,
  theme: { enabled: false, id: "paper" },
};
