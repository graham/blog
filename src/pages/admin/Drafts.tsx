import { Link, useNavigate } from "react-router-dom";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 20;

export default function AdminDrafts() {
  const navigate = useNavigate();
  const list = usePaginatedQuery(api.posts.queries.listDrafts, {}, { initialNumItems: PAGE_SIZE });

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-sans text-2xl font-semibold tracking-tight">Drafts</h1>
        <Button asChild variant="outline">
          <Link to="/admin">All posts</Link>
        </Button>
      </div>
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
