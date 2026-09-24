import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "backfill posts.createdAt",
  { minutes: 1 },
  internal.migrations.backfillPostsCreatedAt,
  { cursor: null },
);

crons.interval(
  "backfill posts.publishedByDay",
  { minutes: 1 },
  internal.migrations.backfillPublishedByDay,
  { cursor: null },
);

export default crons;
