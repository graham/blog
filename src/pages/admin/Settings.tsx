import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";

export default function AdminSettings() {
  const config = useQuery(api.config.getConfig);
  const setRequireAuth = useMutation(api.siteSettings.mutations.setRequireAuth);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await setRequireAuth({ requireAuth: next });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save the setting",
      );
    } finally {
      setBusy(false);
    }
  }

  const requireAuth = config?.requireAuth ?? false;

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
                disabled={busy}
                onClick={() => void toggle(!requireAuth)}
              >
                {requireAuth ? "Make site public" : "Require sign-in"}
              </Button>
            </div>
          )}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </Layout>
  );
}
