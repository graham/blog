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

export function envGoogleAuthAvailable(): boolean {
  return (
    process.env.AUTH_GOOGLE_ENABLED === "true" ||
    (process.env.AUTH_GOOGLE_ENABLED !== "false" &&
      Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET))
  );
}

export function envPasswordAuthAvailable(): boolean {
  return process.env.AUTH_PASSWORD_ENABLED !== "false";
}

export function envPushoverAvailable(): boolean {
  return Boolean(process.env.PUSHOVER_TOKEN && process.env.PUSHOVER_USER);
}
