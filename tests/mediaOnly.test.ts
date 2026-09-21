import { describe, expect, test } from "vitest";
import { hasPublicMedia, mediaOnlyMarkdown, NO_PUBLIC_TEXT_MESSAGE } from "../src/lib/mediaOnly";

describe("mediaOnlyMarkdown", () => {
  test("keeps images and videos and drops surrounding text", () => {
    expect(
      mediaOnlyMarkdown(
        [
          "A secret paragraph.",
          "",
          "![leaky alt](https://cdn.example/pic.jpg)",
          "",
          "More words.",
          "",
          "https://youtu.be/abcdefghijk",
          "",
          "[Download notes](convex://file1)",
        ].join("\n"),
      ),
    ).toBe("![](https://cdn.example/pic.jpg)\n\n[video](https://youtu.be/abcdefghijk)");
  });

  test("keeps convex image and video embeds", () => {
    expect(mediaOnlyMarkdown("Intro ![shot](convex://img1) and ![clip](convex://vid1)")).toBe(
      "![](convex://img1)\n\n![](convex://vid1)",
    );
  });

  test("returns empty when there is no media", () => {
    expect(mediaOnlyMarkdown("Just an essay about widgets.")).toBe("");
  });
});

describe("hasPublicMedia", () => {
  test("is false for a text-only post", () => {
    expect(hasPublicMedia("Just an essay about widgets.")).toBe(false);
  });

  test("is true when the body has an image or video", () => {
    expect(hasPublicMedia("Hello ![shot](https://cdn.example/a.jpg)")).toBe(true);
    expect(hasPublicMedia("Watch https://youtu.be/abcdefghijk")).toBe(true);
  });
});

describe("NO_PUBLIC_TEXT_MESSAGE", () => {
  test("is spelled correctly", () => {
    expect(NO_PUBLIC_TEXT_MESSAGE).toBe("This post has no publicly visible text.");
  });
});
