import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/format";

export default function SignIn() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const config = useQuery(api.config.getConfig);
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);

  useEffect(() => {
    if (!isAuthenticated || currentUser === undefined) return;
    navigate(isAdminUser(currentUser) ? "/admin" : "/");
  }, [isAuthenticated, currentUser, navigate]);

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
                onClick={() =>
                  void signIn("google", { redirectTo: `${window.location.origin}/signin` })
                }
                variant="outline"
                size="lg"
                className="w-full relative hover:bg-accent"
                type="button"
              >
                <svg
                  className="absolute left-4"
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                >
                  <path
                    d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9.003 18c2.43 0 4.467-.806 5.956-2.184l-2.909-2.258c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z"
                    fill="#34A853"
                  />
                  <path
                    d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z"
                    fill="#EA4335"
                  />
                </svg>
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
                        Or continue with email
                      </span>
                    </div>
                  </div>
                )}

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    void signIn("password", formData);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      required
                      className="w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground placeholder:text-muted-foreground transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground placeholder:text-muted-foreground transition-colors"
                    />
                  </div>

                  <input name="flow" type="hidden" value="signIn" />

                  <Button type="submit" size="lg" className="w-full">
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
