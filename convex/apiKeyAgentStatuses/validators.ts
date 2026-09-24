import { v, type Infer } from "convex/values";

export const AGENT_STATES = ["waiting_for_work", "working", "waiting_for_input", "blocked"] as const;

export const agentStateValidator = v.union(
  v.literal("waiting_for_work"),
  v.literal("working"),
  v.literal("waiting_for_input"),
  v.literal("blocked"),
);

export type AgentState = Infer<typeof agentStateValidator>;

export const agentStatusValidator = v.object({
  state: agentStateValidator,
  status: v.string(),
  question: v.union(v.string(), v.null()),
  updatedAt: v.number(),
});

export const AGENT_STATUS_MIN_INTERVAL_MS = 30_000;
export const AGENT_STATUS_MAX_LENGTH = 64;
export const AGENT_QUESTION_MAX_LENGTH = 1000;
export const AGENT_STATUS_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isAgentState(value: unknown): value is AgentState {
  return typeof value === "string" && (AGENT_STATES as readonly string[]).includes(value);
}

export function questionAllowed(state: AgentState): boolean {
  return state === "waiting_for_input" || state === "blocked";
}
