import { Link } from "react-router-dom";
import { formatDate } from "@/lib/format";

type PostCardPost = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: number | null;
  updatedAt: number;
  coverImageUrl: string | null;
  tags: string[];
};

export function PostCard({ post }: { post: PostCardPost }) {
  return (
    <article className="border-b border-border py-8 first:pt-0">
      <div className="flex gap-6">
        <div className="min-w-0 flex-1">
          <time className="text-xs uppercase tracking-wide text-muted">
            {formatDate(post.publishedAt ?? post.updatedAt)}
          </time>
          <h2 className="mt-1 font-sans text-2xl font-semibold tracking-tight">
            <Link to={`/posts/${post.slug}`} className="hover:text-accent">
              {post.title || "Untitled"}
            </Link>
          </h2>
          {post.excerpt ? (
            <p className="mt-2 text-[0.95rem] leading-6 text-muted">{post.excerpt}</p>
          ) : null}
          {post.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/tags/${tag}`}
                  className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground hover:bg-border"
                >
                  {tag}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
        {post.coverImageUrl ? (
          <Link to={`/posts/${post.slug}`} className="hidden shrink-0 sm:block">
            <img
              src={post.coverImageUrl}
              alt=""
              className="h-24 w-32 rounded-lg object-cover"
            />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
