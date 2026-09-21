export const THEME_IDS = [
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
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const THEMES: Array<{
  id: ThemeId;
  name: string;
  swatch: string;
  description: string;
}> = [
  {
    id: "paper",
    name: "Paper",
    swatch: "#f7f7f5",
    description: "The default warm off-white page with blue links.",
  },
  {
    id: "ink",
    name: "Ink",
    swatch: "#121212",
    description: "Dark charcoal background, light text, cyan accents.",
  },
  {
    id: "ocean",
    name: "Ocean",
    swatch: "#e8f1f6",
    description: "Cool blue-gray page with teal links.",
  },
  {
    id: "forest",
    name: "Forest",
    swatch: "#eef3ea",
    description: "Soft green paper with olive headings and links.",
  },
  {
    id: "sunset",
    name: "Sunset",
    swatch: "#fbf3ea",
    description: "Cream page with terracotta accents.",
  },
  {
    id: "violet",
    name: "Violet",
    swatch: "#f3eef8",
    description: "Lavender page with purple links.",
  },
  {
    id: "contrast",
    name: "Contrast",
    swatch: "#ffffff",
    description: "Black on white, yellow highlights, heavy borders.",
  },
  {
    id: "news",
    name: "News",
    swatch: "#f4f1e8",
    description: "Newsprint cream with crimson links.",
  },
  {
    id: "midnight",
    name: "Midnight",
    swatch: "#0b1220",
    description: "Deep navy background, silver text, bright blue accents.",
  },
  {
    id: "ember",
    name: "Ember",
    swatch: "#1a110c",
    description: "Warm near-black page, cream text, amber accents.",
  },
  {
    id: "signal",
    name: "Signal",
    swatch: "#ffffff",
    description: "White page, black type, magenta links, cyan and yellow highlights.",
  },
  {
    id: "citrus",
    name: "Citrus",
    swatch: "#fffbeb",
    description: "Bright cream page, black type, orange links, lime and blue.",
  },
];

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value);
}
