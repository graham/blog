import { describe, expect, it } from "vitest";
import {
  assertSafeProdShipEnv,
  deployMessageFromArgv,
  prodShipCommands,
} from "../scripts/ship_prod.mjs";

describe("ship:prod:yolo", () => {
  it("refuses to run when CONVEX_DEPLOY_KEY would steal the target", () => {
    expect(() =>
      assertSafeProdShipEnv({ CONVEX_DEPLOY_KEY: "prod:something" }),
    ).toThrow(/CONVEX_DEPLOY_KEY/);
  });

  it("allows a normal local env", () => {
    expect(() =>
      assertSafeProdShipEnv({ CONVEX_DEPLOYMENT: "dev:peaceful-magpie-541" }),
    ).not.toThrow();
  });

  it("deploys functions non-interactively, then builds and uploads the prod SPA", () => {
    const commands = prodShipCommands("Auth v2");
    expect(commands[0]).toEqual([
      "npx",
      ["convex", "deploy", "--yes", "--message", "Auth v2"],
    ]);
    expect(commands[1]).toEqual([
      "npx",
      ["@convex-dev/static-hosting", "upload", "--build", "--prod", "--spa"],
    ]);
  });

  it("reads --message from argv", () => {
    expect(deployMessageFromArgv(["--message", "cutover"], "fallback")).toBe(
      "cutover",
    );
    expect(deployMessageFromArgv([], "fallback")).toBe("fallback");
    expect(() => deployMessageFromArgv(["--message"], "fallback")).toThrow(
      /requires a value/,
    );
  });
});
