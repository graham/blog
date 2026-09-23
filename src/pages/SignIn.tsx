import { FormEvent, useState } from "react";
import { useQuery, useConvexAuth } from "convex/react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useSignInWithPassword } from "@convex-dev/auth/providers/password/react";
import { useSignInWithGoogle } from "@convex-dev/auth/providers/oauth/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/format";

export default function SignIn() {
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const config = useQuery(api.config.getConfig);
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);
  const { signIn } = useSignInWithPassword(api.auth.password.signInWithPassword);
  const { signInGoogle } = useSignInWithGoogle(api.auth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || currentUser === undefined) return;
    if (currentUser?.userType === "guest") return;
    navigate(isAdminUser(currentUser) ? "/admin" : "/");
  }, [isAuthenticated, currentUser, navigate]);

  async function onPassword(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await signIn({ username, password });
    setPending(false);
    if (result.status !== "complete") {
      setError("Could not sign in with those credentials");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="w-full max-w-md relative z-10">
        <div className="bg-card border border-border rounded-lg shadow-lg p-8 backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome Back</h1>
            <p className="text-muted-foreground">Sign in to your account</p>
          </div>

          <div className="space-y-6">
            {config && !config.googleAuthEnabled && !config.passwordAuthEnabled ? (
              <p className="text-center text-sm text-muted-foreground">
                Sign-in is turned off. Ask an administrator to enable Google or
                password sign-in.
              </p>
            ) : null}
            {config?.googleAuthEnabled && (
              <Button
                onClick={() => void signInGoogle()}
                variant="outline"
                size="lg"
                className="w-full"
                type="button"
              >
                Continue with Google
              </Button>
            )}

            {config?.passwordAuthEnabled && (
              <>
                {config.googleAuthEnabled && (
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        Or continue with username
                      </span>
                    </div>
                  </div>
                )}

                <form onSubmit={(event) => void onPassword(event)} className="space-y-4">
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-foreground mb-2">
                      Username
                    </label>
                    <input
                      id="username"
                      name="username"
                      autoComplete="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      required
                      className="w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      className="w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                    />
                  </div>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  <Button type="submit" size="lg" className="w-full" disabled={pending}>
                    Sign In
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
