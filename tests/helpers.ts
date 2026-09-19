import { convexTest } from "convex-test";
import schema from "../convex/schema";

export function createT() {
  return convexTest(schema);
}
