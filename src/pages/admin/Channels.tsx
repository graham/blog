import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;

export default function AdminChannels() {
  const navigate = useNavigate();
  const create = useMutation(api.channels.mutations.create);
  const list = usePaginatedQuery(
    api.channels.queries.list,
    {},
    { initialNumItems: PAGE_SIZE },
  );
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const id = await create({ name });
      setName("");
      navigate(`/admin/channels/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create channel");
    }
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-semibold tracking-tight">
          Channels
        </h1>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Posts with no channel stay public. Posts assigned to a channel only appear
        in the timeline for members of that channel. Members never see channel names.
      </p>
      <form onSubmit={(event) => void onCreate(event)} className="mb-6 flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Channel name, e.g. parents"
          className="h-10 w-full max-w-sm rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" disabled={name.trim().length === 0}>
          Create
        </Button>
      </form>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      {list.status === "LoadingFirstPage" ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : list.results.length === 0 ? (
        <p className="text-sm text-muted">No channels yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-secondary/60 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Slug</th>
              </tr>
            </thead>
            <tbody>
              {list.results.map((channel) => (
                <tr
                  key={channel._id}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/40"
                  onClick={() => navigate(`/admin/channels/${channel._id}`)}
                >
                  <td className="px-4 py-3">{channel.name}</td>
                  <td className="px-4 py-3 text-muted">{channel.slug}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.status === "CanLoadMore" ? (
        <div className="pt-4">
          <Button variant="outline" onClick={() => list.loadMore(PAGE_SIZE)}>
            Load more
          </Button>
        </div>
      ) : null}
    </Layout>
  );
}
