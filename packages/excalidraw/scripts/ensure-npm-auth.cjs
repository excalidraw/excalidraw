/* Ensures npmjs auth is valid before `npm publish`.
   If token is expired/revoked, performs `npm login --auth-type=web`.
   Cross-platform (Windows/macOS/Linux). */

const { spawnSync } = require("node:child_process");

const REGISTRY = "https://registry.npmjs.org/";

function runCapture(cmd, args) {
  const res = spawnSync(cmd, args, {
    encoding: "utf8",
    shell: process.platform === "win32", // makes npm resolve as npm.cmd on Windows
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    code: res.status ?? 1,
    out: (res.stdout || "").trim(),
    err: (res.stderr || "").trim(),
  };
}

function runInherit(cmd, args) {
  const res = spawnSync(cmd, args, {
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  return res.status ?? 1;
}

function whoami() {
  return runCapture("npm", ["whoami", "--registry", REGISTRY]);
}

let who = whoami();
if (who.code === 0 && who.out) {
  process.stdout.write(`npm auth OK: ${who.out}\n`);
  process.exit(0);
}

process.stdout.write("npm auth missing/expired. Starting web login...\n");
const loginCode = runInherit("npm", ["login", "--auth-type=web", "--registry", REGISTRY]);
if (loginCode !== 0) process.exit(loginCode);

who = whoami();
if (who.code !== 0 || !who.out) {
  process.stderr.write("Login finished but npm is still not authenticated.\n");
  if (who.err) process.stderr.write(who.err + "\n");
  process.exit(1);
}

process.stdout.write(`npm auth OK: ${who.out}\n`);
process.exit(0);