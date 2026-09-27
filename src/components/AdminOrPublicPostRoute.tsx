import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { isAdminUser } from "@/lib/format";

type Props = {
  children: ReactNode;
} & ({ slug: string; postId?: undefined } | { postId: Id<"posts">; slug?: undefined });

// Guards a per-post admin page (the draft editor or the admin preview).
// Admins always see the page. Anyone else who can already view that post at
// its public URL (it's published and visible to them) is sent there instead
// of being bounced to the home page, since the post isn't secret to them.
export function AdminOrPublicPostRoute({ children, slug, postId }: Props) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);
  const authLoaded = !isLoading && (!isAuthenticated || currentUser !== undefined);
  const isAdmin = isAdminUser(currentUser);

  const bySlug = useQuery(
    api.posts.publicQueries.getBySlug,
    authLoaded && !isAdmin && slug !== undefined ? { slug } : "skip",
  );
  const byId = useQuery(
    api.posts.publicQueries.getPublicSlugById,
    authLoaded && !isAdmin && postId !== undefined ? { postId } : "skip",
  );

  if (!authLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Loading...
      </div>
    );
  }
  if (isAdmin) {
    return <>{children}</>;
  }

  const publicSlug = slug !== undefined ? (bySlug === undefined ? undefined : (bySlug?.slug ?? null)) : byId;
  if (publicSlug === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Loading...
      </div>
    );
  }
  if (publicSlug !== null) {
    return <Navigate to={`/posts/${publicSlug}`} replace />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }
  return <Navigate to="/" replace />;
}
