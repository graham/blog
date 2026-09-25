import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQueries, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { ImageOverlay } from "@/components/ImageOverlay";
import { featureOn } from "@/lib/features";
import { formatDate, isAdminUser } from "@/lib/format";
import type { OverlayImage } from "@/lib/images";

type PhotoCursor = FunctionArgs<typeof api.posts.publicQueries.listPhotos>["cursor"];
type PhotoPage = FunctionReturnType<typeof api.posts.publicQueries.listPhotos>;

export default function Photos() {
  const features = useQuery(api.features.publicQueries.get);
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);
  const allowed =
    features !== undefined &&
    currentUser !== undefined &&
    featureOn(features.photos, isAdminUser(currentUser));

  // One entry per loaded batch; cursors[0] starts at the newest photo.
  const [cursors, setCursors] = useState<PhotoCursor[]>([null]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [advanceTo, setAdvanceTo] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const markRead = useMutation(api.postReads.mutations.markRead);
  // Photo keys opened in the viewer, grouped by post, for unread posts only.
  const viewedRef = useRef(new Map<string, Set<string>>());

  const results = useQueries(
    allowed
      ? Object.fromEntries(
          cursors.map((cursor, index) => [
            String(index),
            { query: api.posts.publicQueries.listPhotos, args: { cursor } },
          ]),
        )
      : {},
  );

  // Batches load in order; stop at the first one still in flight so the grid
  // never shows a gap.
  const { photos, nextCursor, loading } = useMemo(() => {
    const flat: PhotoPage["photos"] = [];
    const keys = new Set<string>();
    let next: PhotoCursor = null;
    for (let index = 0; index < cursors.length; index += 1) {
      const page = results[String(index)] as PhotoPage | Error | undefined;
      if (page === undefined || page instanceof Error) {
        return { photos: flat, nextCursor: null, loading: page === undefined };
      }
      for (const photo of page.photos) {
        if (keys.has(photo.key)) continue;
        keys.add(photo.key);
        flat.push(photo);
      }
      next = page.nextCursor;
    }
    return { photos: flat, nextCursor: next, loading: false };
  }, [results, cursors.length]);

  function loadMore() {
    if (!nextCursor || loading) return;
    setCursors((current) => [...current, nextCursor]);
  }
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextCursor || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreRef.current();
      },
      { rootMargin: "800px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, loading]);

  // Opening every photo of an unread post in the viewer marks the post read.
  // seen is null when read receipts do not apply to this viewer.
  const viewedPhoto = viewing === null ? undefined : photos[viewing];
  useEffect(() => {
    if (!viewedPhoto || viewedPhoto.seen !== false) return;
    const viewed = viewedRef.current.get(viewedPhoto.postId) ?? new Set<string>();
    viewed.add(viewedPhoto.key);
    viewedRef.current.set(viewedPhoto.postId, viewed);
    if (viewed.size === viewedPhoto.postPhotoCount) {
      viewedRef.current.delete(viewedPhoto.postId);
      void markRead({ postId: viewedPhoto.postId }).catch((error: unknown) =>
        console.warn("Could not mark post read", error),
      );
    }
  }, [viewedPhoto, markRead]);

  // Stepping past the last photo in the viewer loads the next batch and
  // moves on once it arrives.
  useEffect(() => {
    if (advanceTo !== null && photos.length > advanceTo) {
      setViewing(advanceTo);
      setAdvanceTo(null);
    }
  }, [advanceTo, photos.length]);

  if (features === undefined || currentUser === undefined) {
    return (
      <Layout wide>
        <p className="text-sm text-muted">Loading...</p>
      </Layout>
    );
  }
  if (!allowed) return <Navigate to="/" replace />;

  const gallery: OverlayImage[] = photos.map((photo) => ({
    src: photo.src,
    alt: photo.alt,
    caption: [formatDate(photo.publishedAt), photo.title || photo.alt].filter(Boolean).join(" · "),
  }));

  return (
    <Layout wide>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-sans text-3xl font-semibold tracking-tight">Photos</h1>
          <p className="text-xs text-muted">Click a photo to view it. Arrow keys step through.</p>
        </div>
        {photos.length === 0 ? (
          <p className="text-sm text-muted">{loading ? "Loading..." : "No photos yet."}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((photo, index) => (
              <figure
                key={photo.key}
                className="min-w-0 overflow-hidden rounded-lg border border-border bg-card"
              >
                <button
                  type="button"
                  onClick={() => setViewing(index)}
                  className="relative block aspect-square w-full cursor-zoom-in bg-secondary"
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    loading="lazy"
                    className={`h-full w-full object-cover ${photo.seen ? "opacity-70" : ""}`}
                  />
                  {photo.seen ? (
                    <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
                      Seen
                    </span>
                  ) : null}
                </button>
                <figcaption className="px-2 py-1.5 text-xs">
                  <Link
                    to={`/posts/${photo.slug}`}
                    title={photo.title || undefined}
                    className="text-muted hover:text-foreground"
                  >
                    {formatDate(photo.publishedAt)}
                  </Link>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        <div ref={sentinelRef} aria-hidden="true" />
        {photos.length > 0 ? (
          <p className="py-4 text-center text-xs text-muted">
            {loading ? "Loading more..." : nextCursor ? "" : "No more photos."}
          </p>
        ) : null}
      </div>
      <ImageOverlay
        images={gallery}
        index={viewing ?? 0}
        open={viewing !== null}
        onClose={() => {
          setViewing(null);
          setAdvanceTo(null);
        }}
        onIndexChange={setViewing}
        onStepPast={(direction) => {
          if (direction === 1 && nextCursor) {
            setAdvanceTo(photos.length);
            loadMore();
          }
        }}
      />
    </Layout>
  );
}
