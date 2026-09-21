#!/usr/bin/env node
// Create or update a password user for Convex Auth.
// Requires AUTH_PASSWORD_ENABLED to be true (the setup wizard's default).
//
// Usage:
//   npm run create-user
//   npm run create-user -- <email> <password> [name]
//   ADMIN_EMAIL=x ADMIN_PASSWORD=y ADMIN_NAME=z npm run create-user
//   PROD=1 npm run create-user            (target the prod deployment)
//   npm run create-user -- --prod <email> <password> [name]
//
// Creates the users row if missing. With a password, upserts authAccounts
// (provider: password) as an admin. With no password, creates a Google-only
// user (default userType user; pass --admin for admin).

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
  const asAdmin = argv.includes("--admin");
  const positional = argv.filter((arg) => arg !== "--prod" && arg !== "--admin");

  let email = positional[0] || process.env.ADMIN_EMAIL || "";
  let password = positional[1] || process.env.ADMIN_PASSWORD || "";
  let name = positional[2] || process.env.ADMIN_NAME || "";

  if (prod) process.stdout.write("Target: prod deployment\n");

  if (!email) email = await prompt("Email: ");
  if (!email) { process.stderr.write("Error: email is required\n"); process.exit(1); }

  if (!password && !process.env.ADMIN_PASSWORD && positional[1] === undefined) {
    password = await promptSecret("Password (empty for Google-only): ");
  }

  if (!name) name = await prompt(`Name (press enter to use '${email}'): `);

  const args = JSON.stringify({
    email,
    ...(password ? { password } : {}),
    ...(name ? { name } : {}),
    ...(password ? {} : { userType: asAdmin ? "admin" : "user" }),
  });

  try {
    const convexArgs = ["convex", "run", ...(prod ? ["--prod"] : []), "admin:createUser", args];
    execFileSync("npx", convexArgs, {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    process.stdout.write(
      (password
        ? `Password user ready${prod ? " on prod" : ""}: ${email}\n`
        : `Google-only user ready${prod ? " on prod" : ""}: ${email}\n`) +
        `(Use --prod on this command to create the user on production.)\n`,
    );
  } catch {
    process.exit(1);
  }
}

main();
