export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function normalizeContentHash(value: string): string {
  const trimmed = value.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const bytes = decodeBase64(trimmed);
  if (bytes && bytes.length === 32) {
    return toHex(bytes);
  }
  throw new Error("Invalid file hash");
}

export function tryContentHash(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return normalizeContentHash(value);
  } catch {
    return null;
  }
}
