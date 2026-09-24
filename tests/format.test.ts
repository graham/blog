import { describe, expect, test } from "vitest";
import { formatTimeDelta, postTime } from "../src/lib/format";

describe("formatTimeDelta", () => {
  test("names the gap between two timestamps", () => {
    const start = Date.parse("2026-01-01T00:00:00.000Z");
    expect(formatTimeDelta(start + 3 * 60_000, start)).toBe("3 minutes");
    expect(formatTimeDelta(start + 2 * 60 * 60_000, start)).toBe("2 hours");
    expect(formatTimeDelta(start + 3 * 24 * 60 * 60_000, start)).toBe("3 days");
    expect(formatTimeDelta(start + 21 * 24 * 60 * 60_000, start)).toBe("3 weeks");
  });
});

describe("postTime", () => {
  test("prefers editable createdAt over _creationTime", () => {
    expect(
      postTime({
        createdAt: 50,
        publishedAt: 20,
        updatedAt: 30,
        _creationTime: 10,
      }),
    ).toBe(50);
    expect(postTime({ publishedAt: 20, _creationTime: 10 })).toBe(10);
  });
});
