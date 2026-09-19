import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";

export default function WhoAmI() {
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);
  const { signOut } = useAuthActions();

  if (currentUser === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-foreground mb-2">Not Logged In</h1>
              <p className="text-muted-foreground">You are not currently authenticated</p>
            </div>
            <Link to="/signin">
              <Button size="lg" className="w-full">
                Go to Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Logged In</h1>
            <p className="text-muted-foreground">You are currently authenticated</p>
          </div>

          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <h2 className="text-sm font-medium text-muted-foreground mb-2">User Information</h2>

              {currentUser.image && (
                <div className="flex justify-center mb-4">
                  <img src={currentUser.image} alt="Profile" className="w-20 h-20 rounded-full border-2 border-border" />
                </div>
              )}

              <div className="space-y-2">
                {currentUser.name && (
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm font-medium text-foreground">Name:</span>
                    <span className="text-sm text-muted-foreground">{currentUser.name}</span>
                  </div>
                )}

                {currentUser.email && (
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm font-medium text-foreground">Email:</span>
                    <span className="text-sm text-muted-foreground">{currentUser.email}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-medium text-foreground">User ID:</span>
                  <span className="text-sm text-muted-foreground font-mono text-xs">{currentUser._id}</span>
                </div>
              </div>
            </div>

            <Link to="/">
              <Button variant="outline" size="lg" className="w-full">
                Go to Home
              </Button>
            </Link>

            <Button onClick={() => void signOut()} variant="destructive" size="lg" className="w-full">
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
