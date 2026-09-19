const CONTENT_TYPES: Record<string, string> = {
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

export function assetContentType(filename: string, reportedType: string): string {
  const extension = filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  return CONTENT_TYPES[extension] ?? reportedType.toLowerCase();
}

export function isVideoAsset(contentType: string): boolean {
  return contentType.startsWith("video/");
}

export function isImageAsset(contentType: string): boolean {
  return contentType.startsWith("image/");
}

export function isArchiveAsset(contentType: string): boolean {
  return contentType === "application/zip" || contentType === "application/x-zip-compressed";
}
