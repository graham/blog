import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { isAdminUser } from "@/lib/format";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);

  if (isLoading || (isAuthenticated && currentUser === undefined)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Loading...
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }
  if (!isAdminUser(currentUser)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
