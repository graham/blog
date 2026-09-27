import { describe, expect, test } from "vitest";
import { buildPostHead, escapeHtml, injectPostHead } from "./previewHtml";

describe("buildPostHead", () => {
  test("includes og:image and a large-image twitter card when a cover image exists", () => {
    const head = buildPostHead({
      title: "Gliders",
      description: "Notes on soaring.",
      image: "https://example.convex.cloud/api/storage/abc",
      url: "https://blog.example.com/posts/gliders",
    });
    expect(head).toContain("<title>Gliders</title>");
    expect(head).toContain('<meta property="og:title" content="Gliders" />');
    expect(head).toContain('<meta property="og:description" content="Notes on soaring." />');
    expect(head).toContain(
      '<meta property="og:image" content="https://example.convex.cloud/api/storage/abc" />',
    );
    expect(head).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(head).toContain('<meta property="og:url" content="https://blog.example.com/posts/gliders" />');
  });

  test("omits every image tag and falls back to a plain twitter card without one", () => {
    const head = buildPostHead({
      title: "No cover",
      description: "",
      image: null,
      url: "https://blog.example.com/posts/no-cover",
    });
    expect(head).not.toContain("og:image");
    expect(head).not.toContain("twitter:image");
    expect(head).toContain('<meta name="twitter:card" content="summary" />');
  });

  test("escapes title and description so post content cannot break out of an attribute", () => {
    const head = buildPostHead({
      title: `A "quoted" <title>`,
      description: "Uses & and <script>",
      image: null,
      url: "https://blog.example.com/posts/x",
    });
    expect(head).toContain("A &quot;quoted&quot; &lt;title&gt;");
    expect(head).toContain("Uses &amp; and &lt;script&gt;");
    expect(head).not.toContain("<script>");
  });
});

describe("escapeHtml", () => {
  test("escapes the five reserved characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});

describe("injectPostHead", () => {
  const shell = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Blog</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/main-abc123.js"></script>
  </body>
</html>`;

  test("replaces the placeholder title and inserts the post's tags before </head>", () => {
    const result = injectPostHead(shell, '<meta property="og:title" content="Gliders" />');
    expect(result).not.toContain("<title>Blog</title>");
    expect(result).toContain('<meta property="og:title" content="Gliders" />\n  </head>');
    // The rest of the shell, including the real build's script tag, is untouched.
    expect(result).toContain('<script type="module" src="/assets/main-abc123.js"></script>');
    expect(result).toContain('<link rel="preconnect" href="https://fonts.googleapis.com" />');
  });

  test("only removes the title tag, not other tags that happen to contain the word", () => {
    const result = injectPostHead(shell, "<meta name=\"x\" />");
    expect((result.match(/<title>/g) ?? []).length).toBe(0);
  });
});
