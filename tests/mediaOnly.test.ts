import { describe, expect, test } from "vitest";
import { mediaOnlyMarkdown } from "../src/lib/mediaOnly";

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
