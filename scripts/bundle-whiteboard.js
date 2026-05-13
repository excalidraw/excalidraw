#!/usr/bin/env node
/**
 * Build the static Excalidraw whiteboard (excalidraw-app) and pack excalidraw-app/build
 * into a .tar.gz under releases/. Requires `tar` on PATH.
 *
 * Usage:
 *   node scripts/bundle-whiteboard.js
 *   node scripts/bundle-whiteboard.js --profile=full
 *   node scripts/bundle-whiteboard.js --skip-build
 *   node scripts/bundle-whiteboard.js --out=dist/bundles --name=my-board
 */

const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..");
const BUILD_DIR = path.join(REPO_ROOT, "excalidraw-app", "build");
const APP_PKG = path.join(REPO_ROOT, "excalidraw-app", "package.json");

const printHelp = () => {
  console.info(`bundle-whiteboard — pack excalidraw-app/build into a release archive

Arguments:
  --help                 Show this message
  --skip-build           Skip yarn build; archive existing excalidraw-app/build only
  --profile=pages        (default) yarn build:pages — lean static bundle (CI-style)
  --profile=full         yarn build:app && yarn build:version — production-style Vite bundle + version stamp
  --out=<dir>            Output directory (default: releases, relative to repo root)
  --name=<basename>      Archive name prefix (default: tfdraw-whiteboard)

Requires: tar on PATH. Node 22+ and yarn install as for the rest of the repo.
`);
};

const getShortCommitHash = () => {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
};

const parseArgs = () => {
  let skipBuild = false;
  let profile = "pages";
  let outDir = "releases";
  let name = "tfdraw-whiteboard";

  for (const arg of process.argv.slice(2)) {
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--skip-build") {
      skipBuild = true;
      continue;
    }
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (!m) {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
    const [, key, value] = m;
    switch (key) {
      case "profile":
        if (value !== "pages" && value !== "full") {
          console.error(`--profile must be "pages" or "full", got "${value}"`);
          process.exit(1);
        }
        profile = value;
        break;
      case "out":
        outDir = value;
        break;
      case "name":
        name = value.replace(/[/\\]/g, "-").replace(/\s+/g, "-") || "bundle";
        break;
      default:
        console.error(`Unknown option: --${key}`);
        printHelp();
        process.exit(1);
    }
  }

  return { skipBuild, profile, outDir, name };
};

const main = () => {
  const { skipBuild, profile, outDir, name } = parseArgs();

  if (!skipBuild) {
    const cmd =
      profile === "full"
        ? "yarn build:app && yarn build:version"
        : "yarn build:pages";
    console.info(`Running ${cmd} …`);
    execSync(cmd, { cwd: REPO_ROOT, stdio: "inherit" });
  }

  if (!fs.existsSync(BUILD_DIR)) {
    console.error(`Missing build output: ${BUILD_DIR}`);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(BUILD_DIR, "index.html"))) {
    console.error(`Build directory exists but has no index.html: ${BUILD_DIR}`);
    process.exit(1);
  }

  const appVersion = require(APP_PKG).version || "0.0.0";
  const hash = getShortCommitHash();
  const outAbs = path.isAbsolute(outDir)
    ? outDir
    : path.join(REPO_ROOT, outDir);
  fs.mkdirSync(outAbs, { recursive: true });

  const fileName = `${name}-${appVersion}-${hash}.tar.gz`;
  const archivePath = path.join(outAbs, fileName);

  console.info(`Creating ${archivePath} …`);
  execFileSync(
    "tar",
    ["-czf", archivePath, "-C", BUILD_DIR, "."],
    { stdio: "inherit", cwd: REPO_ROOT },
  );

  console.info(`Done: ${archivePath}`);
};

main();
