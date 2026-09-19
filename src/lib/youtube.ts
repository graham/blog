const YOUTUBE_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

export function parseYouTubeId(value: string): string | null {
  const match = value.match(YOUTUBE_RE);
  return match?.[1] ?? null;
}

export function linkifyYouTube(markdown: string): string {
  return markdown.replace(
    /^(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[A-Za-z0-9_-]{11}\S*)\s*$/gm,
    "[video]($1)",
  );
}
