import { FormEvent, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { formatDateTime, toDateTimeLocal } from "@/lib/format";

export function PostTimesEditor({
  postId,
  createdAt,
  updatedAt,
  publishedAt,
  draft,
}: {
  postId: Id<"posts">;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
  draft: boolean;
}) {
  const setTimes = useMutation(api.posts.mutations.setTimes);
  const [created, setCreated] = useState(toDateTimeLocal(createdAt));
  const [updated, setUpdated] = useState(toDateTimeLocal(updatedAt));
  const [published, setPublished] = useState(
    publishedAt === null ? "" : toDateTimeLocal(publishedAt),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCreated(toDateTimeLocal(createdAt));
    setUpdated(toDateTimeLocal(updatedAt));
    setPublished(publishedAt === null ? "" : toDateTimeLocal(publishedAt));
  }, [createdAt, updatedAt, publishedAt]);

  const publishedValue = published ? new Date(published).getTime() : null;
  const publishedInFuture =
    publishedValue !== null && Number.isFinite(publishedValue) && publishedValue > Date.now();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextCreated = new Date(created).getTime();
    const nextUpdated = new Date(updated).getTime();
    if (
      !Number.isFinite(nextCreated) ||
      !Number.isFinite(nextUpdated) ||
      (publishedValue !== null && !Number.isFinite(publishedValue))
    ) {
      setError("Enter valid dates");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await setTimes({
        postId,
        createdAt: nextCreated,
        updatedAt: nextUpdated,
        publishedAt: publishedValue,
      });
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save times");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-2">
      <h2 className="text-sm font-medium">Dates</h2>
      <DateField label="Created" value={created} onChange={setCreated} />
      <DateField label="Updated" value={updated} onChange={setUpdated} />
      <DateField label="Published" value={published} onChange={setPublished} />
      {publishedInFuture && publishedValue !== null ? (
        <p className="rounded-md border border-destructive bg-destructive/10 p-2 text-xs">
          The published date is in the future.{" "}
          {draft
            ? `When this post is published it will stay hidden until ${formatDateTime(publishedValue)}.`
            : `This post will be hidden from readers until ${formatDateTime(publishedValue)}.`}{" "}
          You can still see it through the admin preview link.
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          Save dates
        </Button>
        {saved ? <span className="text-xs text-muted">Saved.</span> : null}
      </div>
    </form>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <div className="mt-1 flex gap-1">
        <input
          type="datetime-local"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(toDateTimeLocal(Date.now()))}
        >
          Now
        </Button>
      </div>
    </label>
  );
}
