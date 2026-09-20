import { Fragment, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { useFeatures } from "@/components/FeaturesProvider";
import { formatTimeDelta, postTime } from "@/lib/format";

const PAGE_SIZE = 10;

export default function Home() {
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const searching = q.length > 0;
  const features = useFeatures();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const searchResults = useQuery(
    api.posts.publicQueries.searchPublished,
    searching ? { query: q, tag: null } : "skip",
  );
  const list = usePaginatedQuery(
    api.posts.publicQueries.listPublished,
    searching ? "skip" : {},
    { initialNumItems: PAGE_SIZE },
  );

  const posts = searching ? (searchResults ?? []) : list.results;
  const loading = searching
    ? searchResults === undefined
    : list.status === "LoadingFirstPage";
  const canLoadMore = !searching && list.status === "CanLoadMore";
  const infinite = features.infiniteScroll && !searching;

  useEffect(() => {
    if (!infinite || !canLoadMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          list.loadMore(PAGE_SIZE);
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [infinite, canLoadMore, list]);

  return (
    <Layout bookmarks>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 font-sans text-3xl font-semibold tracking-tight">
          {searching ? `Search: ${q}` : "Posts"}
        </h1>
        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted">
            {searching ? "No matching posts." : "No posts yet."}
          </p>
        ) : (
          <div>
            {posts.map((post, index) => {
              const previous = index > 0 ? posts[index - 1] : null;
              const delta =
                features.timings && previous
                  ? formatTimeDelta(postTime(previous), postTime(post))
                  : null;
              return (
                <Fragment key={post._id}>
                  {delta ? (
                    <p className="py-3 text-center text-[11px] uppercase tracking-[0.18em] text-muted">
                      {delta} earlier
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
      </div>
    </Layout>
  );
}
