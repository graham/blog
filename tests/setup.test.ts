import { describe, expect, it } from "vitest";
import { deriveSiteUrl, mergeEmailList, parseEnvFile } from "../scripts/setup.mjs";

describe("setup helpers", () => {
  it("reads Convex's commented .env.local format", () => {
    expect(
      parseEnvFile(
        "CONVEX_DEPLOYMENT=dev:happy-bird-123 # team: example, project: blog\n" +
          "VITE_CONVEX_URL=https://happy-bird-123.convex.cloud\n",
      ),
    ).toEqual({
      CONVEX_DEPLOYMENT: "dev:happy-bird-123",
      VITE_CONVEX_URL: "https://happy-bird-123.convex.cloud",
    });
  });

  it("derives the hosted site URL from the cloud URL", () => {
    expect(
      deriveSiteUrl({
        VITE_CONVEX_URL: "https://happy-bird-123.convex.cloud",
      }),
    ).toBe("https://happy-bird-123.convex.site");
  });

  it("prefers an explicit site URL", () => {
    expect(
      deriveSiteUrl({
        VITE_CONVEX_URL: "https://happy-bird-123.convex.cloud",
        VITE_CONVEX_SITE_URL: "https://blog.example.com/",
      }),
    ).toBe("https://blog.example.com");
  });

  it("merges administrator allowlists without duplicates", () => {
    expect(mergeEmailList("first@example.com,OWNER@EXAMPLE.COM", "owner@example.com")).toBe(
      "first@example.com,owner@example.com",
    );
  });
});
