export function formatDate(ts: number | null | undefined): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
