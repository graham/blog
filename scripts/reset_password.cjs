#!/usr/bin/env node
// Reset an existing user's password. Internal Convex action only.
// The new password is never taken from argv or the environment so it does
// not land in shell history.
//
// Usage:
//   npm run reset-password
//   npm run reset-password -- user@example.com
//   npm run reset-password -- --prod user@example.com
//
// Direct Convex CLI (password will appear in process list):
//   npx convex run admin:resetPassword '{"email":"...","password":"..."}'
//   npx convex run --prod admin:resetPassword '{"email":"...","password":"..."}'

const { execFileSync } = require("child_process");
const readline = require("readline");

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptSecret(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let first = true;
    rl._writeToOutput = (str) => {
      if (first) {
        first = false;
        process.stdout.write(str);
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const prod = process.env.PROD === "1" || argv.includes("--prod");
  const positional = argv.filter((arg) => arg !== "--prod");

  let email = positional[0] || "";

  if (prod) process.stdout.write("Target: prod deployment\n");

  if (!email) email = await prompt("Email: ");
  if (!email) {
    process.stderr.write("Error: email is required\n");
    process.exit(1);
  }

  const password = await promptSecret("New password: ");
  if (!password) {
    process.stderr.write("Error: password is required\n");
    process.exit(1);
  }
  const confirm = await promptSecret("Confirm password: ");
  if (password !== confirm) {
    process.stderr.write("Error: passwords do not match\n");
    process.exit(1);
  }

  const args = JSON.stringify({ email, password });

  try {
    const convexArgs = [
      "convex",
      "run",
      ...(prod ? ["--prod"] : []),
      "admin:resetPassword",
      args,
    ];
    execFileSync("npx", convexArgs, {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    process.stdout.write(
      `Password reset${prod ? " on prod" : ""}: ${email}\n` +
        `Existing sessions were revoked. Sign in again with the new password.\n`,
    );
  } catch {
    process.exit(1);
  }
}

main();
