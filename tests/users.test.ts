import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { createT } from "./helpers";

describe("users", () => {
  test("getCurrentUser returns null when unauthenticated", async () => {
    const t = createT();
    const result = await t.query(api.users.publicQueries.getCurrentUser);
    expect(result).toBeNull();
  });
});
