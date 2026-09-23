import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useSignInWithGoogle } from "@convex-dev/auth/providers/oauth/react";
import { api } from "../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";

function fieldError(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Could not save";
}

export default function Account() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const account = useQuery(api.users.publicQueries.getAccount);
  const currentUser = useQuery(api.users.publicQueries.getCurrentUser);
  const config = useQuery(api.config.getConfig);
  const { signOut } = useAuthActions();
  const { signInGoogle } = useSignInWithGoogle(api.auth);

  if (isLoading || account === undefined || currentUser === undefined) {
    return (
      <Layout>
        <p className="text-sm text-muted">Loading...</p>
      </Layout>
    );
  }

  if (currentUser?.disabled === true) {
    return <Navigate to="/limbo" replace />;
  }

  if (!isAuthenticated || account === null) {
    return <Navigate to="/signin" replace />;
  }

  const googleOn = config?.googleAuthEnabled === true;

  return (
    <Layout>
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight">Account</h1>
          <p className="mt-1 text-sm text-muted">Your profile and sign-in methods.</p>
        </div>

        <section className="rounded-xl border border-border bg-card p-6">
          {account.image ? (
            <div className="mb-4 flex justify-center">
              <img
                src={account.image}
                alt=""
                className="h-20 w-20 rounded-full border-2 border-border"
              />
            </div>
          ) : null}
          <dl className="space-y-2 text-sm">
            <Row label="Email" value={account.email ?? "—"} />
            <Row label="Role" value={account.userType === "admin" ? "Admin" : "Member"} />
            <Row
              label="Auth"
              value={account.authGeneration === "v2" ? "v2" : account.authGeneration === "v1" ? "v1" : "—"}
            />
          </dl>
          <NameForm initial={account.name ?? ""} />
        </section>

        <section id="password" className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-medium">Password</h2>
          {account.methods.password ? (
            <ChangePasswordForm />
          ) : (
            <AddPasswordForm />
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-medium">Passkeys</h2>
          <p className="mt-1 text-sm text-muted">
            No passkeys on this account yet. Passkey sign-in ships with Auth v2.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-medium">Google</h2>
          {account.methods.google ? (
            <UnlinkGoogle
              disabled={!account.methods.password && account.methods.passkeyCount === 0}
            />
          ) : googleOn ? (
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => void signInGoogle()}
              >
                Link Google
              </Button>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted">Google sign-in is turned off.</p>
          )}
        </section>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to="/" className="sm:flex-1">
            <Button variant="outline" className="w-full">
              Home
            </Button>
          </Link>
          <Button
            variant="destructive"
            className="sm:flex-1"
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </div>
      </div>
    </Layout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function NameForm({ initial }: { initial: string }) {
  const updateProfile = useMutation(api.users.publicMutations.updateProfile);
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile({ name });
      setSaved(true);
    } catch (caught) {
      setError(fieldError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mt-4 space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Display name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={100}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="text-sm text-muted">Saved.</p> : null}
      <Button type="submit" size="sm" disabled={busy}>
        Save name
      </Button>
    </form>
  );
}

function ChangePasswordForm() {
  const changePassword = useMutation(api.users.publicMutations.changePassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setSaved(true);
    } catch (caught) {
      setError(fieldError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mt-3 space-y-3">
      <input type="text" name="username" autoComplete="username" hidden readOnly />
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Current password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">New password</span>
        <input
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          minLength={8}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="text-sm text-muted">Password updated.</p> : null}
      <Button type="submit" size="sm" disabled={busy}>
        Change password
      </Button>
    </form>
  );
}

function AddPasswordForm() {
  const addPassword = useMutation(api.users.publicMutations.addPassword);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addPassword({ password });
    } catch (caught) {
      setError(fieldError(caught));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mt-3 space-y-3">
      <p className="text-sm text-muted">This account has no password yet.</p>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">New password</span>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" size="sm" disabled={busy}>
        Set password
      </Button>
    </form>
  );
}

function UnlinkGoogle({ disabled }: { disabled: boolean }) {
  const unlinkGoogle = useMutation(api.users.publicMutations.unlinkGoogle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      await unlinkGoogle({});
    } catch (caught) {
      setError(fieldError(caught));
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm text-muted">Google is linked to this account.</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || disabled}
        onClick={() => void onClick()}
      >
        Unlink Google
      </Button>
      {disabled ? (
        <p className="text-sm text-muted">Add a password before unlinking Google.</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
