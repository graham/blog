import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 20;

export default function AdminDrafts() {
  const navigate = useNavigate();
  const list = usePaginatedQuery(api.posts.queries.listDrafts, {}, { initialNumItems: PAGE_SIZE });
  const publishNow = useMutation(api.posts.mutations.publishNow);
  const [publishing, setPublishing] = useState<Id<"posts"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPublishNow(postId: Id<"posts">, title: string) {
    if (
      !window.confirm(
        `Publish "${title || "Untitled"}" now? Its created, updated, and published dates become now.`,
      )
    ) {
      return;
    }
    setPublishing(postId);
    setError(null);
    try {
      await publishNow({ postId });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not publish");
    } finally {
      setPublishing(null);
    }
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-sans text-2xl font-semibold tracking-tight">Drafts</h1>
        <Button asChild variant="outline">
          <Link to="/admin">All posts</Link>
        </Button>
      </div>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      {list.status === "LoadingFirstPage" ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : list.results.length === 0 ? (
        <p className="text-sm text-muted">No drafts.</p>
      ) : (
        <div className="space-y-3">
          {list.results.map((post) => (
            <div
              key={post._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <button
                type="button"
                className="min-w-0 text-left"
                onClick={() => navigate(`/admin/preview/${post.slug}`)}
              >
                <p className="font-medium">{post.title || "Untitled"}</p>
                <p className="mt-1 text-xs text-muted">
                  {post.visibility} · {formatDate(post.updatedAt)}
                </p>
              </button>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to={`/admin/preview/${post.slug}`}>View</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/admin/posts/${post._id}`}>Edit</Link>
                </Button>
                <Button
                  size="sm"
                  disabled={publishing !== null}
                  onClick={() => void onPublishNow(post._id, post.title)}
                >
                  {publishing === post._id ? "Publishing..." : "Publish now"}
                </Button>
              </div>
            </div>
          ))}
          {list.status === "CanLoadMore" ? (
            <Button variant="outline" onClick={() => list.loadMore(PAGE_SIZE)}>
              Load more
            </Button>
          ) : null}
        </div>
      )}
    </Layout>
  );
}
