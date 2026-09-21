import { describe, expect, test } from "vitest";
import { calendarMonth, dayKey } from "../src/lib/calendar";

function at(year: number, month: number, day: number, hour = 12) {
  return new Date(year, month, day, hour).getTime();
}

describe("calendarMonth", () => {
  test("pads the first week from Sunday and sums posts per week and month", () => {
    // 1 Jan 2026 is a Thursday.
    const posts = [
      { publishedAt: at(2026, 0, 1) },
      { publishedAt: at(2026, 0, 1, 18) },
      { publishedAt: at(2026, 0, 3) },
      { publishedAt: at(2026, 0, 15) },
      { publishedAt: at(2026, 0, 15, 9) },
      { publishedAt: at(2026, 0, 15, 21) },
      { publishedAt: at(2026, 0, 15, 22) },
    ];

    const month = calendarMonth(2026, 0, posts);

    expect(month.monthTotal).toBe(7);
    expect(month.weeks).toHaveLength(5);

    const first = month.weeks[0];
    expect(first.days.map((cell) => cell.day)).toEqual([null, null, null, null, 1, 2, 3]);
    expect(first.days[4]?.count).toBe(2);
    expect(first.days[6]?.count).toBe(1);
    expect(first.total).toBe(3);

    const third = month.weeks[2];
    expect(third.days.map((cell) => cell.day)).toEqual([11, 12, 13, 14, 15, 16, 17]);
    expect(third.days[4]?.count).toBe(4);
    expect(third.total).toBe(4);
  });

  test("pads the last week so the week total sits in the eighth column", () => {
    // 1 Mar 2026 is a Sunday; 31 Mar is a Tuesday.
    const posts = [{ publishedAt: at(2026, 2, 29) }, { publishedAt: at(2026, 2, 31) }];

    const month = calendarMonth(2026, 2, posts);
    const last = month.weeks[month.weeks.length - 1];

    expect(last.days.map((cell) => cell.day)).toEqual([29, 30, 31, null, null, null, null]);
    expect(last.total).toBe(2);
    expect(month.monthTotal).toBe(2);
  });

  test("counts an empty month as zero", () => {
    const month = calendarMonth(2026, 1, []);
    expect(month.monthTotal).toBe(0);
    expect(month.weeks.every((week) => week.total === 0)).toBe(true);
  });
});

describe("dayKey", () => {
  test("keys a timestamp in local year-month-day", () => {
    expect(dayKey(at(2026, 0, 15, 0))).toBe("2026-0-15");
    expect(dayKey(at(2026, 0, 15, 23))).toBe("2026-0-15");
  });
});
