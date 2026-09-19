import { useSearchParams } from "react-router-dom";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 10;

export default function Home() {
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const searching = q.length > 0;

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

  return (
    <Layout>
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
            {posts.map((post) => (
              <PostCard key={post._id} post={post} />
            ))}
          </div>
        )}
        {!searching && list.status === "CanLoadMore" ? (
          <div className="pt-6">
            <Button
              variant="outline"
              onClick={() => list.loadMore(PAGE_SIZE)}
            >
              Load more
            </Button>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
