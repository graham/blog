import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { MarkdownBody } from "@/components/MarkdownBody";
import { ZoomableImage } from "@/components/ImageOverlay";
import { formatDate, isAdminUser } from "@/lib/format";
import { markdownOverlayImages, postOverlayImages } from "@/lib/images";

export default function Post() {
  const { slug } = useParams();
  const post = useQuery(api.posts.publicQueries.getBySlug, slug ? { slug } : "skip");
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);
  const navigation = useQuery(api.posts.publicQueries.getAdjacentBySlug, slug ? { slug } : "skip");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [slug]);

  if (post === undefined) {
    return (
      <Layout>
        <p className="text-sm text-muted">Loading...</p>
      </Layout>
    );
  }

  if (post === null) {
    return (
      <Layout>
        <h1 className="text-2xl font-semibold">Not found</h1>
        <p className="mt-2 text-sm text-muted">
          This post is missing, unpublished, or not available.
        </p>
      </Layout>
    );
  }

  const gallery = postOverlayImages(
    post.coverImageUrl ? { src: post.coverImageUrl, alt: post.title || "Cover image" } : null,
    markdownOverlayImages(post.body, post.assets),
  );

  const postNavigation = (
    <nav
      className="flex min-h-6 items-center justify-between gap-4 text-sm"
      aria-label="Post navigation"
    >
      {navigation?.previous ? (
        <Link
          to={`/posts/${navigation.previous.slug}`}
          title={navigation.previous.title || "Previous post"}
          className="text-muted hover:text-foreground"
        >
          ← Prev post
        </Link>
      ) : (
        <span />
      )}
      {navigation?.next ? (
        <Link
          to={`/posts/${navigation.next.slug}`}
          title={navigation.next.title || "Next post"}
          className="text-muted hover:text-foreground"
        >
          Next post →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );

  return (
    <Layout>
      <article className="mx-auto max-w-2xl">
        <div className="mb-8 border-b border-border pb-4">{postNavigation}</div>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            {post.status === "draft" ? (
              <p className="mb-2 text-xs uppercase tracking-wide text-muted">Draft preview</p>
            ) : null}
            <time className="text-xs uppercase tracking-wide text-muted">
              {formatDate(post.publishedAt ?? post.updatedAt)}
            </time>
            <h1 className="mt-2 font-sans text-4xl font-semibold tracking-tight">
              {post.title || "Untitled"}
            </h1>
            {post.tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/tags/${tag}`}
                    className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground hover:bg-border"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          {isAdminUser(currentUser) ? (
            <Link
              to={`/admin/posts/${post._id}`}
              className="text-sm text-muted hover:text-foreground"
            >
              Edit
            </Link>
          ) : null}
        </div>
        {post.coverImageUrl ? (
          <ZoomableImage
            src={post.coverImageUrl}
            alt={post.title || "Cover image"}
            className="mb-8 w-full rounded-xl object-cover"
            gallery={gallery}
          />
        ) : null}
        <MarkdownBody content={post.body} assets={post.assets} gallery={gallery} />
        <div className="mt-10 border-t border-border pt-4">{postNavigation}</div>
      </article>
    </Layout>
  );
}
