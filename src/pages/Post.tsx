import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { MarkdownBody } from "@/components/MarkdownBody";
import { ZoomableImage } from "@/components/ImageOverlay";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, formatViews, isAdminUser } from "@/lib/format";
import { markdownOverlayImages, postOverlayImages } from "@/lib/images";
import { hasPublicMedia, NO_PUBLIC_TEXT_MESSAGE } from "@/lib/mediaOnly";
import { useImagesOnly } from "@/lib/useImagesOnly";
import { usePostWide } from "@/lib/usePostWide";
import { useFeatureOn, useFeatures } from "@/components/FeaturesProvider";

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

export default function Post({ preview = false }: { preview?: boolean }) {
  const { slug } = useParams();
  const publicPost = useQuery(
    api.posts.publicQueries.getBySlug,
    !preview && slug ? { slug } : "skip",
  );
  const adminPost = useQuery(api.posts.queries.getBySlug, preview && slug ? { slug } : "skip");
  const post = preview ? adminPost : publicPost;
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);
  const navigation = useQuery(
    api.posts.publicQueries.getAdjacentBySlug,
    !preview && slug ? { slug } : "skip",
  );
  const imagesOnly = useImagesOnly();
  const [wide, toggleWide] = usePostWide();
  const features = useFeatures();
  const receiptsOn = useFeatureOn(features.readReceipts);
  const markRead = useMutation(api.postReads.mutations.markRead);
  const recordView = useMutation(api.postViews.publicMutations.record);
  const viewPostId = !preview && post ? post._id : undefined;
  const views = useQuery(
    api.postViews.publicQueries.getCount,
    viewPostId ? { postId: viewPostId } : "skip",
  );
  const removePost = useAction(api.posts.actions.remove);
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [slug]);

  useEffect(() => {
    if (preview || !post || !receiptsOn) return;
    void markRead({ postId: post._id });
  }, [preview, post?._id, receiptsOn, markRead]);

  useEffect(() => {
    if (!viewPostId) return;
    void recordView({ postId: viewPostId }).catch((error: unknown) =>
      console.warn("Could not record post view", error),
    );
  }, [viewPostId, recordView]);

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
  ).map((image) => ({ ...image, postId: viewPostId }));

  const prev = navigation?.previous ?? null;
  const next = navigation?.next ?? null;
  const publicMedia = Boolean(post.coverImageUrl) || hasPublicMedia(post.body);

  return (
    <Layout
      bookmarks
      wide={wide}
      header={
        preview ? undefined : (
          <div className="border-b border-border pb-4">
            <div className={`mx-auto w-full min-w-0 ${wide ? "max-w-none" : "max-w-2xl"}`}>
              <PostNavigation previous={prev} next={next} />
            </div>
          </div>
        )
      }
      footer={
        preview ? undefined : (
          <div className="border-t border-border pt-4">
            <div className={`mx-auto w-full min-w-0 ${wide ? "max-w-none" : "max-w-2xl"}`}>
              <PostNavigation previous={prev} next={next} />
            </div>
          </div>
        )
      }
    >
      <article className={`mx-auto w-full min-w-0 ${wide ? "max-w-none" : "max-w-2xl"}`}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            {post.read?.updatedSinceRead ? (
              <p className="mb-2 text-xs uppercase tracking-wide text-accent">
                New updates since you last read this
                {post.read.lastReadAt ? ` (${formatDate(post.read.lastReadAt)})` : ""}
              </p>
            ) : post.read?.unread ? (
              <p className="mb-2 text-xs uppercase tracking-wide text-accent">Unread</p>
            ) : post.read?.lastReadAt ? (
              <p className="mb-2 text-xs uppercase tracking-wide text-muted">
                Last read {formatDate(post.read.lastReadAt)}
              </p>
            ) : null}
            {imagesOnly ? null : post.status === "draft" ? (
              <p className="mb-2 text-xs uppercase tracking-wide text-muted">Draft preview</p>
            ) : post.status === "scheduled" && post.publishedAt !== null ? (
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-destructive">
                Scheduled for {formatDateTime(post.publishedAt)}
              </p>
            ) : null}
            {imagesOnly ? null : (
              <p className="text-xs uppercase tracking-wide text-muted">
                <time>{formatDate(post.publishedAt ?? post.updatedAt)}</time>
                {views !== undefined ? <span> · {formatViews(views)}</span> : null}
              </p>
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
            {preview && post.status === "draft" && isAdminUser(currentUser) ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={() => {
                  if (!window.confirm("Delete this draft and its files?")) return;
                  setDeleting(true);
                  void removePost({ postId: post._id })
                    .then(() => navigate("/admin/drafts"))
                    .catch(() => setDeleting(false));
                }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
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
