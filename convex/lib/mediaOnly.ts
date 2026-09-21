const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*\)/g;

const YOUTUBE_URL_RE =
  /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[A-Za-z0-9_-]{11}\S*/g;

export function mediaOnlyMarkdown(content: string): string {
  const parts: string[] = [];
  const seen = new Set<string>();

  for (const match of content.matchAll(new RegExp(MARKDOWN_IMAGE_RE.source, "g"))) {
    const src = (match[2] ?? "").trim();
    if (!src) continue;
    const key = `img:${src}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(`![](${src})`);
  }

  for (const match of content.matchAll(new RegExp(YOUTUBE_URL_RE.source, "g"))) {
    const url = match[0].replace(/[).,]+$/, "");
    const key = `yt:${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(`[video](${url})`);
  }

  return parts.join("\n\n");
}

export const NO_PUBLIC_TEXT_MESSAGE = "This post has no publicly visible text.";

export function hasPublicMedia(body: string): boolean {
  return mediaOnlyMarkdown(body).length > 0;
}
