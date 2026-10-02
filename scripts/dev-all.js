#!/usr/bin/env node
// Starts the workspace API (:3100) and the web app (:3002) together, with prefixed output.
//   yarn dev:all
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const yarn = process.platform === "win32" ? "yarn.cmd" : "yarn";

const envFile = path.join(root, "server", ".env");
if (!fs.existsSync(envFile)) {
  console.error(
    "\n  server/.env is missing.\n  Run:  cp server/.env.example server/.env   and set SESSION_SECRET (openssl rand -base64 48)\n",
  );
  process.exit(1);
}

const mongoUri =
  (fs.readFileSync(envFile, "utf8").match(/^MONGODB_URI=(.+)$/m) || [])[1] ||
  "mongodb://127.0.0.1:27017";

const checkMongo = () =>
  new Promise((resolve) => {
    let host = "127.0.0.1";
    let port = 27017;
    try {
      const u = new URL(mongoUri.replace(/^mongodb(\+srv)?:/, "http:"));
      host = u.hostname;
      port = Number(u.port) || 27017;
    } catch {
      /* fall back to the defaults */
    }
    const s = net.connect({ host, port, timeout: 1500 });
    s.on("connect", () => (s.destroy(), resolve(true)));
    s.on("error", () => resolve(false));
    s.on("timeout", () => (s.destroy(), resolve(false)));
  });

const colors = { api: "\x1b[36m", web: "\x1b[35m", reset: "\x1b[0m" };
const children = [];
const run = (name, args) => {
  const child = spawn(yarn, args, { cwd: root, env: process.env });
  const pipe = (stream, out) =>
    stream.on("data", (d) =>
      String(d)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) =>
          out.write(`${colors[name]}[${name}]${colors.reset} ${line}\n`),
        ),
    );
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    console.log(`[${name}] exited with code ${code}`);
    shutdown(code || 0);
  });
  children.push(child);
};

let closing = false;
const shutdown = (code = 0) => {
  if (closing) {
    return;
  }
  closing = true;
  children.forEach((c) => c.kill("SIGTERM"));
  setTimeout(() => process.exit(code), 300);
};
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

(async () => {
  if (!(await checkMongo())) {
    console.error(
      `\n  MongoDB is not reachable (${mongoUri}).\n  Start it first, e.g.  brew services start mongodb-community@7.0   or   docker compose -f docker-compose.workspace.yml up -d mongo\n`,
    );
    process.exit(1);
  }
  run("api", ["--silent", "dev:server"]);
  run("web", ["--silent", "dev:workspace"]);
  console.log(
    "\n  Web app  http://localhost:3002\n  API      http://127.0.0.1:3100\n",
  );
})();
