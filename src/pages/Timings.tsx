import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function dayKey(ts: number) {
  const date = new Date(ts);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function Timings() {
  const features = useQuery(api.features.publicQueries.get);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const range = useMemo(
    () => ({
      start: new Date(year, month, 1).getTime(),
      end: new Date(year, month + 1, 1).getTime(),
    }),
    [year, month],
  );

  const posts = useQuery(
    api.posts.publicQueries.listPublishedBetween,
    features?.timings.timingsPage === true ? range : "skip",
  );

  if (features === undefined) {
    return (
      <Layout bookmarks>
        <p className="text-sm text-muted">Loading...</p>
      </Layout>
    );
  }

  if (!features.timings.timingsPage) {
    return <Navigate to="/" replace />;
  }

  const byDay = new Map<string, NonNullable<typeof posts>>();
  for (const post of posts ?? []) {
    const key = dayKey(post.publishedAt);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(post);
    else byDay.set(key, [post]);
  }

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number | null; key: string | null }> = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ day: null, key: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, key: `${year}-${month}-${day}` });
  }

  const selected = selectedKey ? (byDay.get(selectedKey) ?? []) : [];
  const selectedLabel = selectedKey
    ? formatDate(new Date(year, month, Number(selectedKey.split("-")[2])).getTime())
    : null;

  function shiftMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedKey(null);
  }

  return (
    <Layout bookmarks>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="font-sans text-3xl font-semibold tracking-tight">Timings</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)}>
              Previous
            </Button>
            <p className="min-w-36 text-center text-sm text-muted">{monthLabel(year, month)}</p>
            <Button variant="outline" size="sm" onClick={() => shiftMonth(1)}>
              Next
            </Button>
          </div>
        </div>
        <p className="mb-6 text-sm text-muted">
          Days with posts are marked. Select a day to see those posts in a table.
        </p>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {WEEKDAYS.map((label) => (
            <div
              key={label}
              className="bg-secondary px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted"
            >
              {label}
            </div>
          ))}
          {cells.map((cell, index) => {
            if (cell.day === null) {
              return <div key={`empty-${index}`} className="min-h-16 bg-card" />;
            }
            const count = cell.key ? (byDay.get(cell.key)?.length ?? 0) : 0;
            const active = cell.key === selectedKey;
            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelectedKey(cell.key)}
                className={`min-h-16 bg-card px-2 py-2 text-left ${
                  active ? "ring-2 ring-inset ring-ring" : ""
                }`}
              >
                <span className="block text-xs text-muted">{cell.day}</span>
                {count > 0 ? (
                  <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <section className="mt-8">
          <h2 className="mb-3 font-sans text-lg font-semibold">
            {selectedLabel ? selectedLabel : "Select a day"}
          </h2>
          {posts === undefined ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : selectedKey === null ? (
            <p className="text-sm text-muted">Pick a day on the calendar.</p>
          ) : selected.length === 0 ? (
            <p className="text-sm text-muted">No posts on this day.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-secondary/60 text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Time</th>
                    <th className="px-4 py-2 font-medium">Title</th>
                    <th className="px-4 py-2 font-medium">Slug</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.map((post) => (
                    <tr key={post.slug} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap text-muted">
                        {new Date(post.publishedAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/posts/${post.slug}`} className="hover:text-accent">
                          {post.title || "Untitled"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">/{post.slug}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
