import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { calendarMonth, dayKey } from "@/lib/calendar";
import { formatDate } from "@/lib/format";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function HourChart({ posts }: { posts: Array<{ publishedAt: number }> }) {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const post of posts) {
    hours[new Date(post.publishedAt).getHours()] += 1;
  }
  const max = Math.max(1, ...hours);
  const mid = max > 1 ? Math.round(max / 2) : null;
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs text-muted">Posts during the day</p>
      <div className="flex min-w-0 gap-2">
        <div className="flex h-20 w-6 shrink-0 flex-col justify-between py-0.5 text-right text-[10px] text-muted tabular-nums">
          <span>{max}</span>
          {mid !== null ? <span>{mid}</span> : <span />}
          <span>0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex h-20 w-full min-w-0 items-end gap-px rounded-md border border-border bg-card px-1.5 pt-2">
            {hours.map((count, hour) => (
              <div
                key={hour}
                title={`${hour.toString().padStart(2, "0")}:00 · ${count} ${count === 1 ? "post" : "posts"}`}
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
      </div>
    </div>
  );
}

export default function Calendar() {
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
    features?.calendar === true ? range : "skip",
  );

  if (features === undefined) {
    return (
      <Layout bookmarks>
        <p className="text-sm text-muted">Loading...</p>
      </Layout>
    );
  }

  if (!features.calendar) {
    return <Navigate to="/" replace />;
  }

  const byDay = new Map<string, NonNullable<typeof posts>>();
  for (const post of posts ?? []) {
    const key = dayKey(post.publishedAt);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(post);
    else byDay.set(key, [post]);
  }

  const { weeks, monthTotal } = calendarMonth(year, month, posts ?? []);

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
        <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-sans text-3xl font-semibold tracking-tight">Calendar</h1>
          <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-end">
            <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)}>
              Prev
            </Button>
            <p className="min-w-0 flex-1 text-center text-sm text-muted tabular-nums sm:w-44 sm:flex-none">
              {monthLabel(year, month)}
              <span className="mt-0.5 block text-xs">
                {monthTotal} {monthTotal === 1 ? "post" : "posts"}
              </span>
            </p>
            <Button variant="outline" size="sm" onClick={() => shiftMonth(1)}>
              Next
            </Button>
          </div>
        </div>
        <p className="mb-6 text-sm text-muted">
          Days with posts are marked. Each week and the month show totals. Select a day to see those
          posts in a table.
        </p>
        <div className="grid w-full grid-cols-8 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {WEEKDAYS.map((label) => (
            <div
              key={label}
              className="min-w-0 bg-secondary px-1 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted"
            >
              {label}
            </div>
          ))}
          <div className="min-w-0 bg-secondary px-1 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted">
            Wk
          </div>
          {weeks.map((week, weekIndex) => (
            <div key={`week-${weekIndex}`} className="contents">
              {week.days.map((cell, index) => {
                if (cell.day === null) {
                  return (
                    <div key={`empty-${weekIndex}-${index}`} className="h-16 min-w-0 bg-card" />
                  );
                }
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
                        cell.count > 0 ? "bg-secondary text-foreground" : "invisible"
                      }`}
                    >
                      {cell.count || 0}
                    </span>
                  </button>
                );
              })}
              <div
                className="flex h-16 min-w-0 items-center justify-center bg-secondary px-1 py-1.5"
                title={`${week.total} ${week.total === 1 ? "post" : "posts"} this week`}
              >
                <span className="min-w-6 rounded-full bg-card px-1.5 py-0.5 text-center text-[11px] font-medium tabular-nums text-foreground">
                  {week.total}
                </span>
              </div>
            </div>
          ))}
          <div className="col-span-7 flex h-12 min-w-0 items-center bg-secondary px-3 text-xs font-medium uppercase tracking-wide text-muted">
            This month
          </div>
          <div
            className="flex h-12 min-w-0 items-center justify-center bg-secondary px-1"
            title={`${monthTotal} ${monthTotal === 1 ? "post" : "posts"} this month`}
          >
            <span className="min-w-6 rounded-full bg-card px-1.5 py-0.5 text-center text-[11px] font-medium tabular-nums text-foreground">
              {monthTotal}
            </span>
          </div>
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
