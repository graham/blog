import { env } from "../_generated/server";
export { sha256Hex } from "../lib/sha256";

export function randomApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const value = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `blg_${value}`;
}

export function tokenPrefix(token: string): string {
  return token.slice(0, 12);
}

function encryptionKeyBytes(): Uint8Array<ArrayBuffer> {
  const encoded = env.API_KEY_ENCRYPTION_KEY;
  if (!encoded) {
    throw new Error("API_KEY_ENCRYPTION_KEY is not configured. Run npm run setup.");
  }
  let binary: string;
  try {
    binary = atob(encoded);
  } catch {
    throw new Error("API_KEY_ENCRYPTION_KEY must be base64 encoded");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.length !== 32) {
    throw new Error("API_KEY_ENCRYPTION_KEY must contain exactly 32 bytes");
  }
  return bytes;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  return await crypto.subtle.importKey("raw", encryptionKeyBytes(), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptApiKey(token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(token),
  );
  return `${base64(iv)}.${base64(new Uint8Array(encrypted))}`;
}

export async function decryptApiKey(value: string): Promise<string> {
  const [ivValue, encryptedValue, extra] = value.split(".");
  if (!ivValue || !encryptedValue || extra !== undefined) {
    throw new Error("Stored API key is invalid");
  }
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(ivValue) },
      await encryptionKey(),
      fromBase64(encryptedValue),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error("Could not decrypt this API key. Rotate it to save a new readable prompt.");
  }
}
