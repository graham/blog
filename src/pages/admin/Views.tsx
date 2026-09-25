import { Link } from "react-router-dom";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 25;

function LoadMore({ status, onLoadMore }: { status: string; onLoadMore: () => void }) {
  if (status === "LoadingMore") {
    return <p className="pt-3 text-sm text-muted">Loading...</p>;
  }
  if (status !== "CanLoadMore") return null;
  return (
    <div className="pt-3">
      <Button variant="outline" size="sm" onClick={onLoadMore}>
        Load more
      </Button>
    </div>
  );
}

function PostTitle({ title, slug }: { title: string | null; slug: string | null }) {
  if (slug === null) return <span className="text-muted">Deleted post</span>;
  return (
    <Link to={`/posts/${slug}`} className="hover:text-accent">
      {title || "Untitled"}
    </Link>
  );
}

export default function AdminViews() {
  const posts = usePaginatedQuery(
    api.postViews.queries.listByCount,
    {},
    { initialNumItems: PAGE_SIZE },
  );
  const images = usePaginatedQuery(
    api.imageViews.queries.listByCount,
    {},
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <Layout>
      <h1 className="mb-6 font-sans text-2xl font-semibold tracking-tight">Views</h1>

      <section className="mb-10">
        <h2 className="mb-3 font-sans text-lg font-semibold">Posts</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Post</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Views</th>
              </tr>
            </thead>
            <tbody>
              {posts.status === "LoadingFirstPage" ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-muted">
                    Loading...
                  </td>
                </tr>
              ) : posts.results.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-muted">
                    No post views yet.
                  </td>
                </tr>
              ) : (
                posts.results.map((row) => (
                  <tr key={row._id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">
                      <PostTitle title={row.title} slug={row.slug} />
                    </td>
                    <td className="px-4 py-3 text-muted">{row.status ?? ""}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {row.count.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <LoadMore status={posts.status} onLoadMore={() => posts.loadMore(PAGE_SIZE)} />
      </section>

      <section>
        <h2 className="mb-3 font-sans text-lg font-semibold">Images</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Image</th>
                <th className="px-4 py-2 font-medium">Post</th>
                <th className="px-4 py-2 text-right font-medium">Views</th>
              </tr>
            </thead>
            <tbody>
              {images.status === "LoadingFirstPage" ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-muted">
                    Loading...
                  </td>
                </tr>
              ) : images.results.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-muted">
                    No image views yet.
                  </td>
                </tr>
              ) : (
                images.results.map((row) => (
                  <tr key={row._id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      <a href={row.src} target="_blank" rel="noreferrer">
                        <img
                          src={row.src}
                          alt=""
                          loading="lazy"
                          className="h-12 w-12 rounded object-cover"
                        />
                      </a>
                    </td>
                    <td className="px-4 py-2 font-medium">
                      <PostTitle title={row.title} slug={row.slug} />
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {row.count.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <LoadMore status={images.status} onLoadMore={() => images.loadMore(PAGE_SIZE)} />
      </section>
    </Layout>
  );
}
