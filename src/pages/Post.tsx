import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Layout } from "@/components/Layout";
import { MarkdownBody } from "@/components/MarkdownBody";
import { ZoomableImage } from "@/components/ImageOverlay";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, isAdminUser, toDateTimeLocal } from "@/lib/format";
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
  const adminPost = useQuery(
    api.posts.queries.getBySlug,
    preview && slug ? { slug } : "skip",
  );
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
                {post.read.lastReadAt
                  ? ` (${formatDate(post.read.lastReadAt)})`
                  : ""}
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
        {isAdminUser(currentUser) ? (
          <PostTimesEditor
            postId={post._id}
            createdAt={post.createdAt}
            updatedAt={post.updatedAt}
            publishedAt={post.publishedAt}
            draft={post.status === "draft"}
          />
        ) : null}
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

function PostTimesEditor({
  postId,
  createdAt,
  updatedAt,
  publishedAt,
  draft,
}: {
  postId: Id<"posts">;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
  draft: boolean;
}) {
  const setTimes = useMutation(api.posts.mutations.setTimes);
  const [created, setCreated] = useState(toDateTimeLocal(createdAt));
  const [updated, setUpdated] = useState(toDateTimeLocal(updatedAt));
  const [published, setPublished] = useState(
    publishedAt === null ? "" : toDateTimeLocal(publishedAt),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCreated(toDateTimeLocal(createdAt));
    setUpdated(toDateTimeLocal(updatedAt));
    setPublished(publishedAt === null ? "" : toDateTimeLocal(publishedAt));
  }, [createdAt, updatedAt, publishedAt]);

  const publishedValue = published ? new Date(published).getTime() : null;
  const publishedInFuture =
    publishedValue !== null && Number.isFinite(publishedValue) && publishedValue > Date.now();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextCreated = new Date(created).getTime();
    const nextUpdated = new Date(updated).getTime();
    if (
      !Number.isFinite(nextCreated) ||
      !Number.isFinite(nextUpdated) ||
      (publishedValue !== null && !Number.isFinite(publishedValue))
    ) {
      setError("Enter valid dates");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await setTimes({
        postId,
        createdAt: nextCreated,
        updatedAt: nextUpdated,
        publishedAt: publishedValue,
      });
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save times");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="mb-8 rounded-xl border border-border bg-card p-4"
    >
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Dates</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Created</span>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={created}
              onChange={(event) => setCreated(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreated(toDateTimeLocal(Date.now()))}
            >
              Now
            </Button>
          </div>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Updated</span>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={updated}
              onChange={(event) => setUpdated(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUpdated(toDateTimeLocal(Date.now()))}
            >
              Now
            </Button>
          </div>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Published</span>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={published}
              onChange={(event) => setPublished(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPublished(toDateTimeLocal(Date.now()))}
            >
              Now
            </Button>
          </div>
        </label>
      </div>
      {publishedInFuture && publishedValue !== null ? (
        <p className="mt-3 rounded-md border border-accent bg-secondary p-3 text-sm">
          The published date is in the future.{" "}
          {draft
            ? `When this post is published it will stay hidden until ${formatDateTime(publishedValue)}.`
            : `This post will be hidden from readers until ${formatDateTime(publishedValue)}.`}{" "}
          You can still see it through the admin preview link.
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="mt-3 text-sm text-muted">Saved.</p> : null}
      <div className="mt-3">
        <Button type="submit" size="sm" disabled={busy}>
          Save dates
        </Button>
      </div>
    </form>
  );
}
