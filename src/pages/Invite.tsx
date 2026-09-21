import { FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
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
  const { signIn } = useAuthActions();
  const preview = useQuery(api.invites.publicQueries.preview, { token });
  const config = useQuery(api.config.getConfig);
  const accept = useMutation(api.invites.publicMutations.acceptWithPassword);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAccept(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { email } = await accept({ token, name, password });
      await signIn("password", { email, password, flow: "signIn" });
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
        {preview === undefined ? (
          <p className="text-center text-sm text-muted-foreground">Loading...</p>
        ) : preview.status !== "valid" ? (
          <div className="space-y-6 text-center">
            <h1 className="text-2xl font-bold text-foreground">Invite unavailable</h1>
            <p className="text-muted-foreground">{MESSAGES[preview.status]}</p>
            <Button onClick={() => navigate("/signin")} variant="outline" size="lg" className="w-full">
              Go to sign in
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="mb-2 text-2xl font-bold text-foreground">
                You're invited
              </h1>
              <p className="text-muted-foreground">
                Setting up access for{" "}
                <span className="font-medium text-foreground">{preview.email}</span>
              </p>
            </div>

            {config?.googleAuthEnabled ? (
              <Button
                onClick={() => void signIn("google")}
                variant="outline"
                size="lg"
                className="w-full"
                type="button"
              >
                Continue with Google
              </Button>
            ) : null}

            {config?.googleAuthEnabled && config.passwordAuthEnabled ? (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or set a password
                </span>
              </div>
            </div>
            ) : null}

            {config?.passwordAuthEnabled ? (
            <form onSubmit={(event) => void onAccept(event)} className="space-y-4">
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
                {busy ? "Creating account..." : "Create account"}
              </Button>
            </form>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
