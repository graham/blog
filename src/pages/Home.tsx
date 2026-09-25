import { Fragment, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { useFeatureOn, useFeatures } from "@/components/FeaturesProvider";
import { formatTimeDelta, isAdminUser } from "@/lib/format";
import { useImagesOnly } from "@/lib/useImagesOnly";

const PAGE_SIZE = 10;

export default function Home() {
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const unreadOnly = params.get("unread") === "1";
  const searching = q.length > 0;
  const features = useFeatures();
  const timingsOn = useFeatureOn(features.timings);
  const infiniteScrollOn = useFeatureOn(features.infiniteScroll);
  const receiptsOn = useFeatureOn(features.readReceipts);
  const imagesOnly = useImagesOnly();
  const markAllRead = useMutation(api.postReads.mutations.markAllRead);
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);
  const scheduledCount = useQuery(
    api.posts.queries.countScheduled,
    isAdminUser(currentUser) ? {} : "skip",
  );
  const sentinelRef = useRef<HTMLDivElement>(null);

  const searchResults = useQuery(
    api.posts.publicQueries.searchPublished,
    searching ? { query: q, tag: null } : "skip",
  );
  const list = usePaginatedQuery(
    api.posts.publicQueries.listPublished,
    searching ? "skip" : { unreadOnly: unreadOnly && receiptsOn ? true : undefined },
    { initialNumItems: PAGE_SIZE },
  );

  const posts = searching ? (searchResults ?? []) : list.results;
  const loading = searching ? searchResults === undefined : list.status === "LoadingFirstPage";
  const canLoadMore = !searching && list.status === "CanLoadMore";
  const infinite = infiniteScrollOn && !searching;
  const exhausted = !searching && list.status === "Exhausted";
  const loadMoreRef = useRef(list.loadMore);
  loadMoreRef.current = list.loadMore;

  useEffect(() => {
    if (!infinite || !canLoadMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreRef.current(PAGE_SIZE);
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [infinite, canLoadMore]);

  return (
    <Layout bookmarks>
      <div className="mx-auto w-full min-w-0 max-w-2xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-sans text-3xl font-semibold tracking-tight">
            {searching ? `Search: ${q}` : unreadOnly ? "Unread" : "Posts"}
          </h1>
          {scheduledCount ? (
            <Link to="/admin" className="text-sm text-muted hover:text-foreground">
              {scheduledCount > 500 ? "500+" : scheduledCount} scheduled
            </Link>
          ) : null}
          {receiptsOn && unreadOnly && !searching ? (
            <Button variant="outline" size="sm" onClick={() => void markAllRead({})}>
              Mark all read
            </Button>
          ) : null}
        </div>
        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted">
            {searching
              ? "No matching posts."
              : unreadOnly
                ? "Nothing more to read."
                : "No posts yet."}
          </p>
        ) : (
          <div>
            {posts.map((post, index) => {
              const previous = index > 0 ? posts[index - 1] : null;
              const delta =
                !timingsOn || imagesOnly
                  ? null
                  : previous
                    ? `${formatTimeDelta(previous.createdAt, post.createdAt)} earlier`
                    : `${formatTimeDelta(Date.now(), post.createdAt)} ago`;
              return (
                <Fragment key={post._id}>
                  {delta ? (
                    <p className="py-3 text-center text-[11px] uppercase tracking-[0.18em] text-muted">
                      {delta}
                    </p>
                  ) : null}
                  <PostCard post={post} />
                </Fragment>
              );
            })}
          </div>
        )}
        {!searching && list.status === "CanLoadMore" && !infinite ? (
          <div className="pt-6">
            <Button variant="outline" onClick={() => list.loadMore(PAGE_SIZE)}>
              Load more
            </Button>
          </div>
        ) : null}
        {infinite && (list.status === "CanLoadMore" || list.status === "LoadingMore") ? (
          <div ref={sentinelRef} className="h-8" aria-hidden="true" />
        ) : null}
        {infinite && list.status === "LoadingMore" ? (
          <p className="pt-2 text-center text-sm text-muted">Loading...</p>
        ) : null}
        {infinite && exhausted && posts.length > 0 ? (
          <p className="pt-6 text-center text-sm text-muted">Nothing more to read.</p>
        ) : null}
      </div>
    </Layout>
  );
}
