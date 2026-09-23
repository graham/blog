import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_FEATURES, featureOn, type FeatureMode, type Features } from "@/lib/features";
import { memberViewer } from "@/lib/format";

const FeaturesContext = createContext<Features>(DEFAULT_FEATURES);

export function useFeatures(): Features {
  return useContext(FeaturesContext);
}

export function useFeatureOn(mode: FeatureMode): boolean {
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);
  return featureOn(mode, memberViewer(currentUser));
}

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const features = useQuery(api.features.publicQueries.get) ?? DEFAULT_FEATURES;

  useEffect(() => {
    const root = document.documentElement;
    if (features.theme.enabled) {
      root.dataset.theme = features.theme.id;
    } else {
      delete root.dataset.theme;
    }
  }, [features.theme.enabled, features.theme.id]);

  return (
    <FeaturesContext.Provider value={features}>{children}</FeaturesContext.Provider>
  );
}
