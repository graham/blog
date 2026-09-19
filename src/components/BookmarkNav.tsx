import { Link, useLocation } from "react-router-dom";

type BookmarkPost = { title: string; slug: string };
type BookmarkGroup = {
  _id: string;
  name: string;
  slug: string;
  posts: BookmarkPost[];
};

function slugFromPath(pathname: string): string | null {
  const match = /^\/posts\/([^/]+)$/.exec(pathname);
  return match?.[1] ?? null;
}

export function BookmarkNav({ groups }: { groups: BookmarkGroup[] }) {
  const { pathname } = useLocation();
  const currentSlug = slugFromPath(pathname);

  return (
    <nav aria-label="Bookmarks" className="space-y-6">
      {groups.map((group) => (
        <div key={group._id}>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
            {group.name}
          </p>
          <ul className="space-y-1.5">
            {group.posts.map((post) => {
              const current = currentSlug === post.slug;
              return (
                <li key={post.slug}>
                  <Link
                    to={`/posts/${post.slug}`}
                    className={
                      current
                        ? "text-sm font-medium text-foreground"
                        : "text-sm text-muted hover:text-foreground"
                    }
                  >
                    {post.title || "Untitled"}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
