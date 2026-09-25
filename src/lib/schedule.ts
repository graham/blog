const MINUTE = 60_000;

export type SchedulePlanItem<T> = { item: T; publishAt: number; gapMinutes: number | null };

// Spaces items out from `start`, each one a random gap of between minGap and
// maxGap minutes after the previous, rounded to the second.
export function planSchedule<T>(
  items: T[],
  start: number,
  minGapMinutes: number,
  maxGapMinutes: number,
  random: () => number = Math.random,
): Array<SchedulePlanItem<T>> {
  const plan: Array<SchedulePlanItem<T>> = [];
  let at = start;
  items.forEach((item, index) => {
    let gapMinutes: number | null = null;
    if (index > 0) {
      const gap = (minGapMinutes + random() * (maxGapMinutes - minGapMinutes)) * MINUTE;
      at = Math.round((at + gap) / 1000) * 1000;
      gapMinutes = (at - plan[index - 1].publishAt) / MINUTE;
    }
    plan.push({ item, publishAt: at, gapMinutes });
  });
  return plan;
}

export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
