import { FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useSignInWithPassword } from "@convex-dev/auth/providers/password/react";
import { useSignInWithGoogle } from "@convex-dev/auth/providers/oauth/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";

const MESSAGES: Record<string, string> = {
  accepted: "This invite has already been used. Try signing in instead.",
  revoked: "This invite was revoked. Ask for a new one.",
  expired: "This invite has expired. Ask for a new one.",
  unknown: "We don't recognise this invite link.",
};

export default function Invite() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { signIn } = useSignInWithPassword(api.auth.password.signInWithPassword);
  const { signInGoogle } = useSignInWithGoogle(api.auth);
  const preview = useQuery(api.invites.publicQueries.preview, { token });
  const config = useQuery(api.config.getConfig);
  const accept = useMutation(api.invites.publicMutations.acceptWithPassword);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<"google" | "password" | null>(null);

  const googleOn = config?.googleAuthEnabled === true;
  const passwordOn = config?.passwordAuthEnabled === true;
  const both = googleOn && passwordOn;
  const chosen = both ? method : googleOn ? "google" : passwordOn ? "password" : null;

  async function onAccept(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { email } = await accept({ token, name, password });
      const result = await signIn({ username: email, password });
      if (result.status !== "complete") {
        throw new Error("Could not sign in after accepting the invite");
      }
      navigate("/");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not accept the invite",
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-lg">
        {preview === undefined || config === undefined ? (
          <p className="text-center text-sm text-muted-foreground">Loading...</p>
        ) : preview.status !== "valid" ? (
          <div className="space-y-6 text-center">
            <h1 className="text-2xl font-bold text-foreground">Invite unavailable</h1>
            <p className="text-muted-foreground">{MESSAGES[preview.status]}</p>
            <Button onClick={() => navigate("/signin")} variant="outline" size="lg" className="w-full">
              Go to sign in
            </Button>
          </div>
        ) : !googleOn && !passwordOn ? (
          <div className="space-y-6 text-center">
            <h1 className="text-2xl font-bold text-foreground">Sign-in is off</h1>
            <p className="text-muted-foreground">
              Ask an administrator to enable Google or password sign-in.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="mb-2 text-2xl font-bold text-foreground">
                You're invited
              </h1>
              <p className="text-muted-foreground">
                Access for{" "}
                <span className="font-medium text-foreground">{preview.email}</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {both
                  ? "Choose one way to sign in. You can add the other later."
                  : googleOn
                    ? "Sign in with the Google account for this email."
                    : "Set a password for this email."}
              </p>
            </div>

            {both && chosen === null ? (
              <div className="space-y-3">
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  onClick={() => void signInGoogle()}
                >
                  Continue with Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => setMethod("password")}
                >
                  Use a password
                </Button>
              </div>
            ) : null}

            {chosen === "google" && !both ? (
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={() => void signInGoogle()}
              >
                Continue with Google
              </Button>
            ) : null}

            {chosen === "password" ? (
              <form onSubmit={(event) => void onAccept(event)} className="space-y-4">
                {both ? (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setMethod(null);
                      setError(null);
                    }}
                  >
                    Back to choices
                  </button>
                ) : null}
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-medium text-foreground">
                    Your name
                  </label>
                  <input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={100}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground shadow-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-foreground">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    required
                    placeholder="At least 8 characters"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {busy ? "Signing in..." : "Continue with password"}
                </Button>
              </form>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
