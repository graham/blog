export function formatDate(ts: number | null | undefined): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function toDateTimeLocal(ts: number): string {
  const date = new Date(ts);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function postTime(post: {
  publishedAt: number | null;
  updatedAt?: number;
  _creationTime?: number;
}): number {
  return post.publishedAt ?? post.updatedAt ?? post._creationTime ?? 0;
}

export function formatTimeDelta(newer: number, older: number): string {
  const ms = Math.abs(newer - older);
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) {
    const n = Math.max(1, minutes);
    return n === 1 ? "1 minute" : `${n} minutes`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const days = Math.round(hours / 24);
  if (days < 14) {
    return days === 1 ? "1 day" : `${days} days`;
  }
  const weeks = Math.round(days / 7);
  if (weeks < 8) {
    return weeks === 1 ? "1 week" : `${weeks} weeks`;
  }
  const months = Math.round(days / 30.44);
  if (months < 24) {
    return months === 1 ? "1 month" : `${months} months`;
  }
  const years = Math.round(days / 365.25);
  return years === 1 ? "1 year" : `${years} years`;
}

export function isAdminUser(
  user:
    | { isAdmin?: boolean; userType?: string; disabled?: boolean }
    | null
    | undefined,
): boolean {
  if (user?.disabled === true) return false;
  return user?.isAdmin === true || user?.userType === "admin";
}
