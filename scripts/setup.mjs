#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { stdin, stdout } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

export function parseEnvFile(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*([^#]*?)(?:\s+#.*)?$/);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

export function deriveSiteUrl(values) {
  if (values.VITE_CONVEX_SITE_URL) {
    return values.VITE_CONVEX_SITE_URL.replace(/\/$/, "");
  }
  const cloud = values.VITE_CONVEX_URL;
  if (!cloud) return "";
  try {
    const url = new URL(cloud);
    if (!url.hostname.endsWith(".convex.cloud")) return "";
    url.hostname = `${url.hostname.slice(0, -".convex.cloud".length)}.convex.site`;
    return url.origin;
  } catch {
    return "";
  }
}

export function mergeEmailList(current, email) {
  const emails = (current ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!emails.includes(email.toLowerCase())) emails.push(email.toLowerCase());
  return emails.join(",");
}

function run(command, args, options = {}) {
  if (options.dryRun) {
    stdout.write(`  would run: ${command} ${args.join(" ")}\n`);
    return { status: 0, stdout: "" };
  }
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    input: options.input,
    stdio: options.capture
      ? [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"]
      : [options.input === undefined ? "inherit" : "pipe", "inherit", "inherit"],
    env: options.env ?? process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    if (options.capture && result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result;
}

async function ask(question, defaultValue = "") {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  rl.close();
  return answer || defaultValue;
}

async function confirm(question, defaultYes = true) {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(`${question} [${defaultYes ? "Y/n" : "y/N"}]: `))
    .trim()
    .toLowerCase();
  rl.close();
  if (!answer) return defaultYes;
  if (answer === "y" || answer === "yes") return true;
  if (answer === "n" || answer === "no") return false;
  return defaultYes;
}

async function chooseAuth() {
  stdout.write("\nChoose how administrators sign in:\n");
  stdout.write("  1. Email and password (easiest)\n");
  stdout.write("  2. Google\n");
  stdout.write("  3. Both\n");
  while (true) {
    const answer = await ask("Choice", "1");
    if (["1", "2", "3"].includes(answer)) {
      return {
        password: answer === "1" || answer === "3",
        google: answer === "2" || answer === "3",
      };
    }
    stdout.write("Please enter 1, 2, or 3.\n");
  }
}

async function askSecret(question) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    return await ask(question);
  }
  stdout.write(`${question}: `);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return await new Promise((resolveSecret, reject) => {
    let value = "";
    function finish(error) {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolveSecret(value);
    }
    function onData(chunk) {
      for (const character of chunk) {
        if (character === "\u0003") return finish(new Error("Setup cancelled"));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
        } else if (character >= " ") {
          value += character;
          stdout.write("*");
        }
      }
    }
    stdin.on("data", onData);
  });
}

function targetArgs(production) {
  return production ? ["--prod"] : [];
}

function getDeploymentEnv(name, production) {
  const result = run(npx, ["convex", "env", "get", name, ...targetArgs(production)], {
    capture: true,
    allowFailure: true,
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function setDeploymentEnv(name, value, production, dryRun) {
  stdout.write(`  setting ${name}\n`);
  run(npx, ["convex", "env", "set", name, ...targetArgs(production)], {
    input: `${value}\n`,
    dryRun,
  });
}

async function generateAuthKeys() {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const privatePem = (await exportPKCS8(privateKey)).trimEnd().replace(/\n/g, " ");
  const publicJwk = await exportJWK(publicKey);
  return {
    JWT_PRIVATE_KEY: privatePem,
    JWKS: JSON.stringify({ keys: [{ use: "sig", ...publicJwk }] }),
  };
}

function validateSiteUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.origin;
    if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) {
      return url.origin;
    }
  } catch {
    // Handled below.
  }
  throw new Error("Site URL must be HTTPS (or HTTP on localhost)");
}

async function main() {
  const production = process.argv.includes("--prod");
  const dryRun = process.argv.includes("--dry-run");
  const envPath = resolve(projectRoot, ".env.local");

  stdout.write("\nBlog setup wizard\n");
  stdout.write("=================\n");
  stdout.write(`Target: ${production ? "production" : "personal development"}\n`);
  if (dryRun) stdout.write("Dry run: no deployment or files will be changed.\n");

  if (!existsSync(resolve(projectRoot, "node_modules"))) {
    throw new Error("Run npm install before npm run setup");
  }

  if (!existsSync(envPath)) {
    stdout.write("\nFirst, sign in to Convex and create or select a project.\n");
    run(npx, ["convex", "dev", "--once"], { dryRun });
  } else if (!production) {
    stdout.write("\nChecking the selected Convex development deployment...\n");
    run(npx, ["convex", "dev", "--once"], { dryRun });
  }

  const localEnv = existsSync(envPath) ? parseEnvFile(readFileSync(envPath, "utf8")) : {};
  const defaultSiteUrl = production ? "" : deriveSiteUrl(localEnv);
  if (production) {
    stdout.write(
      "\nEnter the public production origin shown by Convex (the .convex.site URL or your custom domain).\n",
    );
  }
  const siteUrl = validateSiteUrl(await ask("Public site URL", defaultSiteUrl));
  const callbackUrl = `${siteUrl}/api/auth/callback/google`;
  const auth = await chooseAuth();

  let email = "";
  while (!email.includes("@")) {
    email = (await ask("Administrator email")).toLowerCase();
    if (!email.includes("@")) stdout.write("Enter a valid email address.\n");
  }
  const name = auth.password ? await ask("Administrator name", email.split("@")[0]) : "";

  let password = "";
  if (auth.password) {
    while (password.length < 8) {
      password = await askSecret("Administrator password (at least 8 characters)");
      if (password.length < 8) stdout.write("Password must be at least 8 characters.\n");
    }
    const confirmation = await askSecret("Repeat password");
    if (confirmation !== password) throw new Error("Passwords do not match");
  }

  let googleId = "";
  let googleSecret = "";
  if (auth.google) {
    stdout.write("\nGoogle OAuth setup\n");
    stdout.write("  Overview: https://console.cloud.google.com/auth/overview\n");
    stdout.write("  OAuth clients: https://console.cloud.google.com/auth/clients\n");
    stdout.write(`  Authorized JavaScript origin: ${siteUrl}\n`);
    stdout.write(`  Authorized redirect URI: ${callbackUrl}\n\n`);
    googleId = await ask("Google client ID");
    googleSecret = await askSecret("Google client secret");
    if (!googleId || !googleSecret) throw new Error("Google client ID and secret are required");
  }

  const hasPrivateKey = Boolean(getDeploymentEnv("JWT_PRIVATE_KEY", production));
  const hasJwks = Boolean(getDeploymentEnv("JWKS", production));
  const hasApiKeyEncryptionKey = Boolean(getDeploymentEnv("API_KEY_ENCRYPTION_KEY", production));
  let keys = null;
  if (!hasPrivateKey || !hasJwks) {
    stdout.write("\nGenerating fresh RS256 JWT signing keys...\n");
    keys = await generateAuthKeys();
  } else if (await confirm("JWT keys already exist. Rotate them? This signs everyone out", false)) {
    keys = await generateAuthKeys();
  }

  stdout.write("\nConfiguring the Convex deployment...\n");
  if (keys) {
    setDeploymentEnv("JWT_PRIVATE_KEY", keys.JWT_PRIVATE_KEY, production, dryRun);
    setDeploymentEnv("JWKS", keys.JWKS, production, dryRun);
  }
  if (!hasApiKeyEncryptionKey) {
    setDeploymentEnv(
      "API_KEY_ENCRYPTION_KEY",
      randomBytes(32).toString("base64"),
      production,
      dryRun,
    );
  }
  setDeploymentEnv("SITE_URL", siteUrl, production, dryRun);
  setDeploymentEnv("AUTH_PASSWORD_ENABLED", String(auth.password), production, dryRun);
  setDeploymentEnv("AUTH_GOOGLE_ENABLED", String(auth.google), production, dryRun);
  if (auth.google) {
    setDeploymentEnv("AUTH_GOOGLE_ID", googleId, production, dryRun);
    setDeploymentEnv("AUTH_GOOGLE_SECRET", googleSecret, production, dryRun);
  }
  const admins = mergeEmailList(getDeploymentEnv("ADMIN_USERS", production), email);
  const allowed = mergeEmailList(getDeploymentEnv("ALLOW_USERS", production), email);
  setDeploymentEnv("ADMIN_USERS", admins, production, dryRun);
  setDeploymentEnv("ALLOW_USERS", allowed, production, dryRun);

  stdout.write("\nDeploying the backend...\n");
  run(npx, production ? ["convex", "deploy", "--yes"] : ["convex", "dev", "--once"], { dryRun });

  if (auth.password) {
    stdout.write("\nCreating the password administrator...\n");
    run(process.execPath, ["scripts/create_user.cjs", ...(production ? ["--prod"] : [])], {
      dryRun,
      env: {
        ...process.env,
        ADMIN_EMAIL: email,
        ADMIN_PASSWORD: password,
        ADMIN_NAME: name,
      },
    });
  }

  if (await confirm("Build and publish the web app now?", true)) {
    stdout.write("\nBuilding and uploading the site...\n");
    run(
      npx,
      [
        "@convex-dev/static-hosting",
        "upload",
        "--build",
        ...(production ? ["--prod"] : []),
        "--spa",
      ],
      { dryRun },
    );
  }

  stdout.write("\nSetup complete.\n");
  stdout.write(`  Site: ${siteUrl}\n`);
  stdout.write(`  Sign in: ${siteUrl}/signin\n`);
  if (auth.google) stdout.write(`  Google callback: ${callbackUrl}\n`);
  stdout.write(
    "  Next: sign in, write a post, then open Admin → API keys to connect an AI agent.\n\n",
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(
      `\nSetup failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
