import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, toDateTimeLocal } from "@/lib/format";
import { planSchedule, shuffled, type SchedulePlanItem } from "@/lib/schedule";

const PAGE_SIZE = 100;
const MAX_BATCH = 100;
const GAP_PRESETS: Array<[number, number]> = [
  [15, 20],
  [30, 60],
  [60, 120],
];

type Draft = { _id: Id<"posts">; title: string; slug: string; createdAt: number };

function defaultStart(): string {
  const minute = 60_000;
  return toDateTimeLocal(Math.ceil((Date.now() + 15 * minute) / minute) * minute);
}

const inputClass =
  "h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

export default function ScheduleDrafts() {
  const list = usePaginatedQuery(api.posts.queries.listDrafts, {}, { initialNumItems: PAGE_SIZE });
  const scheduleDrafts = useMutation(api.posts.mutations.scheduleDrafts);
  const [selected, setSelected] = useState<Set<Id<"posts">>>(new Set());
  const [start, setStart] = useState(defaultStart);
  const [minGap, setMinGap] = useState("15");
  const [maxGap, setMaxGap] = useState("20");
  const [shuffle, setShuffle] = useState(false);
  const [plan, setPlan] = useState<Array<SchedulePlanItem<Draft>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const drafts: Draft[] = list.results;
  const selectedDrafts = drafts.filter((draft) => selected.has(draft._id));
  const allSelected = drafts.length > 0 && selectedDrafts.length === drafts.length;

  // Any change to the inputs invalidates a previous dry run.
  function edit<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPlan(null);
      setNotice(null);
    };
  }

  function toggle(postId: Id<"posts">) {
    edit(setSelected)(
      new Set(
        selected.has(postId)
          ? [...selected].filter((id) => id !== postId)
          : [...selected, postId],
      ),
    );
  }

  function toggleAll() {
    edit(setSelected)(allSelected ? new Set() : new Set(drafts.map((draft) => draft._id)));
  }

  function onDryRun() {
    setError(null);
    setNotice(null);
    const startAt = new Date(start).getTime();
    const min = Number(minGap);
    const max = Number(maxGap);
    if (selectedDrafts.length === 0) return setError("Select at least one draft");
    if (selectedDrafts.length > MAX_BATCH) return setError(`Select at most ${MAX_BATCH} drafts`);
    if (!Number.isFinite(startAt)) return setError("Enter a valid start time");
    if (startAt <= Date.now()) return setError("The start time must be in the future");
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) {
      return setError("Enter a gap range like 15 to 20 minutes");
    }
    // Drafts are listed newest first, so publish from the bottom up: the
    // oldest selected draft goes out first and the feed keeps this order.
    const ordered = shuffle ? shuffled(selectedDrafts) : [...selectedDrafts].reverse();
    setPlan(planSchedule(ordered, startAt, min, max));
  }

  async function onCommit() {
    if (!plan) return;
    if (plan[0].publishAt <= Date.now()) {
      setPlan(null);
      setError("The start time has passed; pick a new one and dry run again");
      return;
    }
    const last = plan[plan.length - 1].publishAt;
    const range = `${formatDateTime(plan[0].publishAt)} to ${formatDateTime(last)}`;
    if (!window.confirm(`Schedule ${plan.length} posts from ${range}?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await scheduleDrafts({
        items: plan.map((entry) => ({ postId: entry.item._id, publishAt: entry.publishAt })),
      });
      setNotice(`Scheduled ${plan.length} posts from ${range}.`);
      setPlan(null);
      setSelected(new Set());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not schedule drafts");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-sans text-2xl font-semibold tracking-tight">Schedule drafts</h1>
        <Button asChild variant="outline">
          <Link to="/admin/drafts">Drafts</Link>
        </Button>
      </div>

      <div className="mb-6 space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">First post publishes at</span>
            <input
              type="datetime-local"
              value={start}
              onChange={(event) => edit(setStart)(event.target.value)}
              className={inputClass}
            />
          </label>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Minutes between posts</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={minGap}
                onChange={(event) => edit(setMinGap)(event.target.value)}
                className={`${inputClass} w-20`}
                aria-label="Minimum minutes between posts"
              />
              <span className="text-muted">to</span>
              <input
                type="number"
                min={1}
                value={maxGap}
                onChange={(event) => edit(setMaxGap)(event.target.value)}
                className={`${inputClass} w-20`}
                aria-label="Maximum minutes between posts"
              />
              {GAP_PRESETS.map(([min, max]) => (
                <Button
                  key={`${min}-${max}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    edit(setMinGap)(String(min));
                    setMaxGap(String(max));
                  }}
                >
                  {min}-{max}
                </Button>
              ))}
            </div>
          </div>
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={shuffle}
              onChange={(event) => edit(setShuffle)(event.target.checked)}
            />
            Shuffle order
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={onDryRun} disabled={busy}>
            {plan ? "Dry run again" : "Dry run"}
          </Button>
          <Button type="button" onClick={() => void onCommit()} disabled={!plan || busy}>
            {busy ? "Scheduling..." : `Schedule ${plan?.length ?? selectedDrafts.length} posts`}
          </Button>
          <span className="text-sm text-muted">
            {selectedDrafts.length} selected ·{" "}
            {shuffle ? "random order" : "oldest first, so the feed keeps the order below"}
          </span>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {notice ? <p className="text-sm text-accent">{notice}</p> : null}
      </div>

      {plan ? (
        <section className="mb-8">
          <h2 className="mb-3 font-sans text-lg font-semibold">Dry run</h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">#</th>
                  <th className="px-4 py-2 font-medium">Post</th>
                  <th className="px-4 py-2 font-medium">Publishes at</th>
                  <th className="px-4 py-2 text-right font-medium">Gap</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((entry, index) => (
                  <tr key={entry.item._id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-mono tabular-nums text-muted">{index + 1}</td>
                    <td className="px-4 py-2 font-medium">{entry.item.title || "Untitled"}</td>
                    <td className="px-4 py-2">{formatDateTime(entry.publishAt)}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-muted">
                      {entry.gapMinutes === null ? "" : `+${entry.gapMinutes.toFixed(1)} min`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="w-10 px-4 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all drafts"
                  />
                </th>
                <th className="px-4 py-2 font-medium">Draft</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {list.status === "LoadingFirstPage" ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-muted">
                    Loading...
                  </td>
                </tr>
              ) : drafts.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-muted">
                    No drafts.
                  </td>
                </tr>
              ) : (
                drafts.map((draft) => (
                  <tr key={draft._id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(draft._id)}
                        onChange={() => toggle(draft._id)}
                        aria-label={`Select ${draft.title || "Untitled"}`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Link to={`/admin/preview/${draft.slug}`} className="font-medium hover:text-accent">
                        {draft.title || "Untitled"}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted">{formatDate(draft.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {list.status === "CanLoadMore" ? (
          <div className="pt-3">
            <Button variant="outline" size="sm" onClick={() => list.loadMore(PAGE_SIZE)}>
              Load more
            </Button>
          </div>
        ) : null}
      </section>
    </Layout>
  );
}
