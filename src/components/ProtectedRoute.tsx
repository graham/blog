import { useConvexAuth, useQuery } from "convex/react";
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);

  if (isLoading || (isAuthenticated && currentUser === undefined)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }
  if (currentUser === null) {
    return <Navigate to="/limbo" replace />;
  }
  return <>{children}</>;
}
