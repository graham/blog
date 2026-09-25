import type { Id } from "../../convex/_generated/dataModel";

export function imageSnippet(alt: string, storageId: string): string {
  const safe = alt.replace(/[[\]]/g, "").trim() || "image";
  return `![${safe}](convex://${storageId})`;
}

export function assetSnippet(label: string, storageId: string, contentType: string): string {
  const safe = label.replace(/[[\]]/g, "").trim() || "file";
  return contentType.startsWith("image/") || contentType.startsWith("video/")
    ? `![${safe}](convex://${storageId})`
    : `[Download ${safe}](convex://${storageId})`;
}

export function markdownHasStorageId(content: string, storageId: string): boolean {
  return content.includes(`convex://${storageId}`);
}

export type OverlayImage = {
  src: string;
  alt: string;
  caption?: string;
  // Set when the image belongs to a published post, so opening it counts a view.
  postId?: Id<"posts">;
};

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*\)/g;

export function markdownOverlayImages(
  content: string,
  assets: Array<{
    storageId: string;
    url: string | null;
    filename: string;
    alt?: string;
    contentType?: string;
  }>,
): OverlayImage[] {
  const byStorageId = new Map(assets.map((asset) => [asset.storageId, asset]));
  const images: OverlayImage[] = [];
  const pattern = new RegExp(MARKDOWN_IMAGE_RE.source, "g");
  for (const match of content.matchAll(pattern)) {
    const alt = match[1] ?? "";
    const src = match[2] ?? "";
    const storageId = src.startsWith("convex://") ? src.slice("convex://".length) : null;
    const asset = storageId ? byStorageId.get(storageId) : undefined;
    if (asset?.contentType && !asset.contentType.startsWith("image/")) continue;
    const resolved = storageId ? (asset?.url ?? null) : src;
    if (!resolved) continue;
    const altText = (asset?.alt || alt || asset?.filename || "").trim();
    images.push({ src: resolved, alt: altText });
  }
  return images;
}

export function postOverlayImages(
  cover: OverlayImage | null,
  bodyImages: OverlayImage[],
): OverlayImage[] {
  if (cover === null) return bodyImages;
  return [cover, ...bodyImages.filter((image) => image.src !== cover.src)];
}
