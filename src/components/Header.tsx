import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { isAdminUser } from "@/lib/format";

export function Header({ fullWidth = false }: { fullWidth?: boolean }) {
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const admin = isAdminUser(currentUser);
  const features = useQuery(api.features.publicQueries.get);
  const bookmarksEnabled = features?.bookmarks === true;
  const timingsPage = features?.timings.timingsPage === true;

  useEffect(() => {
    setQ(params.get("q") ?? "");
  }, [params]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const next = q.trim();
    navigate(next ? `/?q=${encodeURIComponent(next)}` : "/");
  }

  return (
    <header className="border-b border-border bg-card">
      <div
        className={`mx-auto flex h-14 items-center gap-4 px-4 ${
          fullWidth ? "max-w-none" : "max-w-5xl"
        }`}
      >
        <Link to="/" className="text-sm font-semibold tracking-tight">
          Blog
        </Link>
        <form onSubmit={onSearch} className="min-w-0 flex-1">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search posts"
            className="h-8 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring placeholder:text-muted focus:ring-2"
          />
        </form>
        <nav className="flex items-center gap-3 text-sm">
          {timingsPage ? (
            <Link to="/timings" className="text-muted hover:text-foreground">
              Timings
            </Link>
          ) : null}
          {admin ? (
            <>
              <Link to="/admin" className="text-muted hover:text-foreground">
                Posts
              </Link>
              <Link
                to="/admin/channels"
                className="text-muted hover:text-foreground"
              >
                Channels
              </Link>
              {bookmarksEnabled ? (
                <Link
                  to="/admin/bookmarks"
                  className="text-muted hover:text-foreground"
                >
                  Bookmarks
                </Link>
              ) : null}
              <Link
                to="/admin/api-keys"
                className="text-muted hover:text-foreground"
              >
                API keys
              </Link>
              <Link
                to="/admin/users"
                className="text-muted hover:text-foreground"
              >
                Users
              </Link>
              <Link
                to="/admin/settings"
                className="text-muted hover:text-foreground"
              >
                Settings
              </Link>
            </>
          ) : null}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => void signOut().then(() => navigate("/"))}
              className="text-muted hover:text-foreground"
            >
              Sign out
            </button>
          ) : (
            <Link to="/signin" className="text-muted hover:text-foreground">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
