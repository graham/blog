export { sha256Hex } from "../lib/sha256";

export function randomInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const value = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `inv_${value}`;
}

export function inviteTokenPrefix(token: string): string {
  return token.slice(0, 12);
}
