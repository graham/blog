import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";

export default function AdminSettings() {
  const config = useQuery(api.config.getConfig);
  const setRequireAuth = useMutation(api.siteSettings.mutations.setRequireAuth);
  const setBookmarksEnabled = useMutation(
    api.siteSettings.mutations.setBookmarksEnabled,
  );
  const [busy, setBusy] = useState<"auth" | "bookmarks" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleRequireAuth(next: boolean) {
    setBusy("auth");
    setError(null);
    try {
      await setRequireAuth({ requireAuth: next });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save the setting",
      );
    } finally {
      setBusy(null);
    }
  }

  async function toggleBookmarks(next: boolean) {
    setBusy("bookmarks");
    setError(null);
    try {
      await setBookmarksEnabled({ bookmarksEnabled: next });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save the setting",
      );
    } finally {
      setBusy(null);
    }
  }

  const requireAuth = config?.requireAuth ?? false;
  const bookmarksEnabled = config?.bookmarksEnabled ?? false;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight">
            Settings
          </h1>
          <p className="mt-1 text-sm text-muted">
            Site-wide switches. These apply to every reader.
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <h2 className="font-medium">Require sign-in to read</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              While this is on, nothing is readable without an account: the
              timeline, individual posts, tag pages, and search all come back
              empty for signed-out visitors, who land on the sign-in page. API
              keys are unaffected, and channel rules still apply on top.
            </p>
          </div>

          {config === undefined ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : (
            <div className="flex items-center gap-4">
              <span
                className={`text-sm font-medium ${
                  requireAuth ? "text-destructive" : "text-muted"
                }`}
              >
                {requireAuth ? "Private: sign-in required" : "Public: anyone can read"}
              </span>
              <Button
                type="button"
                variant={requireAuth ? "outline" : "default"}
                disabled={busy !== null}
                onClick={() => void toggleRequireAuth(!requireAuth)}
              >
                {requireAuth ? "Make site public" : "Require sign-in"}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <h2 className="font-medium">Bookmarks</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              While this is on, administrators can group posts into bookmark
              lists. Those lists appear on the left of reader pages for anyone
              who can already open the posts.
            </p>
          </div>

          {config === undefined ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : (
            <div className="flex items-center gap-4">
              <span
                className={`text-sm font-medium ${
                  bookmarksEnabled ? "text-foreground" : "text-muted"
                }`}
              >
                {bookmarksEnabled ? "On: bookmark lists visible" : "Off: hidden"}
              </span>
              <Button
                type="button"
                variant={bookmarksEnabled ? "outline" : "default"}
                disabled={busy !== null}
                onClick={() => void toggleBookmarks(!bookmarksEnabled)}
              >
                {bookmarksEnabled ? "Turn bookmarks off" : "Turn bookmarks on"}
              </Button>
            </div>
          )}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </Layout>
  );
}
