import { v } from "convex/values";

export const featureModeValidator = v.union(
  v.literal("off"),
  v.literal("on"),
  v.literal("members"),
  v.literal("adminOnly"),
);

export type FeatureMode = "off" | "on" | "members" | "adminOnly";

export type FeatureViewer = { isMember: boolean; isAdmin: boolean };

export function viewerFromUserType(userType: string | undefined): FeatureViewer {
  return {
    isMember: userType === "user" || userType === "admin",
    isAdmin: userType === "admin",
  };
}

export const storedFeatureModeValidator = v.union(
  v.boolean(),
  featureModeValidator,
);

export function parseFeatureMode(value: unknown): FeatureMode {
  if (
    value === "on" ||
    value === "adminOnly" ||
    value === "off" ||
    value === "members"
  ) {
    return value;
  }
  if (value === true) return "on";
  return "off";
}

export function coerceFeatureMode(
  value: boolean | FeatureMode | undefined,
  fallback: FeatureMode,
): FeatureMode {
  if (value === undefined) return fallback;
  if (value === true) return "on";
  if (value === false) return "off";
  return value;
}

export function featureVisible(mode: FeatureMode, viewer: FeatureViewer): boolean {
  switch (mode) {
    case "off":
      return false;
    case "on":
      return true;
    case "members":
      return viewer.isMember;
    case "adminOnly":
      return viewer.isAdmin;
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
