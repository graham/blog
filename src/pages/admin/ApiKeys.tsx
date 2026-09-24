import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  agentApiPrompt,
  convexSiteUrl,
  type AgentClient,
  type AgentPlatform,
} from "@/lib/agentApiPrompt";
import { formatDate, formatTimeDelta } from "@/lib/format";

type Revealed = {
  key: {
    _id: Id<"apiKeys">;
    name: string;
  };
  token: string;
};

type AgentStatus = {
  state: "waiting_for_work" | "working" | "waiting_for_input" | "blocked";
  status: string;
  question: string | null;
  updatedAt: number;
};

const siteUrl = convexSiteUrl(import.meta.env.VITE_CONVEX_URL);

const STATE_LABELS: Record<AgentStatus["state"], string> = {
  waiting_for_work: "Waiting for work",
  working: "Working",
  waiting_for_input: "Waiting for input",
  blocked: "Blocked",
};

const STATE_CLASSES: Record<AgentStatus["state"], string> = {
  waiting_for_work: "text-muted",
  working: "text-foreground",
  waiting_for_input: "text-accent",
  blocked: "text-destructive",
};

function AgentStatusCell({ agentStatus, now }: { agentStatus: AgentStatus | null; now: number }) {
  if (!agentStatus) return <span className="text-muted">No reports</span>;
  return (
    <div className="max-w-xs space-y-1">
      <p className={`font-medium ${STATE_CLASSES[agentStatus.state]}`}>
        {STATE_LABELS[agentStatus.state]}
      </p>
      <p className="font-mono text-xs text-muted">
        {agentStatus.status} · {formatTimeDelta(now, agentStatus.updatedAt)} ago
      </p>
      {agentStatus.question ? (
        <p className="whitespace-pre-wrap text-xs">{agentStatus.question}</p>
      ) : null}
    </div>
  );
}

export default function ApiKeys() {
  const keys = useQuery(api.apiKeys.queries.list);
  const createKey = useMutation(api.apiKeys.mutations.create);
  const rotateKey = useMutation(api.apiKeys.mutations.rotate);
  const revealKey = useMutation(api.apiKeys.mutations.reveal);
  const revokeKey = useMutation(api.apiKeys.mutations.revoke);
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [platform, setPlatform] = useState<AgentPlatform>("windows");
  const [client, setClient] = useState<AgentClient>("curl");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const prompt = useMemo(
    () =>
      revealed
        ? agentApiPrompt({
            name: revealed.key.name,
            token: revealed.token,
            baseUrl: siteUrl,
            platform,
            client,
          })
        : "",
    [revealed, platform, client],
  );

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await createKey({ name });
      setRevealed(result);
      setName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create key");
    } finally {
      setBusy(false);
    }
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight">API keys</h1>
          <p className="mt-1 text-sm text-muted">
            Keys can create and update posts, upload images, and publish. Active key prompts can be
            viewed again.
          </p>
        </div>

        <form
          onSubmit={(event) => void onCreate(event)}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end"
        >
          <label className="min-w-0 flex-1 text-sm">
            <span className="mb-1 block font-medium">Key name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Windows writing agent"
              maxLength={100}
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 outline-none ring-ring focus:ring-2"
            />
          </label>
          <Button type="submit" disabled={busy || name.trim().length === 0}>
            {busy ? "Creating…" : "Create key"}
          </Button>
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-border bg-secondary/60 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Prefix</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Agent</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(keys ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-muted">
                    No API keys yet.
                  </td>
                </tr>
              ) : (
                (keys ?? []).map((key) => (
                  <tr key={key._id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{key.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{key.tokenPrefix}…</td>
                    <td className="px-4 py-3 text-muted">{formatDate(key._creationTime)}</td>
                    <td className="px-4 py-3">{key.revokedAt === null ? "Active" : "Revoked"}</td>
                    <td className="px-4 py-3 align-top">
                      <AgentStatusCell agentStatus={key.agentStatus} now={now} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={key.revokedAt !== null || busy}
                          onClick={() => {
                            if (!key.promptAvailable) {
                              setError(
                                "This older key must be rotated once before its prompt can be viewed again.",
                              );
                              return;
                            }
                            setBusy(true);
                            setError(null);
                            void revealKey({ keyId: key._id })
                              .then((result) => setRevealed(result))
                              .catch((caught: unknown) =>
                                setError(
                                  caught instanceof Error ? caught.message : "Could not reveal key",
                                ),
                              )
                              .finally(() => setBusy(false));
                          }}
                        >
                          View prompt
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={key.revokedAt !== null || busy}
                          onClick={() => {
                            if (
                              !window.confirm(
                                "Rotate this key? The current secret will stop working.",
                              )
                            )
                              return;
                            setBusy(true);
                            void rotateKey({ keyId: key._id })
                              .then((result) => setRevealed(result))
                              .catch((caught: unknown) =>
                                setError(
                                  caught instanceof Error ? caught.message : "Could not rotate key",
                                ),
                              )
                              .finally(() => setBusy(false));
                          }}
                        >
                          Rotate
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={key.revokedAt !== null || busy}
                          onClick={() => {
                            if (!window.confirm("Revoke this key? This cannot be undone.")) return;
                            setBusy(true);
                            void revokeKey({ keyId: key._id })
                              .catch((caught: unknown) =>
                                setError(
                                  caught instanceof Error ? caught.message : "Could not revoke key",
                                ),
                              )
                              .finally(() => setBusy(false));
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {revealed ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="API key prompt"
        >
          <div className="mx-auto my-4 max-w-4xl rounded-xl border border-border bg-card p-4 shadow-xl sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Agent setup prompt</h2>
                <p className="mt-1 text-sm text-muted">
                  Copy this whenever you start a new agent session. Treat it like a password.
                </p>
              </div>
              <Button variant="outline" onClick={() => setRevealed(null)}>
                Close
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-4">
              <fieldset>
                <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                  Platform
                </legend>
                <div className="flex gap-1 rounded-lg bg-secondary p-1">
                  {(["windows", "linux"] as const).map((value) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={platform === value ? "default" : "ghost"}
                      onClick={() => setPlatform(value)}
                      className="capitalize"
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                  Client
                </legend>
                <div className="flex gap-1 rounded-lg bg-secondary p-1">
                  {(["curl", "node"] as const).map((value) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={client === value ? "default" : "ghost"}
                      onClick={() => setClient(value)}
                      className="capitalize"
                    >
                      {value === "node" ? "Node.js" : "curl"}
                    </Button>
                  ))}
                </div>
              </fieldset>
            </div>
            <textarea
              readOnly
              value={prompt}
              className="mt-4 h-[55vh] w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-xs leading-relaxed outline-none"
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={() => void copyPrompt()}>{copied ? "Copied" : "Copy prompt"}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </Layout>
  );
}
