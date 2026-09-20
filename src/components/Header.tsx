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
  const calendar = features?.calendar === true;

  useEffect(() => {
    setQ(params.get("q") ?? "");
  }, [params]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const next = q.trim();
    navigate(next ? `/?q=${encodeURIComponent(next)}` : "/");
  }

  const authLink = isAuthenticated ? (
    <button
      type="button"
      onClick={() => void signOut().then(() => navigate("/"))}
      className="text-left text-muted hover:text-foreground"
    >
      Sign out
    </button>
  ) : (
    <Link to="/signin" className="text-muted hover:text-foreground">
      Sign in
    </Link>
  );

  const extraLinks = (
    <>
      {calendar ? (
        <Link to="/calendar" className="text-muted hover:text-foreground">
          Calendar
        </Link>
      ) : null}
      {admin ? (
        <>
          <Link to="/admin" className="text-muted hover:text-foreground">
            Posts
          </Link>
          <Link to="/admin/channels" className="text-muted hover:text-foreground">
            Channels
          </Link>
          {bookmarksEnabled ? (
            <Link to="/admin/bookmarks" className="text-muted hover:text-foreground">
              Bookmarks
            </Link>
          ) : null}
          <Link to="/admin/api-keys" className="text-muted hover:text-foreground">
            API keys
          </Link>
          <Link to="/admin/users" className="text-muted hover:text-foreground">
            Users
          </Link>
          <Link to="/admin/settings" className="text-muted hover:text-foreground">
            Settings
          </Link>
        </>
      ) : null}
    </>
  );

  return (
    <header className="border-b border-border bg-card">
      <div
        className={`mx-auto flex min-h-14 w-full min-w-0 items-center gap-3 px-4 py-2 ${
          fullWidth ? "max-w-none" : "max-w-5xl"
        }`}
      >
        <Link to="/" className="shrink-0 text-sm font-semibold tracking-tight">
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
        <nav className="hidden items-center gap-3 text-sm lg:flex">
          {extraLinks}
          {authLink}
        </nav>
        <details className="relative shrink-0 lg:hidden">
          <summary className="cursor-pointer list-none text-sm text-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
            Menu
          </summary>
          <div className="absolute right-0 z-20 mt-2 flex w-44 flex-col gap-2 rounded-xl border border-border bg-card p-3 text-sm shadow-sm">
            {extraLinks}
            {authLink}
          </div>
        </details>
      </div>
    </header>
  );
}
