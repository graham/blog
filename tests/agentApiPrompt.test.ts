import { describe, expect, test } from "vitest";
import { agentApiPrompt, convexSiteUrl } from "../src/lib/agentApiPrompt";

describe("agent API prompt", () => {
  test("derives the HTTP action origin from the active Convex deployment", () => {
    expect(convexSiteUrl("https://happy-bird-123.convex.cloud")).toBe(
      "https://happy-bird-123.convex.site",
    );
    expect(convexSiteUrl("https://calm-fox-456.convex.cloud")).toBe(
      "https://calm-fox-456.convex.site",
    );
  });

  test("Windows curl uses PowerShell variables and curl.exe", () => {
    const prompt = agentApiPrompt({
      name: "writer",
      token: "blg_secret",
      baseUrl: "https://example.convex.site",
      platform: "windows",
      client: "curl",
    });
    expect(prompt).toContain('$env:BLOG_API_KEY = "blg_secret"');
    expect(prompt).toContain("curl.exe");
    expect(prompt).toContain("/assets?filename=");
    expect(prompt).toContain('"published":true');
    expect(prompt).toContain("video/x-msvideo");
    expect(prompt).toContain("Never add autoplay");
    expect(prompt).toContain("requires the reader to press Play");
    expect(prompt).toContain("/assets/upload-url");
    expect(prompt).toContain("application/zip");
  });

  test("Linux Node prompt includes complete client workflow", () => {
    const prompt = agentApiPrompt({
      name: "writer",
      token: "blg_secret",
      baseUrl: "https://example.convex.site",
      platform: "linux",
      client: "node",
    });
    expect(prompt).toContain("node ./blog-agent.mjs /path/to/photo.jpg");
    expect(prompt).toContain("await api");
    expect(prompt).toContain("uploaded.asset.markdown");
    expect(prompt).toContain('".mov": "video/quicktime"');
    expect(prompt).toContain('".zip": "application/zip"');
    expect(prompt).toContain("createReadStream(mediaPath)");
    expect(prompt).toContain("Use asset.markdown");
    expect(prompt).toContain("export BLOG_API_KEY='blg_secret'");
  });
});
