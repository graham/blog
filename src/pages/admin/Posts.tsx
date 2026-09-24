import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/format";

const PAGE_SIZE = 20;

export default function AdminPosts() {
  const navigate = useNavigate();
  const create = useMutation(api.posts.mutations.create);
  const [q, setQ] = useState("");
  const searching = q.trim().length > 0;
  const searchResults = useQuery(
    api.posts.queries.searchAll,
    searching ? { query: q.trim() } : "skip",
  );
  const list = usePaginatedQuery(
    api.posts.queries.listAll,
    searching ? "skip" : {},
    { initialNumItems: PAGE_SIZE },
  );

  const posts = searching ? (searchResults ?? []) : list.results;
  const loading = searching
    ? searchResults === undefined
    : list.status === "LoadingFirstPage";

  async function onCreate() {
    const id = await create({});
    navigate(`/admin/posts/${id}`);
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-sans text-2xl font-semibold tracking-tight">Posts</h1>
        <div className="flex min-w-0 items-center gap-3">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search posts"
            className="h-10 w-full min-w-0 max-w-56 rounded-md border border-input bg-card px-3 text-sm outline-none ring-ring placeholder:text-muted focus:ring-2"
          />
          <Button asChild variant="outline">
            <Link to="/admin/drafts">Drafts</Link>
          </Button>
          <Button onClick={() => void onCreate()}>New post</Button>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted">
          {searching
            ? "No matching posts."
            : "No posts yet. Create one to start writing."}
        </p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {posts.map((post) => (
              <div
                key={post._id}
                className={`cursor-pointer rounded-xl border p-4 ${
                  post.status === "scheduled"
                    ? "border-destructive bg-destructive/10"
                    : "border-border bg-card"
                }`}
                onClick={() => navigate(`/admin/posts/${post._id}`)}
              >
                <p className="font-medium">{post.title || "Untitled"}</p>
                <p className="mt-1 text-xs capitalize text-muted">
                  {post.status} · {post.visibility} · {formatDate(post.updatedAt)}
                </p>
                {post.status === "scheduled" && post.publishedAt !== null ? (
                  <p className="mt-1 text-xs font-medium text-destructive">
                    Not public until {formatDateTime(post.publishedAt)}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted">
                  {post.imageCount} {post.imageCount === 1 ? "image" : "images"} ·{" "}
                  {post.characterCount.toLocaleString()} chars
                </p>
                <div
                  className="mt-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button asChild variant="outline" size="sm">
                    <Link
                      to={
                        post.status === "published"
                          ? `/posts/${post.slug}`
                          : `/admin/preview/${post.slug}`
                      }
                    >
                      View
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-secondary/60 text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Visibility</th>
                  <th className="px-4 py-2 font-medium">Size</th>
                  <th className="px-4 py-2 font-medium">Updated</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr
                    key={post._id}
                    className={`cursor-pointer border-b border-border last:border-0 ${
                      post.status === "scheduled"
                        ? "bg-destructive/10 hover:bg-destructive/20"
                        : "hover:bg-secondary/40"
                    }`}
                    onClick={() => navigate(`/admin/posts/${post._id}`)}
                  >
                    <td className="px-4 py-3">{post.title || "Untitled"}</td>
                    <td className="px-4 py-3">
                      {post.status === "scheduled" ? (
                        <>
                          <span className="block font-medium text-destructive">Scheduled</span>
                          {post.publishedAt !== null ? (
                            <span className="block text-xs text-destructive">
                              Not public until {formatDateTime(post.publishedAt)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="capitalize">{post.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize">{post.visibility}</td>
                    <td className="px-4 py-3 text-muted">
                      <span className="block">
                        {post.imageCount} {post.imageCount === 1 ? "image" : "images"}
                      </span>
                      <span className="block">
                        {post.characterCount.toLocaleString()} chars
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatDate(post.updatedAt)}
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Button asChild variant="outline" size="sm">
                        <Link
                          to={
                            post.status === "published"
                              ? `/posts/${post.slug}`
                              : `/admin/preview/${post.slug}`
                          }
                        >
                          View
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!searching && list.status === "CanLoadMore" ? (
        <div className="pt-4">
          <Button variant="outline" onClick={() => list.loadMore(PAGE_SIZE)}>
            Load more
          </Button>
        </div>
      ) : null}
    </Layout>
  );
}
