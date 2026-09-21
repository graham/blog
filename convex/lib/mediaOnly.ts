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

export function stripSummaryText<
  T extends {
    title: string;
    excerpt: string;
    tags: string[];
    authorName: string | null;
  },
>(post: T): T {
  return {
    ...post,
    title: "",
    excerpt: "",
    tags: [],
    authorName: null,
  };
}

export function stripDetailText<
  T extends {
    title: string;
    excerpt: string;
    tags: string[];
    authorName: string | null;
    body: string;
    assets: Array<{ alt: string; description: string }>;
  },
>(post: T): T {
  return {
    ...stripSummaryText(post),
    body: mediaOnlyMarkdown(post.body),
    assets: post.assets.map((asset) => ({ ...asset, alt: "", description: "" })),
  };
}
