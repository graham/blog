import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// Server-side the gate is enforced in every public query; this only keeps a
// signed-out visitor from staring at an empty blog.
export function SiteGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const config = useQuery(api.config.getConfig);
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);
  const location = useLocation();

  if (isLoading || config === undefined || (isAuthenticated && currentUser === undefined)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Loading...
      </div>
    );
  }

  if (isAuthenticated && currentUser?.disabled === true) {
    return <Navigate to="/limbo" replace />;
  }

  const member =
    currentUser != null &&
    currentUser.disabled !== true &&
    (currentUser.userType === "user" || currentUser.userType === "admin");

  if (config.requireAuth && !member) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
