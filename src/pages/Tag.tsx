import { useParams } from "react-router-dom";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 10;

export default function Tag() {
  const { tag } = useParams();
  const list = usePaginatedQuery(api.posts.publicQueries.listByTag, tag ? { tag } : "skip", {
    initialNumItems: PAGE_SIZE,
  });

  return (
    <Layout bookmarks>
      <div className="mx-auto w-full min-w-0 max-w-2xl">
        <h1 className="mb-8 font-sans text-3xl font-semibold tracking-tight">#{tag}</h1>
        {list.status === "LoadingFirstPage" ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : list.results.length === 0 ? (
          <p className="text-sm text-muted">No posts with this tag.</p>
        ) : (
          list.results.map((post) => <PostCard key={post._id} post={post} />)
        )}
        {list.status === "CanLoadMore" ? (
          <div className="pt-6">
            <Button variant="outline" onClick={() => list.loadMore(PAGE_SIZE)}>
              Load more
            </Button>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
