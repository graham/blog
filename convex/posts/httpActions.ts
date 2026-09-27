import { httpAction, type ActionCtx } from "../_generated/server";
import { api, components } from "../_generated/api";
import { buildPostHead, injectPostHead } from "./previewHtml";

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Per-post tags, so don't let a shared cache serve one post's preview
      // under another's URL. Crawlers refetch rarely regardless.
      "Cache-Control": "no-store",
    },
  });
}

// The static-hosting component owns the built index.html; fetch its current
// content the same way its own compatibility-mode serving does; see
// registerStaticRoutes in @convex-dev/static-hosting.
async function fetchIndexHtml(ctx: ActionCtx): Promise<string> {
  const asset = await ctx.runQuery(components.staticHosting.lib.resolveAssetForHttp, {
    path: "/index.html",
  });
  if (!asset) throw new Error("index.html is not deployed");
  if (asset.storageUrl) {
    const response = await fetch(asset.storageUrl);
    if (!response.ok) throw new Error(`Could not fetch index.html: ${response.status}`);
    return await response.text();
  }
  if (asset.appStorageId) {
    const blob = await ctx.storage.get(asset.appStorageId);
    if (!blob) throw new Error("index.html is missing from storage");
    return await blob.text();
  }
  throw new Error("index.html has no resolvable content");
}

// Serves the same SPA shell as every other route, but for /posts/:slug with a
// publicly viewable post, splices in that post's Open Graph/Twitter tags
// first. A crawler (iMessage, SMS preview generators, Slack, ...) reads the
// static HTML and never runs the SPA's JavaScript, so this is the only way
// its preview can show the post's title, excerpt, and cover image. A real
// visitor's browser still loads the same shell and boots the SPA normally.
//
// When the post can't be found or isn't viewable by an anonymous caller
// (unpublished, channel-restricted, or the site requires sign-in), the shell
// is returned unmodified — same as any other unknown path — so nothing about
// a private post leaks into its preview.
export const postPage = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const [prefix, slug, ...rest] = url.pathname.split("/").filter(Boolean);
  const shell = await fetchIndexHtml(ctx);
  if (prefix !== "posts" || !slug || rest.length > 0) {
    return htmlResponse(shell);
  }
  const post = await ctx.runQuery(api.posts.publicQueries.getBySlug, { slug });
  if (!post) return htmlResponse(shell);
  const head = buildPostHead({
    title: post.title,
    description: post.excerpt,
    image: post.coverImageUrl,
    url: `${url.origin}/posts/${post.slug}`,
  });
  return htmlResponse(injectPostHead(shell, head));
});
