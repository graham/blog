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
            className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-muted hover:text-foreground"
          >
            {group.name}
          </Link>
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
