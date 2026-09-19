import { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Header } from "./Header";
import { BookmarkNav } from "./BookmarkNav";

export function Layout({
  children,
  variant = "page",
  bookmarks = false,
}: {
  children: ReactNode;
  variant?: "page" | "workspace";
  bookmarks?: boolean;
}) {
  const config = useQuery(api.config.getConfig, bookmarks ? {} : "skip");
  const groups = useQuery(
    api.bookmarkGroups.publicQueries.listForViewer,
    bookmarks && config?.bookmarksEnabled === true ? {} : "skip",
  );

  if (variant === "workspace") {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <Header fullWidth />
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    );
  }

  const showNav = groups !== undefined && groups.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-10">
        {showNav ? (
          <div className="flex flex-col gap-10 md:flex-row">
            <aside className="md:w-44 md:shrink-0">
              <BookmarkNav groups={groups} />
            </aside>
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
