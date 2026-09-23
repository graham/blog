import { Link, useLocation } from "react-router-dom";

type TagPost = { title: string; slug: string };
type TagGroup = { name: string; slug: string; posts: TagPost[] };

function slugFromPath(pathname: string): string | null {
  const match = /^\/posts\/([^/]+)$/.exec(pathname);
  return match?.[1] ?? null;
}

export function TagNav({ groups }: { groups: TagGroup[] }) {
  const { pathname } = useLocation();
  const currentSlug = slugFromPath(pathname);

  return (
    <nav aria-label="Tags" className="space-y-6">
      {groups.map((group) => (
        <div key={group.slug}>
          <Link
            to={`/tags/${group.name}`}
            className="mb-2 block text-sm font-semibold text-foreground hover:text-foreground/80"
          >
            {group.name}
          </Link>
          <ul className="space-y-1">
            {group.posts.map((post) => {
              const current = currentSlug === post.slug;
              return (
                <li key={post.slug} className="min-w-0">
                  <Link
                    to={`/posts/${post.slug}`}
                    title={post.title || "Untitled"}
                    className={
                      current
                        ? "block truncate text-xs font-medium text-foreground"
                        : "block truncate text-xs text-muted hover:text-foreground"
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
