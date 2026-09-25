import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_FEATURES, featureOn, type FeatureMode, type Features } from "@/lib/features";
import { isAdminUser } from "@/lib/format";
import {
  readStoredColorMode,
  resolveTheme,
  storeColorMode,
  systemColorMode,
  type ColorMode,
} from "@/lib/colorMode";

const FeaturesContext = createContext<Features>(DEFAULT_FEATURES);

const ColorModeContext = createContext<{ mode: ColorMode; toggle: () => void }>({
  mode: "light",
  toggle: () => {},
});

export function useFeatures(): Features {
  return useContext(FeaturesContext);
}

export function useColorMode() {
  return useContext(ColorModeContext);
}

export function useFeatureOn(mode: FeatureMode): boolean {
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);
  return featureOn(mode, isAdminUser(currentUser));
}

// Follows the system setting until the visitor picks a mode with the toggle;
// the pick is stored in localStorage.
function useVisitorColorMode() {
  const [stored, setStored] = useState<ColorMode | null>(() => readStoredColorMode());
  const [system, setSystem] = useState<ColorMode>(() => systemColorMode());

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystem(query.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const mode = stored ?? system;
  function toggle() {
    const next = mode === "dark" ? "light" : "dark";
    storeColorMode(next);
    setStored(next);
  }
  return { mode, toggle };
}

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const features = useQuery(api.features.publicQueries.get) ?? DEFAULT_FEATURES;
  const colorMode = useVisitorColorMode();

  useEffect(() => {
    const root = document.documentElement;
    const theme = resolveTheme(colorMode.mode, features.theme.enabled ? features.theme : null);
    if (theme === "paper") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = theme;
    }
    root.style.colorScheme = colorMode.mode;
  }, [features.theme, colorMode.mode]);

  return (
    <FeaturesContext.Provider value={features}>
      <ColorModeContext.Provider value={colorMode}>{children}</ColorModeContext.Provider>
    </FeaturesContext.Provider>
  );
}
