import { useAuthActions } from "@convex-dev/auth/react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function SignOut() {
  const { signOut } = useAuthActions();
  const navigate = useNavigate();

  useEffect(() => {
    const performSignOut = async () => {
      await signOut();
      navigate("/");
    };

    void performSignOut();
  }, [signOut, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="animate-pulse text-muted-foreground">Signing out...</div>
          </div>
        </div>
      </div>
    </div>
  );
}
