import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { MarkdownBody } from "@/components/MarkdownBody";
import { ZoomableImage } from "@/components/ImageOverlay";
import { Button } from "@/components/ui/button";
import { formatDate, isAdminUser } from "@/lib/format";
import { markdownOverlayImages, postOverlayImages } from "@/lib/images";
import { hasPublicMedia, NO_PUBLIC_TEXT_MESSAGE } from "@/lib/mediaOnly";
import { useImagesOnly } from "@/lib/useImagesOnly";
import { usePostWide } from "@/lib/usePostWide";

function PostNavigation({
  previous,
  next,
}: {
  previous?: { title: string; slug: string } | null;
  next?: { title: string; slug: string } | null;
}) {
  return (
    <nav
      className="flex min-h-6 w-full shrink-0 items-center justify-between gap-4 text-sm"
      aria-label="Post navigation"
    >
      {previous ? (
        <Link
          to={`/posts/${previous.slug}`}
          title={previous.title || "Previous post"}
          className="text-muted hover:text-foreground"
        >
          ← Prev post
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          to={`/posts/${next.slug}`}
          title={next.title || "Next post"}
          className="text-muted hover:text-foreground"
        >
          Next post →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export default function Post() {
  const { slug } = useParams();
  const post = useQuery(api.posts.publicQueries.getBySlug, slug ? { slug } : "skip");
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);
  const navigation = useQuery(api.posts.publicQueries.getAdjacentBySlug, slug ? { slug } : "skip");
  const imagesOnly = useImagesOnly();
  const [wide, toggleWide] = usePostWide();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [slug]);

  if (post === undefined) {
    return (
      <Layout bookmarks wide={wide}>
        <p className="text-sm text-muted">Loading...</p>
      </Layout>
    );
  }

  if (post === null) {
    return (
      <Layout bookmarks wide={wide}>
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

  const prev = navigation?.previous ?? null;
  const next = navigation?.next ?? null;
  const publicMedia = Boolean(post.coverImageUrl) || hasPublicMedia(post.body);

  return (
    <Layout
      bookmarks
      wide={wide}
      header={
        <div className="border-b border-border pb-4">
          <div className={`mx-auto w-full min-w-0 ${wide ? "max-w-none" : "max-w-2xl"}`}>
            <PostNavigation previous={prev} next={next} />
          </div>
        </div>
      }
      footer={
        <div className="border-t border-border pt-4">
          <div className={`mx-auto w-full min-w-0 ${wide ? "max-w-none" : "max-w-2xl"}`}>
            <PostNavigation previous={prev} next={next} />
          </div>
        </div>
      }
    >
      <article className={`mx-auto w-full min-w-0 ${wide ? "max-w-none" : "max-w-2xl"}`}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            {imagesOnly ? null : post.status === "draft" ? (
              <p className="mb-2 text-xs uppercase tracking-wide text-muted">Draft preview</p>
            ) : null}
            {imagesOnly ? null : (
              <time className="text-xs uppercase tracking-wide text-muted">
                {formatDate(post.publishedAt ?? post.updatedAt)}
              </time>
            )}
            <h1
              className={`${imagesOnly ? "" : "mt-2"} font-sans text-3xl font-semibold tracking-tight sm:text-4xl`}
            >
              {post.title || "Untitled"}
            </h1>
            {imagesOnly && post.excerpt ? (
              <p className="mt-3 text-[1.05rem] leading-7 text-muted">{post.excerpt}</p>
            ) : null}
            {imagesOnly || post.tags.length === 0 ? null : (
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
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={toggleWide}>
              {wide ? "Default width" : "Full width"}
            </Button>
            {isAdminUser(currentUser) ? (
              <Link
                to={`/admin/posts/${post._id}`}
                className="text-sm text-muted hover:text-foreground"
              >
                Edit
              </Link>
            ) : null}
          </div>
        </div>
        {imagesOnly && !publicMedia ? (
          <p className="text-sm text-muted">{NO_PUBLIC_TEXT_MESSAGE}</p>
        ) : (
          <>
            {post.coverImageUrl ? (
              <ZoomableImage
                src={post.coverImageUrl}
                alt={post.title || "Cover image"}
                className={`${imagesOnly ? "mb-6" : "mb-8"} h-auto w-full max-w-full rounded-xl object-cover`}
                gallery={gallery}
              />
            ) : null}
            {!imagesOnly || hasPublicMedia(post.body) ? (
              <MarkdownBody
                content={post.body}
                assets={post.assets}
                gallery={gallery}
                mediaOnly={imagesOnly}
              />
            ) : null}
          </>
        )}
      </article>
    </Layout>
  );
}
