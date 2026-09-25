import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { ImageOverlay } from "@/components/ImageOverlay";
import { Button } from "@/components/ui/button";
import { featureOn } from "@/lib/features";
import { formatDate, isAdminUser } from "@/lib/format";
import type { OverlayImage } from "@/lib/images";

type PhotoCursor = FunctionArgs<typeof api.posts.publicQueries.listPhotos>["cursor"];

export default function Photos() {
  const features = useQuery(api.features.publicQueries.get);
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);
  const allowed =
    features !== undefined &&
    currentUser !== undefined &&
    featureOn(features.photos, isAdminUser(currentUser));

  // cursors[n] starts page n; page 0 starts at the newest photo.
  const [cursors, setCursors] = useState<PhotoCursor[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const result = useQuery(
    api.posts.publicQueries.listPhotos,
    allowed ? { cursor: cursors[pageIndex] ?? null } : "skip",
  );
  const photos = result?.photos ?? [];
  const nextCursor = result?.nextCursor ?? null;
  const canGoNewer = pageIndex > 0;
  const canGoOlder = nextCursor !== null;

  function goOlder() {
    if (!nextCursor) return;
    setCursors((current) => [...current.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex(pageIndex + 1);
    setViewing(null);
    window.scrollTo({ top: 0 });
  }

  function goNewer() {
    if (pageIndex === 0) return;
    setPageIndex(pageIndex - 1);
    setViewing(null);
    window.scrollTo({ top: 0 });
  }

  useEffect(() => {
    if (viewing !== null) return;
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "ArrowRight" && canGoOlder) goOlder();
      if (event.key === "ArrowLeft" && canGoNewer) goNewer();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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

  const pager = (
    <div className="flex items-center justify-between gap-3">
      <Button variant="outline" size="sm" disabled={!canGoNewer} onClick={goNewer}>
        Newer
      </Button>
      <span className="text-sm tabular-nums text-muted">Page {pageIndex + 1}</span>
      <Button variant="outline" size="sm" disabled={!canGoOlder} onClick={goOlder}>
        Older
      </Button>
    </div>
  );

  return (
    <Layout wide>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-sans text-3xl font-semibold tracking-tight">Photos</h1>
          <p className="text-xs text-muted">Arrow keys change pages. Click a photo to view it.</p>
        </div>
        {pager}
        {result === undefined ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : photos.length === 0 ? (
          <p className="text-sm text-muted">No photos yet.</p>
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
        {photos.length > 0 ? pager : null}
      </div>
      <ImageOverlay
        images={gallery}
        index={viewing ?? 0}
        open={viewing !== null}
        onClose={() => setViewing(null)}
        onIndexChange={setViewing}
      />
    </Layout>
  );
}
