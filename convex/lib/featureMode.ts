import { v } from "convex/values";

export const featureModeValidator = v.union(
  v.literal("off"),
  v.literal("on"),
  v.literal("adminOnly"),
);

export type FeatureMode = "off" | "on" | "adminOnly";

export const storedFeatureModeValidator = v.union(
  v.boolean(),
  featureModeValidator,
);

export function parseFeatureMode(value: unknown): FeatureMode {
  if (value === "on" || value === "adminOnly" || value === "off") {
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

export function featureVisible(mode: FeatureMode, asAdmin: boolean): boolean {
  return mode === "on" || (mode === "adminOnly" && asAdmin);
}
