import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";

export default function TagDetail() {
  const { id } = useParams();
  const tagId = id as Id<"tags"> | undefined;
  const navigate = useNavigate();
  const tag = useQuery(api.tags.queries.get, tagId ? { tagId } : "skip");
  const tagged = useQuery(api.tags.queries.listPosts, tagId ? { tagId } : "skip");
  const [q, setQ] = useState("");
  const searching = q.trim().length > 0;
  const searchResults = useQuery(
    api.posts.queries.searchAll,
    searching ? { query: q.trim() } : "skip",
  );
  const rename = useMutation(api.tags.mutations.rename);
  const removeTag = useMutation(api.tags.mutations.remove);
  const addBySlug = useMutation(api.tags.mutations.addPostBySlug);
  const addPost = useMutation(api.tags.mutations.addPost);
  const removePost = useMutation(api.tags.mutations.removePost);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tag) setName(tag.name);
  }, [tag]);

  if (tag === undefined || tagId === undefined) {
    return (
      <Layout>
        <p className="text-sm text-muted">Loading...</p>
      </Layout>
    );
  }

  if (tag === null) {
    return (
      <Layout>
        <p className="text-sm text-muted">Tag not found.</p>
      </Layout>
    );
  }

  const resolvedTagId = tagId;

  async function onRename(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await rename({ tagId: resolvedTagId, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename");
    }
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await addBySlug({ tagId: resolvedTagId, slug });
      setSlug("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add post");
    }
  }

  const taggedIds = new Set((tagged ?? []).map((post) => post._id));

  return (
    <Layout>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to="/admin/tags" className="text-sm text-muted hover:text-foreground">
          All tags
        </Link>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            if (!window.confirm("Delete this tag from every post?")) return;
            void removeTag({ tagId: resolvedTagId }).then(() => navigate("/admin/tags"));
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

      <section className="mb-10">
        <h2 className="mb-3 font-sans text-lg font-semibold">Posts with this tag</h2>
        {tagged === undefined ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : tagged.length === 0 ? (
          <p className="text-sm text-muted">No posts yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {tagged.map((post) => (
              <li key={post._id} className="flex items-center justify-between px-4 py-3 text-sm">
                <Link to={`/admin/posts/${post._id}`} className="hover:text-accent">
                  {post.title || "Untitled"}{" "}
                  <span className="text-muted">/{post.slug}</span>
                </Link>
                <button
                  type="button"
                  className="text-destructive"
                  onClick={() => void removePost({ tagId: resolvedTagId, postId: post._id })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-sans text-lg font-semibold">Add posts</h2>
        <form onSubmit={(event) => void onAdd(event)} className="mb-4 flex max-w-lg gap-2">
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="Post slug"
            className="h-10 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit">Add by slug</Button>
        </form>
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search posts to tag"
          className="mb-4 h-10 w-full max-w-lg rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {searching && searchResults === undefined ? (
          <p className="text-sm text-muted">Searching...</p>
        ) : null}
        {searchResults && searchResults.length === 0 ? (
          <p className="text-sm text-muted">No matching posts.</p>
        ) : null}
        {searchResults && searchResults.length > 0 ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {searchResults.map((post) => {
              const has = taggedIds.has(post._id);
              return (
                <li key={post._id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>
                    {post.title || "Untitled"}{" "}
                    <span className="text-muted">/{post.slug}</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={has ? "outline" : "default"}
                    disabled={has}
                    onClick={() => void addPost({ tagId: resolvedTagId, postId: post._id })}
                  >
                    {has ? "Tagged" : "Add"}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </Layout>
  );
}
