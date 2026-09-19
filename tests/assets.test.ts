import { describe, expect, test } from "vitest";
import {
  assetContentType,
  isImageAsset,
  isVideoAsset,
} from "../src/lib/assets";

describe("media assets", () => {
  test("normalizes movie extensions even when Windows reports a generic type", () => {
    expect(assetContentType("clip.AVI", "application/octet-stream")).toBe(
      "video/x-msvideo",
    );
    expect(assetContentType("clip.mov", "video/quicktime")).toBe(
      "video/quicktime",
    );
  });

  test("separates images from videos", () => {
    expect(isImageAsset("image/jpeg")).toBe(true);
    expect(isImageAsset("video/mp4")).toBe(false);
    expect(isVideoAsset("video/x-msvideo")).toBe(true);
  });
});
