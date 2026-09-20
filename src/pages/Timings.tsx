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

function HourChart({ posts }: { posts: Array<{ publishedAt: number }> }) {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const post of posts) {
    hours[new Date(post.publishedAt).getHours()] += 1;
  }
  const max = Math.max(1, ...hours);
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs text-muted">Posts during the day</p>
      <div className="flex h-20 w-full min-w-0 items-end gap-px rounded-md border border-border bg-card px-1.5 pt-2">
        {hours.map((count, hour) => (
          <div
            key={hour}
            title={`${hour.toString().padStart(2, "0")}:00 · ${count}`}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            <div
              className="w-full rounded-t-sm bg-accent"
              style={{ height: `${(count / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between px-1.5 text-[10px] text-muted tabular-nums">
        <span>12a</span>
        <span>6a</span>
        <span>12p</span>
        <span>6p</span>
        <span>11p</span>
      </div>
    </div>
  );
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
      <div className="mx-auto w-full min-w-0 max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="font-sans text-3xl font-semibold tracking-tight">Timings</h1>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)}>
              Previous
            </Button>
            <p className="w-40 text-center text-sm text-muted tabular-nums">
              {monthLabel(year, month)}
            </p>
            <Button variant="outline" size="sm" onClick={() => shiftMonth(1)}>
              Next
            </Button>
          </div>
        </div>
        <p className="mb-6 text-sm text-muted">
          Days with posts are marked. Select a day to see those posts in a table.
        </p>
        <div className="grid w-full grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {WEEKDAYS.map((label) => (
            <div
              key={label}
              className="min-w-0 bg-secondary px-1 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted"
            >
              {label}
            </div>
          ))}
          {cells.map((cell, index) => {
            if (cell.day === null) {
              return <div key={`empty-${index}`} className="h-16 min-w-0 bg-card" />;
            }
            const count = cell.key ? (byDay.get(cell.key)?.length ?? 0) : 0;
            const active = cell.key === selectedKey;
            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelectedKey(cell.key)}
                className={`flex h-16 min-w-0 flex-col items-start overflow-hidden px-1.5 py-1.5 text-left ${
                  active ? "bg-secondary ring-2 ring-inset ring-ring" : "bg-card"
                }`}
              >
                <span className="text-xs text-muted tabular-nums">{cell.day}</span>
                <span
                  className={`mt-1 min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-medium tabular-nums ${
                    count > 0 ? "bg-secondary text-foreground" : "invisible"
                  }`}
                >
                  {count || 0}
                </span>
              </button>
            );
          })}
        </div>
        <section className="mt-8 min-w-0">
          <h2 className="mb-3 font-sans text-lg font-semibold">
            {selectedLabel ? selectedLabel : "Select a day"}
          </h2>
          {posts === undefined ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : selectedKey === null ? (
            <p className="text-sm text-muted">Pick a day on the calendar.</p>
          ) : (
            <div className="space-y-4">
              <HourChart posts={selected} />
              {selected.length === 0 ? (
                <p className="text-sm text-muted">No posts on this day.</p>
              ) : (
            <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="border-b border-border bg-secondary/60 text-muted">
                  <tr>
                    <th className="w-24 px-4 py-2 font-medium">Time</th>
                    <th className="px-4 py-2 font-medium">Title</th>
                    <th className="w-40 px-4 py-2 font-medium">Slug</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.map((post) => (
                    <tr key={post.slug} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted tabular-nums">
                        {new Date(post.publishedAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/posts/${post.slug}`}
                          className="block truncate hover:text-accent"
                        >
                          {post.title || "Untitled"}
                        </Link>
                      </td>
                      <td className="truncate px-4 py-3 text-muted">/{post.slug}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              )}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
