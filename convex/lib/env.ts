export function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return parseList(process.env.ADMIN_USERS).includes(email);
}
