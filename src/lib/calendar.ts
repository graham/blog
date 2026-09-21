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

export function calendarMonth(
  year: number,
  month: number,
  posts: Array<{ publishedAt: number }>,
): { weeks: CalendarWeek[]; monthTotal: number } {
  const counts = new Map<string, number>();
  for (const post of posts) {
    const key = dayKey(post.publishedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

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
    monthTotal: posts.length,
  };
}
