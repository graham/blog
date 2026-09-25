import { isDarkThemeId, isLightThemeId } from "../../convex/lib/themes";

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
  colors: { background: string; foreground: string; accent: string };
}> = [
  {
    id: "paper",
    name: "Paper",
    swatch: "#f7f7f5",
    description: "The default warm off-white page with blue links.",
    colors: { background: "#f7f7f5", foreground: "#1f1f1f", accent: "#1d4ed8" },
  },
  {
    id: "ink",
    name: "Ink",
    swatch: "#121212",
    description: "Dark charcoal background, light text, cyan accents.",
    colors: { background: "#121212", foreground: "#ececec", accent: "#7dd3fc" },
  },
  {
    id: "ocean",
    name: "Ocean",
    swatch: "#e8f1f6",
    description: "Cool blue-gray page with teal links.",
    colors: { background: "#e8f1f6", foreground: "#123047", accent: "#0e7490" },
  },
  {
    id: "forest",
    name: "Forest",
    swatch: "#eef3ea",
    description: "Soft green paper with olive headings and links.",
    colors: { background: "#eef3ea", foreground: "#1c2b1a", accent: "#3f6212" },
  },
  {
    id: "sunset",
    name: "Sunset",
    swatch: "#fbf3ea",
    description: "Cream page with terracotta accents.",
    colors: { background: "#fbf3ea", foreground: "#3b2416", accent: "#c2410c" },
  },
  {
    id: "violet",
    name: "Violet",
    swatch: "#f3eef8",
    description: "Lavender page with purple links.",
    colors: { background: "#f3eef8", foreground: "#2e1065", accent: "#6d28d9" },
  },
  {
    id: "contrast",
    name: "Contrast",
    swatch: "#ffffff",
    description: "Black on white, yellow highlights, heavy borders.",
    colors: { background: "#ffffff", foreground: "#000000", accent: "#eab308" },
  },
  {
    id: "news",
    name: "News",
    swatch: "#f4f1e8",
    description: "Newsprint cream with crimson links.",
    colors: { background: "#f4f1e8", foreground: "#1a1a1a", accent: "#9f1239" },
  },
  {
    id: "midnight",
    name: "Midnight",
    swatch: "#0b1220",
    description: "Deep navy background, silver text, bright blue accents.",
    colors: { background: "#0b1220", foreground: "#e2e8f0", accent: "#38bdf8" },
  },
  {
    id: "ember",
    name: "Ember",
    swatch: "#1a110c",
    description: "Warm near-black page, cream text, amber accents.",
    colors: { background: "#1a110c", foreground: "#f5e6d3", accent: "#f59e0b" },
  },
  {
    id: "signal",
    name: "Signal",
    swatch: "#ffffff",
    description: "White page, black type, magenta links, cyan and yellow highlights.",
    colors: { background: "#ffffff", foreground: "#111111", accent: "#d946ef" },
  },
  {
    id: "citrus",
    name: "Citrus",
    swatch: "#fffbeb",
    description: "Bright cream page, black type, orange links, lime and blue.",
    colors: { background: "#fffbeb", foreground: "#171717", accent: "#ea580c" },
  },
];

export {
  DARK_THEME_IDS,
  LIGHT_THEME_IDS,
  isDarkThemeId,
  isLightThemeId,
  type DarkThemeId,
  type LightThemeId,
} from "../../convex/lib/themes";

export const LIGHT_THEMES = THEMES.filter((theme) => isLightThemeId(theme.id));
export const DARK_THEMES = THEMES.filter((theme) => isDarkThemeId(theme.id));

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value);
}
