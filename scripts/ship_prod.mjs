import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export function assertSafeProdShipEnv(env) {
  if (env.CONVEX_DEPLOY_KEY) {
    throw new Error(
      "CONVEX_DEPLOY_KEY is set. ship:prod:yolo would deploy to that key's deployment instead of default production. Unset it and rerun.",
    );
  }
}

export function deployMessageFromArgv(argv, fallback) {
  const index = argv.indexOf("--message");
  if (index === -1) return fallback;
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error("--message requires a value");
  }
  return value;
}

export function prodShipCommands(message) {
  return [
    ["npx", ["convex", "deploy", "--yes", "--message", message]],
    [
      "npx",
      ["@convex-dev/static-hosting", "upload", "--build", "--prod", "--spa"],
    ],
  ];
}

function gitSubject() {
  const result = spawnSync("git", ["log", "-1", "--format=%s"], {
    encoding: "utf8",
  });
  const subject = (result.stdout ?? "").trim();
  return subject.length > 0 ? subject : "ship:prod:yolo";
}

function run(bin, args) {
  const result = spawnSync(bin, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  assertSafeProdShipEnv(process.env);
  const message = deployMessageFromArgv(process.argv.slice(2), gitSubject());
  process.stdout.write(
    "target: production (project default production; convex deploy ignores CONVEX_DEPLOYMENT in .env.local)\n",
  );
  process.stdout.write(`deploy message: ${message}\n`);
  for (const [bin, args] of prodShipCommands(message)) {
    run(bin, args);
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
