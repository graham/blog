import type { ThemeId } from "@/lib/themes";

export type ColorMode = "light" | "dark";

// Kept in sync with the inline script in index.html, which applies the stored
// mode before React loads so the page does not flash the wrong colors.
export const COLOR_MODE_STORAGE_KEY = "blog-color-mode";

const DARK_THEMES: ReadonlySet<ThemeId> = new Set(["ink", "midnight", "ember"]);

export function themeMode(theme: ThemeId): ColorMode {
  return DARK_THEMES.has(theme) ? "dark" : "light";
}

export function readStoredColorMode(): ColorMode | null {
  try {
    const value = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function storeColorMode(mode: ColorMode) {
  try {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be blocked; the toggle still works for this page view.
  }
}

export function systemColorMode(): ColorMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// The site palette wins when it already matches the viewer's mode. Otherwise
// fall back to the default palette for that mode: Paper for light, Ink for dark.
export function resolveTheme(mode: ColorMode, sitePalette: ThemeId | null): ThemeId {
  if (sitePalette && themeMode(sitePalette) === mode) return sitePalette;
  return mode === "dark" ? "ink" : "paper";
}
