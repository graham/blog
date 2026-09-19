import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

export const aiWorkpool = new Workpool(components.aiWorkpool, {
  maxParallelism: 2,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 3,
    initialBackoffMs: 500,
    base: 2,
  },
});
