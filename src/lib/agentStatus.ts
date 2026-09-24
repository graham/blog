import { useEffect, useState } from "react";

export type AgentState = "waiting_for_work" | "working" | "waiting_for_input" | "blocked";

export type AgentStatus = {
  state: AgentState;
  status: string;
  question: string | null;
  updatedAt: number;
};

export const AGENT_STATE_LABELS: Record<AgentState, string> = {
  waiting_for_work: "Waiting for work",
  working: "Working",
  waiting_for_input: "Waiting for input",
  blocked: "Blocked",
};

export const AGENT_STATE_TEXT: Record<AgentState, string> = {
  waiting_for_work: "text-muted",
  working: "text-foreground",
  waiting_for_input: "text-accent",
  blocked: "text-destructive",
};

export const AGENT_STATE_BORDER: Record<AgentState, string> = {
  waiting_for_work: "border-l-border",
  working: "border-l-foreground",
  waiting_for_input: "border-l-accent",
  blocked: "border-l-destructive",
};

// Re-renders on an interval so "updated N minutes ago" labels stay current.
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
