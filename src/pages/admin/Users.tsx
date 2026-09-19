import { FormEvent, useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 25;

type RevealedInvite = { email: string; url: string };

function inviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

export default function AdminUsers() {
  const users = usePaginatedQuery(
    api.users.queries.listForAdmin,
    {},
    { initialNumItems: PAGE_SIZE },
  );
  const invites = usePaginatedQuery(
    api.invites.queries.list,
    {},
    { initialNumItems: PAGE_SIZE },
  );
  const createInvite = useMutation(api.invites.mutations.create);
  const revokeInvite = useMutation(api.invites.mutations.revoke);
  const setDisabled = useMutation(api.users.mutations.setDisabled);
  const setUserType = useMutation(api.users.mutations.setUserType);

  const [email, setEmail] = useState("");
  const [asAdmin, setAsAdmin] = useState(false);
  const [revealed, setRevealed] = useState<RevealedInvite | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const result = await createInvite({
        email,
        userType: asAdmin ? "admin" : "user",
      });
      setRevealed({
        email: result.invite.email,
        url: inviteUrl(result.token),
      });
      setEmail("");
      setAsAdmin(false);
      setCopied(false);
    });
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const pendingInvites = invites.results.filter(
    (invite) => invite.status === "pending",
  );

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted">
            Invite links are shown once, here. Send one however you like, then
            disable the account whenever you want the access back.
          </p>
        </div>

        <form
          onSubmit={(event) => void onInvite(event)}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end"
        >
          <label className="min-w-0 flex-1 text-sm">
            <span className="mb-1 block font-medium">Invite by email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="person@example.com"
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={asAdmin}
              onChange={(event) => setAsAdmin(event.target.checked)}
              className="size-4"
            />
            Make admin
          </label>
          <Button type="submit" disabled={busy}>
            Create invite
          </Button>
        </form>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {revealed ? (
          <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
            <p className="text-sm font-medium">
              Invite link for {revealed.email}
            </p>
            <p className="text-sm text-muted">
              Copy it now. It works once, expires in 7 days, and is never shown again.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-background px-3 py-2 text-xs">
                {revealed.url}
              </code>
              <Button
                type="button"
                variant="outline"
                onClick={() => void copyLink(revealed.url)}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRevealed(null)}>
                Done
              </Button>
            </div>
          </div>
        ) : null}

        <section className="space-y-3">
          <h2 className="font-sans text-lg font-semibold tracking-tight">
            Accounts
          </h2>
          {users.status === "LoadingFirstPage" ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-secondary/60 text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Email</th>
                    <th className="px-4 py-2 font-medium">Role</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.results.map((user) => (
                    <tr
                      key={user._id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3">{user.name ?? "-"}</td>
                      <td className="px-4 py-3 text-muted">{user.email ?? "-"}</td>
                      <td className="px-4 py-3">{user.userType}</td>
                      <td className="px-4 py-3">
                        {user.disabledAt === null ? (
                          "Active"
                        ) : (
                          <span className="text-destructive">
                            Disabled {formatDate(user.disabledAt)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await setUserType({
                                  userId: user._id as Id<"users">,
                                  userType:
                                    user.userType === "admin" ? "user" : "admin",
                                });
                              })
                            }
                          >
                            {user.userType === "admin" ? "Remove admin" : "Make admin"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={user.disabledAt === null ? "outline" : "default"}
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await setDisabled({
                                  userId: user._id as Id<"users">,
                                  disabled: user.disabledAt === null,
                                });
                              })
                            }
                          >
                            {user.disabledAt === null ? "Disable" : "Enable"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {users.status === "CanLoadMore" ? (
            <Button variant="outline" onClick={() => users.loadMore(PAGE_SIZE)}>
              Load more
            </Button>
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="font-sans text-lg font-semibold tracking-tight">
            Pending invites
          </h2>
          {pendingInvites.length === 0 ? (
            <p className="text-sm text-muted">No invites waiting to be accepted.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-secondary/60 text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Email</th>
                    <th className="px-4 py-2 font-medium">Role</th>
                    <th className="px-4 py-2 font-medium">Expires</th>
                    <th className="px-4 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvites.map((invite) => (
                    <tr
                      key={invite._id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3">{invite.email}</td>
                      <td className="px-4 py-3">{invite.userType}</td>
                      <td className="px-4 py-3 text-muted">
                        {formatDate(invite.expiresAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await revokeInvite({ inviteId: invite._id });
                            })
                          }
                        >
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {invites.status === "CanLoadMore" ? (
            <Button variant="outline" onClick={() => invites.loadMore(PAGE_SIZE)}>
              Load more
            </Button>
          ) : null}
        </section>
      </div>
    </Layout>
  );
}
