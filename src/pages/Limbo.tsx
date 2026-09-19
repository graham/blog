import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";

export default function Limbo() {
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);
  const disabled = currentUser?.disabled === true;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {disabled ? "Account Disabled" : "Access Pending"}
            </h1>
            <p className="text-muted-foreground">
              {disabled
                ? "An administrator has disabled this account. Contact them if you believe this is an error."
                : "Your account is authenticated but does not have access to this application. Contact an administrator if you believe this is an error."}
            </p>
          </div>
          <Button onClick={() => void signOut()} variant="outline" size="lg" className="w-full">
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
