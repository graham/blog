export const IMAGE_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
] as const;

export const VIDEO_CONTENT_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-m4v",
] as const;

export const ARCHIVE_CONTENT_TYPES = ["application/zip", "application/x-zip-compressed"] as const;

export const MAX_ASSET_BYTES = 250 * 1024 * 1024;

export const ALLOWED_ASSET_TYPES: readonly string[] = [
  ...IMAGE_CONTENT_TYPES,
  ...VIDEO_CONTENT_TYPES,
  ...ARCHIVE_CONTENT_TYPES,
];

export function isImageContentType(contentType: string): boolean {
  return IMAGE_CONTENT_TYPES.includes(contentType as (typeof IMAGE_CONTENT_TYPES)[number]);
}

export function isArchiveContentType(contentType: string): boolean {
  return ARCHIVE_CONTENT_TYPES.includes(contentType as (typeof ARCHIVE_CONTENT_TYPES)[number]);
}

export function contentTypeFromFilename(filename: string): string | null {
  const extension = filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  const types: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogv": "video/ogg",
    ".ogg": "video/ogg",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".m4v": "video/x-m4v",
    ".zip": "application/zip",
  };
  return types[extension] ?? null;
}
