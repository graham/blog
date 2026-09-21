import { describe, expect, test } from "vitest";
import { compareCell, nextSort, sortRowIndices } from "../src/lib/sortTable";

describe("compareCell", () => {
  test("sorts numbers numerically", () => {
    expect(compareCell("10", "2")).toBeGreaterThan(0);
    expect(compareCell("$1,200", "900")).toBeGreaterThan(0);
    expect(compareCell("3%", "12%")).toBeLessThan(0);
  });

  test("sorts text alphabetically", () => {
    expect(compareCell("beta", "Alpha")).toBeGreaterThan(0);
    expect(compareCell("apple", "apple")).toBe(0);
  });

  test("puts empty cells after filled ones", () => {
    expect(compareCell("", "a")).toBeGreaterThan(0);
    expect(compareCell("a", "")).toBeLessThan(0);
  });
});

describe("sortRowIndices", () => {
  const rows = [
    ["b", "10"],
    ["a", "2"],
    ["c", "2"],
  ];

  test("orders by a column ascending and descending", () => {
    expect(sortRowIndices(rows, 0, "asc")).toEqual([1, 0, 2]);
    expect(sortRowIndices(rows, 0, "desc")).toEqual([2, 0, 1]);
    expect(sortRowIndices(rows, 1, "asc")).toEqual([1, 2, 0]);
  });
});

describe("nextSort", () => {
  test("cycles none, ascending, descending, none", () => {
    expect(nextSort(null, 1)).toEqual({ col: 1, dir: "asc" });
    expect(nextSort({ col: 1, dir: "asc" }, 1)).toEqual({ col: 1, dir: "desc" });
    expect(nextSort({ col: 1, dir: "desc" }, 1)).toBeNull();
    expect(nextSort({ col: 0, dir: "asc" }, 1)).toEqual({ col: 1, dir: "asc" });
  });
});
