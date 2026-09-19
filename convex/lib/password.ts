// PBKDF2 hashing shared by the Convex Auth password provider and the invite
// acceptance flow, so both write secrets in the same `salthex:hashhex` format.
const ITERATIONS = 100000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function pbkdf2Hash(
  password: string,
  saltHex?: string,
): Promise<string> {
  const salt = saltHex
    ? new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return `${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const [saltHex] = hash.split(":");
  const derived = await pbkdf2Hash(password, saltHex);
  if (derived.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i += 1) {
    diff |= derived.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}

export const MIN_PASSWORD_LENGTH = 8;

export function assertUsablePassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
  if (password.length > 256) {
    throw new Error("Password is too long");
  }
}
