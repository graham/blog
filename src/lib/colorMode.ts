import type { ThemeId } from "@/lib/themes";

export type ColorMode = "light" | "dark";

// Kept in sync with the inline script in index.html, which applies the stored
// mode before React loads so the page does not flash the wrong colors.
export const COLOR_MODE_STORAGE_KEY = "blog-color-mode";

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

// With the site palette on, each mode uses the admin's pick for that mode;
// otherwise Paper for light and Ink for dark.
export function resolveTheme(
  mode: ColorMode,
  palette: { lightId: ThemeId; darkId: ThemeId } | null,
): ThemeId {
  if (mode === "dark") return palette?.darkId ?? "ink";
  return palette?.lightId ?? "paper";
}
