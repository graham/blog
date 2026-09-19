import { describe, expect, test } from "vitest";
import {
  assetSnippet,
  markdownHasStorageId,
  markdownOverlayImages,
  postOverlayImages,
} from "../src/lib/images";

describe("overlay image lists", () => {
  test("collects convex and http markdown images", () => {
    const assets = [
      {
        storageId: "stor1",
        url: "https://files.example/a.png",
        filename: "a.png",
        alt: "Asset alt",
      },
    ];
    expect(
      markdownOverlayImages(
        "Hello ![one](convex://stor1) and ![two](https://cdn.example/b.jpg)",
        assets,
      ),
    ).toEqual([
      { src: "https://files.example/a.png", alt: "Asset alt" },
      { src: "https://cdn.example/b.jpg", alt: "two" },
    ]);
  });

  test("skips unresolved convex images", () => {
    expect(markdownOverlayImages("![missing](convex://nope)", [])).toEqual([]);
  });

  test("detects a convex image already in the body", () => {
    expect(markdownHasStorageId("hello ![x](convex://stor1)", "stor1")).toBe(true);
    expect(markdownHasStorageId("hello ![x](convex://stor1)", "stor2")).toBe(false);
  });

  test("uses a download link for an archive and excludes it from the gallery", () => {
    expect(assetSnippet("bundle.zip", "zip1", "application/zip")).toBe(
      "[Download bundle.zip](convex://zip1)",
    );
    expect(
      markdownOverlayImages("![bundle](convex://zip1)", [
        {
          storageId: "zip1",
          url: "https://files.example/bundle.zip",
          filename: "bundle.zip",
          contentType: "application/zip",
        },
      ]),
    ).toEqual([]);
  });

  test("puts cover first and drops the duplicate body copy", () => {
    const cover = { src: "https://files.example/a.png", alt: "Cover" };
    const body = [
      { src: "https://files.example/a.png", alt: "Asset alt" },
      { src: "https://cdn.example/b.jpg", alt: "two" },
    ];
    expect(postOverlayImages(cover, body)).toEqual([
      cover,
      { src: "https://cdn.example/b.jpg", alt: "two" },
    ]);
  });
});
