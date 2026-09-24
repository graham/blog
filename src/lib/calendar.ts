export function dayKey(ts: number) {
  const date = new Date(ts);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export type CalendarDay = {
  day: number | null;
  key: string | null;
  count: number;
};

export type CalendarWeek = {
  days: CalendarDay[];
  total: number;
};

export function monthDayRanges(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return {
      start: new Date(year, month, day).getTime(),
      end: new Date(year, month, day + 1).getTime(),
    };
  });
}

function countsFromPosts(posts: Array<{ publishedAt: number }>) {
  const counts = new Map<string, number>();
  for (const post of posts) {
    const key = dayKey(post.publishedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function calendarMonth(
  year: number,
  month: number,
  postsOrCounts: Array<{ publishedAt: number }> | Map<string, number>,
): { weeks: CalendarWeek[]; monthTotal: number } {
  const counts =
    postsOrCounts instanceof Map ? postsOrCounts : countsFromPosts(postsOrCounts);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarDay[] = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ day: null, key: null, count: 0 });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${month}-${day}`;
    cells.push({ day, key, count: counts.get(key) ?? 0 });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, key: null, count: 0 });
  }

  const weeks: CalendarWeek[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const days = cells.slice(i, i + 7);
    weeks.push({
      days,
      total: days.reduce((sum, cell) => sum + cell.count, 0),
    });
  }

  return {
    weeks,
    monthTotal: [...counts.values()].reduce((sum, count) => sum + count, 0),
  };
}
