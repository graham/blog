import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;

export default function BookmarkGroupDetail() {
  const { id } = useParams();
  const groupId = id as Id<"bookmarkGroups"> | undefined;
  const navigate = useNavigate();
  const config = useQuery(api.config.getConfig);
  const enabled = config?.bookmarksEnabled === true;
  const group = useQuery(
    api.bookmarkGroups.queries.get,
    enabled && groupId ? { groupId } : "skip",
  );
  const posts = usePaginatedQuery(
    api.bookmarkGroupPosts.queries.listByGroup,
    enabled && groupId ? { groupId } : "skip",
    { initialNumItems: PAGE_SIZE },
  );
  const rename = useMutation(api.bookmarkGroups.mutations.rename);
  const removeGroup = useMutation(api.bookmarkGroups.mutations.remove);
  const addPost = useMutation(api.bookmarkGroupPosts.mutations.addBySlug);
  const removePost = useMutation(api.bookmarkGroupPosts.mutations.remove);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (group) setName(group.name);
  }, [group]);

  if (config === undefined) {
    return (
      <Layout>
        <p className="text-sm text-muted">Loading...</p>
      </Layout>
    );
  }

  if (!config.bookmarksEnabled) {
    return (
      <Layout>
        <p className="max-w-2xl text-sm text-muted">
          Bookmarks are off. Turn them on in{" "}
          <Link to="/admin/settings" className="text-foreground underline">
            Settings
          </Link>
          .
        </p>
      </Layout>
    );
  }

  if (group === undefined) {
    return (
      <Layout>
        <p className="text-sm text-muted">Loading...</p>
      </Layout>
    );
  }

  if (group === null || groupId === undefined) {
    return (
      <Layout>
        <p className="text-sm text-muted">Bookmark group not found.</p>
      </Layout>
    );
  }

  const resolvedGroupId = groupId;

  async function onRename(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await rename({ groupId: resolvedGroupId, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename");
    }
  }

  async function onAddPost(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await addPost({ groupId: resolvedGroupId, slug });
      setSlug("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add post");
    }
  }

  return (
    <Layout>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          to="/admin/bookmarks"
          className="text-sm text-muted hover:text-foreground"
        >
          All bookmark groups
        </Link>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            if (!window.confirm("Delete this bookmark group?")) {
              return;
            }
            void removeGroup({ groupId: resolvedGroupId }).then(() =>
              navigate("/admin/bookmarks"),
            );
          }}
        >
          Delete
        </Button>
      </div>

      <form onSubmit={(event) => void onRename(event)} className="mb-8 flex max-w-lg gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-10 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit">Save name</Button>
      </form>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      <section>
        <h2 className="mb-3 font-sans text-lg font-semibold">Posts</h2>
        <form onSubmit={(event) => void onAddPost(event)} className="mb-4 flex max-w-lg gap-2">
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="Post slug"
            className="h-10 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit">Assign post</Button>
        </form>
        {posts.status === "LoadingFirstPage" ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : posts.results.length === 0 ? (
          <p className="text-sm text-muted">No posts assigned.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {posts.results.map((post) => (
              <li
                key={post.linkId}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <Link to={`/admin/posts/${post._id}`} className="hover:text-accent">
                  {post.title || "Untitled"}{" "}
                  <span className="text-muted">/{post.slug}</span>
                </Link>
                <button
                  type="button"
                  className="text-destructive"
                  onClick={() => void removePost({ linkId: post.linkId })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {posts.status === "CanLoadMore" ? (
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => posts.loadMore(PAGE_SIZE)}
          >
            Load more
          </Button>
        ) : null}
      </section>
    </Layout>
  );
}
