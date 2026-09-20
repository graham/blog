export type AgentPlatform = "windows" | "linux";
export type AgentClient = "curl" | "node";

export function convexSiteUrl(cloudUrl: string): string {
  const url = new URL(cloudUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".convex.cloud")) {
    throw new Error("VITE_CONVEX_URL must be an https://*.convex.cloud URL");
  }
  url.hostname = `${url.hostname.slice(0, -".convex.cloud".length)}.convex.site`;
  return url.origin;
}

type PromptOptions = {
  name: string;
  token: string;
  baseUrl: string;
  platform: AgentPlatform;
  client: AgentClient;
};

function curlInstructions(options: PromptOptions): string {
  const windows = options.platform === "windows";
  const setup = windows
    ? `$env:BLOG_API_URL = "${options.baseUrl}"
$env:BLOG_API_KEY = "${options.token}"`
    : `export BLOG_API_URL='${options.baseUrl}'
export BLOG_API_KEY='${options.token}'`;
  const curl = windows ? "curl.exe" : "curl";
  const continuation = windows ? "`" : "\\";
  const variable = (name: string) => (windows ? `$env:${name}` : `$${name}`);
  const postId = variable("BLOG_POST_ID");
  const imagePath = windows ? "$env:IMAGE_PATH" : "$IMAGE_PATH";
  const moviePath = windows ? "$env:MOVIE_PATH" : "$MOVIE_PATH";
  const zipPath = windows ? "$env:ZIP_PATH" : "$ZIP_PATH";
  const zipInstructions = windows
    ? `# Upload a large ZIP (up to 250 MiB) directly to storage, then attach it.
$upload = ${curl} -sS -X POST "${variable("BLOG_API_URL")}/api/posts/${postId}/assets/upload-url" ${continuation}
  -H "Authorization: Bearer ${variable("BLOG_API_KEY")}" | ConvertFrom-Json
$stored = ${curl} -sS -X POST $upload.uploadUrl ${continuation}
  -H "Content-Type: application/zip" ${continuation}
  --data-binary "@${zipPath}" | ConvertFrom-Json
$attach = @{ storageId = $stored.storageId; filename = [IO.Path]::GetFileName(${zipPath}) } | ConvertTo-Json -Compress
${curl} -sS -X POST "${variable("BLOG_API_URL")}/api/posts/${postId}/assets/attach" ${continuation}
  -H "Authorization: Bearer ${variable("BLOG_API_KEY")}" ${continuation}
  -H "Content-Type: application/json" ${continuation}
  --data-raw $attach`
    : `# Upload a large ZIP (up to 250 MiB) directly to storage, then attach it.
# These commands use jq to read the two small JSON responses.
UPLOAD_URL=$(${curl} -sS -X POST "${variable("BLOG_API_URL")}/api/posts/${postId}/assets/upload-url" ${continuation}
  -H "Authorization: Bearer ${variable("BLOG_API_KEY")}" | jq -r .uploadUrl)
STORAGE_ID=$(${curl} -sS -X POST "$UPLOAD_URL" ${continuation}
  -H "Content-Type: application/zip" ${continuation}
  --data-binary "@${zipPath}" | jq -r .storageId)
${curl} -sS -X POST "${variable("BLOG_API_URL")}/api/posts/${postId}/assets/attach" ${continuation}
  -H "Authorization: Bearer ${variable("BLOG_API_KEY")}" ${continuation}
  -H "Content-Type: application/json" ${continuation}
  --data-raw "$(jq -nc --arg storageId "$STORAGE_ID" --arg filename "$(basename "${zipPath}")" '{storageId:$storageId,filename:$filename}')"`;
  return `${setup}

# List recent posts, including drafts:
${curl} -sS "${variable("BLOG_API_URL")}/api/posts?limit=20" ${continuation}
  -H "Authorization: Bearer ${variable("BLOG_API_KEY")}"

# Create a draft. Save the returned post.id for later calls:
${curl} -sS -X POST "${variable("BLOG_API_URL")}/api/posts" ${continuation}
  -H "Authorization: Bearer ${variable("BLOG_API_KEY")}" ${continuation}
  -H "Content-Type: application/json" ${continuation}
  --data-raw '{"title":"Working title","body":"Initial Markdown body","tags":["notes"],"visibility":"listed","published":false}'

${
  windows
    ? `$env:BLOG_POST_ID = "<post.id from the response>"
$env:IMAGE_PATH = "C:\\path\\to\\photo.jpg"
$env:MOVIE_PATH = "C:\\path\\to\\movie.avi"
$env:ZIP_PATH = "C:\\path\\to\\archive.zip"`
    : `export BLOG_POST_ID='<post.id from the response>'
export IMAGE_PATH='/path/to/photo.jpg'
export MOVIE_PATH='/path/to/movie.avi'
export ZIP_PATH='/path/to/archive.zip'`
}

# Read the current post before updating it:
${curl} -sS "${variable("BLOG_API_URL")}/api/posts/${postId}" ${continuation}
  -H "Authorization: Bearer ${variable("BLOG_API_KEY")}"

# Update any subset of fields. published:true publishes; false returns it to draft:
${curl} -sS -X PATCH "${variable("BLOG_API_URL")}/api/posts/${postId}" ${continuation}
  -H "Authorization: Bearer ${variable("BLOG_API_KEY")}" ${continuation}
  -H "Content-Type: application/json" ${continuation}
  --data-raw '{"body":"Revised Markdown body","excerpt":"Short summary","published":true}'

# Upload an image. Use the returned asset.markdown in the post body.
# Add &cover=true to also make it the cover image.
${curl} -sS -X POST "${variable("BLOG_API_URL")}/api/posts/${postId}/assets?filename=photo.jpg&alt=Descriptive%20alt%20text&cover=true" ${continuation}
  -H "Authorization: Bearer ${variable("BLOG_API_KEY")}" ${continuation}
  -H "Content-Type: image/jpeg" ${continuation}
  --data-binary "@${imagePath}"

# Upload a movie. Do not set cover=true for video. AVI/MOV are accepted, but
# MP4/WebM provide the most reliable playback across browsers. Insert the
# returned asset.markdown into the post body; do not write a raw video tag.
${curl} -sS -X POST "${variable("BLOG_API_URL")}/api/posts/${postId}/assets?filename=movie.avi&alt=Movie" ${continuation}
  -H "Authorization: Bearer ${variable("BLOG_API_KEY")}" ${continuation}
  -H "Content-Type: video/x-msvideo" ${continuation}
  --data-binary "@${moviePath}"

${zipInstructions}`;
}

function nodeInstructions(options: PromptOptions): string {
  const setup =
    options.platform === "windows"
      ? `$env:BLOG_API_URL = "${options.baseUrl}"
$env:BLOG_API_KEY = "${options.token}"
node .\\blog-agent.mjs C:\\path\\to\\photo.jpg`
      : `export BLOG_API_URL='${options.baseUrl}'
export BLOG_API_KEY='${options.token}'
node ./blog-agent.mjs /path/to/photo.jpg`;
  return `Create blog-agent.mjs (Node.js 18+):

\`\`\`js
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { basename, extname } from "node:path";

const base = process.env.BLOG_API_URL;
const key = process.env.BLOG_API_KEY;
if (!base || !key) throw new Error("Set BLOG_API_URL and BLOG_API_KEY");

async function api(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: { Authorization: \`Bearer \${key}\`, ...(options.headers ?? {}) },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(\`\${response.status}: \${JSON.stringify(result)}\`);
  return result;
}

const recent = await api("/api/posts?limit=20");
console.log("Recent posts:", recent.posts);

const created = await api("/api/posts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "Working title",
    body: "Initial Markdown body",
    tags: ["notes"],
    visibility: "listed",
    published: false,
  }),
});
const postId = created.post.id;

console.log("Current post:", (await api(\`/api/posts/\${postId}\`)).post);

const mediaPath = process.argv[2];
if (mediaPath) {
  const filename = basename(mediaPath);
  const contentTypes = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".mp4": "video/mp4", ".webm": "video/webm", ".ogv": "video/ogg",
    ".ogg": "video/ogg", ".mov": "video/quicktime",
    ".avi": "video/x-msvideo", ".m4v": "video/x-m4v",
    ".zip": "application/zip",
  };
  const contentType = contentTypes[extname(filename).toLowerCase()];
  if (!contentType) throw new Error("Unsupported image, video, or ZIP type");
  let uploaded;
  if (contentType === "application/zip") {
    const prepared = await api(\`/api/posts/\${postId}/assets/upload-url\`, {
      method: "POST",
    });
    const storageResponse = await fetch(prepared.uploadUrl, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: createReadStream(mediaPath),
      duplex: "half",
    });
    const stored = await storageResponse.json();
    if (!storageResponse.ok) throw new Error(JSON.stringify(stored));
    uploaded = await api(\`/api/posts/\${postId}/assets/attach\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storageId: stored.storageId, filename }),
    });
  } else {
    const bytes = await readFile(mediaPath);
    const cover = contentType.startsWith("image/") ? "&cover=true" : "";
    uploaded = await api(
      \`/api/posts/\${postId}/assets?filename=\${encodeURIComponent(filename)}&alt=Descriptive%20text\${cover}\`,
      { method: "POST", headers: { "Content-Type": contentType }, body: bytes },
    );
  }
  console.log("Insert this Markdown:", uploaded.asset.markdown);
}

await api(\`/api/posts/\${postId}\`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    body: "Final Markdown body (include uploaded.asset.markdown when applicable)",
    excerpt: "Short summary",
    published: true,
  }),
});
\`\`\`

Run it:

\`\`\`${options.platform === "windows" ? "powershell" : "bash"}
${setup}
\`\`\``;
}

export function agentApiPrompt(options: PromptOptions): string {
  const clientInstructions =
    options.client === "curl" ? curlInstructions(options) : nodeInstructions(options);
  return `You can create and maintain posts on this blog through its HTTP API.

API key name: ${options.name}
This key is a secret. Never print it in logs, commit it, or send it anywhere except ${options.baseUrl}. If it appears in a tool transcript, redact it in summaries.

Writing:
- Short. No filler, no preamble, no "in this post".
- Evidence first: tables of numbers, then a graph or screenshot if timing/latency improved. One caption under each: what it proves.
- Show images and videos. After each, one sentence on why it is relevant.
- Bullet list of what was done. Not a narrative recap.
- Link GitHub commits and pull requests with full https://github.com/... URLs.
- Informative, not wordy. Prefer numbers over adjectives.

Workflow:
1. List recent posts before creating one so you do not duplicate existing work.
2. Create a draft early so the blog owner can see the work in the admin Posts page.
3. Keep the returned post.id. GET the post before later edits, then PATCH only the fields you intend to change.
4. Upload images or videos through the /assets route. For a large ZIP, request an /assets/upload-url, upload directly to it, then call /assets/attach. Insert the returned asset.markdown where the media or download link belongs.
5. Keep published:false while working. Set published:true only when the result is ready. Further PATCH requests update the published post in place.

Video rules:
- Never use cover=true for a video; only images can be post covers.
- Never add autoplay or a raw HTML video element. Use asset.markdown. The blog player shows controls and requires the reader to press Play.
- Prefer MP4 (H.264/AAC) or WebM for reliable browser playback. MOV and AVI are accepted but may fall back to a download link when the browser cannot decode their codec.
- Single-request API uploads are limited to 19 MiB. Compress or convert larger videos before uploading. ZIP files use the direct-storage flow and may be up to 250 MiB.

Post JSON fields: title, slug (string or null), excerpt, body (Markdown), visibility (listed or unlisted), tags (up to 16 strings), published (boolean), coverImageId (an uploaded storageId or null). Create and update responses contain post.id, post.slug, and post.status. GET returns the complete post and its assets.

Single-request uploads accept PNG, JPEG, GIF, WebP, SVG, MP4, WebM, Ogg video, MOV, AVI, M4V, and ZIP up to 19 MiB. Set the matching Content-Type. Query parameters are filename (required), alt, description, and cover=true|false. ZIP files up to 250 MiB should use the short-lived direct upload URL; its final attach response includes downloadable Markdown.

${clientInstructions}`;
}
