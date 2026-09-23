import { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Header } from "./Header";
import { BookmarkNav } from "./BookmarkNav";
import { TagNav } from "./TagNav";
import { useFeatureOn, useFeatures } from "./FeaturesProvider";

export function Layout({
  children,
  variant = "page",
  bookmarks = false,
  header = null,
  footer = null,
  wide = false,
}: {
  children: ReactNode;
  variant?: "page" | "workspace";
  bookmarks?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const features = useFeatures();
  const bookmarksOn = useFeatureOn(features.bookmarks);
  const tagsOn = useFeatureOn(features.tagNav);
  const groups = useQuery(
    api.bookmarkGroups.publicQueries.listForViewer,
    bookmarks && bookmarksOn ? {} : "skip",
  );
  const tagGroups = useQuery(
    api.tags.publicQueries.listForViewer,
    bookmarks && tagsOn ? {} : "skip",
  );

  if (variant === "workspace") {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <Header fullWidth />
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    );
  }

  const showBookmarks = groups !== undefined && groups.length > 0;
  const showTags = tagGroups !== undefined && tagGroups.length > 0;
  const showNav = showBookmarks || showTags;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header fullWidth={wide} />
      <main
        className={`mx-auto w-full min-w-0 px-4 py-8 sm:py-10 ${wide ? "max-w-none" : "max-w-5xl"}`}
      >
        <div className="flex min-w-0 flex-col gap-8">
          {header}
          {showNav ? (
            <div className="grid min-w-0 gap-10 md:grid-cols-[11rem_minmax(0,1fr)] md:items-start">
              <div className="min-w-0 md:col-start-2 md:row-start-1">{children}</div>
              <aside className="min-w-0 space-y-10 md:col-start-1 md:row-start-1">
                {showBookmarks ? <BookmarkNav groups={groups ?? []} /> : null}
                {showTags ? <TagNav groups={tagGroups ?? []} /> : null}
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
