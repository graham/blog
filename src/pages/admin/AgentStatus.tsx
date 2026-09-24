import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Layout } from "@/components/Layout";
import { formatTimeDelta } from "@/lib/format";
import {
  AGENT_STATE_BORDER,
  AGENT_STATE_LABELS,
  AGENT_STATE_TEXT,
  useNow,
  type AgentState,
  type AgentStatus as AgentStatusValue,
} from "@/lib/agentStatus";

// Agents that need the operator come first, idle and silent agents last.
const STATE_ORDER: Record<AgentState, number> = {
  waiting_for_input: 0,
  blocked: 1,
  working: 2,
  waiting_for_work: 3,
};

function sortRank(agentStatus: AgentStatusValue | null): number {
  return agentStatus ? STATE_ORDER[agentStatus.state] : 4;
}

export default function AgentStatus() {
  const keys = useQuery(api.apiKeys.queries.list);
  const now = useNow();
  const active = (keys ?? [])
    .filter((key) => key.revokedAt === null)
    .sort(
      (a, b) =>
        sortRank(a.agentStatus) - sortRank(b.agentStatus) ||
        (b.agentStatus?.updatedAt ?? 0) - (a.agentStatus?.updatedAt ?? 0),
    );

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <Link to="/admin/api-keys" className="text-sm text-muted hover:text-foreground">
            API keys
          </Link>
          <h1 className="mt-1 font-sans text-2xl font-semibold tracking-tight">Agent status</h1>
        </div>

        {keys === undefined ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : active.length === 0 ? (
          <p className="text-sm text-muted">No active API keys.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((key) => {
              const agentStatus = key.agentStatus;
              return (
                <section
                  key={key._id}
                  className={`min-w-0 rounded-xl border border-l-4 border-border bg-card p-5 ${
                    agentStatus ? AGENT_STATE_BORDER[agentStatus.state] : ""
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="truncate font-medium">{key.name}</h2>
                    <span className="shrink-0 font-mono text-xs text-muted">
                      {key.tokenPrefix}…
                    </span>
                  </div>
                  {agentStatus ? (
                    <>
                      <p
                        className={`mt-4 text-2xl font-semibold tracking-tight ${
                          AGENT_STATE_TEXT[agentStatus.state]
                        }`}
                      >
                        {AGENT_STATE_LABELS[agentStatus.state]}
                      </p>
                      <p className="mt-2 break-words font-mono text-lg">{agentStatus.status}</p>
                      {agentStatus.question ? (
                        <p className="mt-4 whitespace-pre-wrap rounded-md bg-secondary p-3 text-sm">
                          {agentStatus.question}
                        </p>
                      ) : null}
                      <p className="mt-4 text-xs text-muted">
                        Updated {formatTimeDelta(now, agentStatus.updatedAt)} ago
                      </p>
                    </>
                  ) : (
                    <p className="mt-4 text-sm text-muted">No reports yet.</p>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
