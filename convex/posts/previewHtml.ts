// Builds the Open Graph / Twitter Card meta tags a post's permalink needs so
// a phone's text-message (or Slack/Discord/etc.) link preview shows the
// post's title, excerpt, and cover image, and splices them into the site's
// built index.html. Text crawlers fetch the URL and read this static HTML
// without running JavaScript, so the tags have to be server-rendered here;
// a real visitor's browser still boots the same SPA from the same markup.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type PostPreview = {
  title: string;
  description: string;
  image: string | null;
  url: string;
};

// One <meta>/<title> block for a post's permalink. Image is omitted from the
// markup entirely when the post has no cover image, rather than pointing at
// a placeholder — a preview with no image is preferable to a broken one.
export function buildPostHead(post: PostPreview): string {
  const title = escapeHtml(post.title);
  const description = escapeHtml(post.description);
  const url = escapeHtml(post.url);
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    post.image ? `<meta property="og:image" content="${escapeHtml(post.image)}" />` : null,
    `<meta name="twitter:card" content="${post.image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    post.image ? `<meta name="twitter:image" content="${escapeHtml(post.image)}" />` : null,
  ];
  return tags.filter((tag): tag is string => tag !== null).join("\n    ");
}

// Drops the shell's generic placeholder <title>, then inserts the post's own
// tags just before </head> so the rest of the shell (fonts, the color-mode
// script, the app's mount point and script tag) is untouched.
export function injectPostHead(shell: string, head: string): string {
  const withoutPlaceholderTitle = shell.replace(/<title>[^<]*<\/title>\s*/, "");
  return withoutPlaceholderTitle.replace("</head>", `${head}\n  </head>`);
}
