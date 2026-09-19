import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;

export default function ChannelDetail() {
  const { id } = useParams();
  const channelId = id as Id<"channels"> | undefined;
  const navigate = useNavigate();
  const channel = useQuery(
    api.channels.queries.get,
    channelId ? { channelId } : "skip",
  );
  const members = usePaginatedQuery(
    api.channelMembers.queries.listByChannel,
    channelId ? { channelId } : "skip",
    { initialNumItems: PAGE_SIZE },
  );
  const posts = usePaginatedQuery(
    api.channelPosts.queries.listByChannel,
    channelId ? { channelId } : "skip",
    { initialNumItems: PAGE_SIZE },
  );
  const rename = useMutation(api.channels.mutations.rename);
  const removeChannel = useMutation(api.channels.mutations.remove);
  const addMember = useMutation(api.channelMembers.mutations.addByEmail);
  const removeMember = useMutation(api.channelMembers.mutations.remove);
  const addPost = useMutation(api.channelPosts.mutations.addBySlug);
  const removePost = useMutation(api.channelPosts.mutations.remove);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (channel) setName(channel.name);
  }, [channel]);

  if (channel === undefined) {
    return (
      <Layout>
        <p className="text-sm text-muted">Loading...</p>
      </Layout>
    );
  }

  if (channel === null || channelId === undefined) {
    return (
      <Layout>
        <p className="text-sm text-muted">Channel not found.</p>
      </Layout>
    );
  }

  const resolvedChannelId = channelId;

  async function onRename(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await rename({ channelId: resolvedChannelId, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename");
    }
  }

  async function onAddMember(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await addMember({ channelId: resolvedChannelId, email });
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add member");
    }
  }

  async function onAddPost(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await addPost({ channelId: resolvedChannelId, slug });
      setSlug("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add post");
    }
  }

  return (
    <Layout>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to="/admin/channels" className="text-sm text-muted hover:text-foreground">
          All channels
        </Link>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            if (!window.confirm("Delete this channel? Posts become public if they have no other channels.")) {
              return;
            }
            void removeChannel({ channelId: resolvedChannelId }).then(() =>
              navigate("/admin/channels"),
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

      <section className="mb-10">
        <h2 className="mb-3 font-sans text-lg font-semibold">Members</h2>
        <form onSubmit={(event) => void onAddMember(event)} className="mb-4 flex max-w-lg gap-2">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@example.com"
            className="h-10 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit">Add member</Button>
        </form>
        {members.status === "LoadingFirstPage" ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : members.results.length === 0 ? (
          <p className="text-sm text-muted">No members yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {members.results.map((member) => (
              <li key={member._id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  {member.name || "Unnamed"}{" "}
                  <span className="text-muted">{member.email}</span>
                </span>
                <button
                  type="button"
                  className="text-destructive"
                  onClick={() => void removeMember({ membershipId: member._id })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {members.status === "CanLoadMore" ? (
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => members.loadMore(PAGE_SIZE)}
          >
            Load more
          </Button>
        ) : null}
      </section>

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
              <li key={post.linkId} className="flex items-center justify-between px-4 py-3 text-sm">
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
