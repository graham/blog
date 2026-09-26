import { describe, expect, test } from "vitest";
import { planSchedule } from "../src/lib/schedule";

describe("planSchedule", () => {
  test("starts at the start time and keeps every gap inside the range", () => {
    const start = Date.parse("2026-10-01T09:00:00Z");
    const plan = planSchedule(["a", "b", "c", "d", "e", "f"], start, 15, 20);
    expect(plan.map((entry) => entry.item)).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(plan[0]).toMatchObject({ publishAt: start, gapMinutes: null });
    for (const entry of plan.slice(1)) {
      expect(entry.gapMinutes).toBeGreaterThanOrEqual(15 - 1 / 60);
      expect(entry.gapMinutes).toBeLessThanOrEqual(20 + 1 / 60);
    }
  });

  test("uses the random source to pick each gap", () => {
    const start = 0;
    expect(planSchedule(["a", "b", "c"], start, 30, 60, () => 0).map((e) => e.publishAt)).toEqual([
      0,
      30 * 60_000,
      60 * 60_000,
    ]);
    expect(planSchedule(["a", "b"], start, 30, 60, () => 1)[1].publishAt).toBe(60 * 60_000);
  });

  test("jitterFirst puts a gap before the first item too", () => {
    const anchor = Date.parse("2026-10-02T02:00:00Z");
    const plan = planSchedule(["a", "b"], anchor, 15, 20, () => 0, true);
    expect(plan.map((entry) => entry.publishAt)).toEqual([
      anchor + 15 * 60_000,
      anchor + 30 * 60_000,
    ]);
    expect(plan[0].gapMinutes).toBe(15);
  });
});
