import aggregateTest from "@convex-dev/aggregate/test";

export function registerAggregate(t: Parameters<typeof aggregateTest.register>[0]) {
  aggregateTest.register(t, "publishedByDay");
}
