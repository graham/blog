import { useConvexAuth } from "convex/react";
import { useFeatures } from "@/components/FeaturesProvider";

export function useImagesOnly(): boolean {
  const features = useFeatures();
  const { isAuthenticated, isLoading } = useConvexAuth();
  return features.imagesOnly && (isLoading || !isAuthenticated);
}
