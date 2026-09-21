import { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Header } from "./Header";
import { BookmarkNav } from "./BookmarkNav";
import { useFeatures } from "./FeaturesProvider";
import { useImagesOnly } from "@/lib/useImagesOnly";

export function Layout({
  children,
  variant = "page",
  bookmarks = false,
  header = null,
  footer = null,
}: {
  children: ReactNode;
  variant?: "page" | "workspace";
  bookmarks?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  const features = useFeatures();
  const imagesOnly = useImagesOnly();
  const groups = useQuery(
    api.bookmarkGroups.publicQueries.listForViewer,
    bookmarks && features.bookmarks && !imagesOnly ? {} : "skip",
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
      <main className="mx-auto w-full min-w-0 max-w-5xl px-4 py-8 sm:py-10">
        <div className="flex min-w-0 flex-col gap-8">
          {header}
          {showNav ? (
            <div className="grid min-w-0 gap-10 md:grid-cols-[11rem_minmax(0,1fr)] md:items-start">
              <div className="min-w-0 md:col-start-2 md:row-start-1">{children}</div>
              <aside className="min-w-0 md:col-start-1 md:row-start-1">
                <BookmarkNav groups={groups} />
              </aside>
            </div>
          ) : (
            <div className="min-w-0">{children}</div>
          )}
          {footer}
        </div>
      </main>
    </div>
  );
}
