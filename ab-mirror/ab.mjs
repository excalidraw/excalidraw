#!/usr/bin/env node
// A/B mirror CLI. See README.md.
//
//   yarn ab <ref|dir>              <ref> vs master (its merge base with origin/master)
//   yarn ab <ref|dir> <ref|dir>    left vs right
//
// A ref is anything git resolves to a commit (sha, branch, tag, origin/…);
// unknown refs are fetched from origin. Each commit's packages/ is extracted
// once into a cache, so no worktree or branch is needed. A dir is a checkout
// used live (uncommitted changes and HMR included), e.g. `yarn ab .`.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, "..");
/** commit snapshots, one dir per sha (gitignored) */
const CACHE = path.join(HARNESS, ".cache");
const MASTER = "origin/master";

const USAGE = `usage:
  yarn ab <ref|dir>              compare against master (merge base with ${MASTER})
  yarn ab <ref|dir> <ref|dir>    compare left vs right
  yarn ab --clean                delete the commit snapshots (${path.relative(
    REPO,
    CACHE,
  )}/)

  <ref>  sha, branch, tag, origin/… (fetched from origin when not found locally)
  <dir>  a checkout, used live with uncommitted changes (e.g. ".")

options:
  -p, --port <n>   port to try first (default 3091, next free one otherwise)

PR head: yarn ab $(gh pr view <number> --json headRefOid -q .headRefOid)`;

const fail = (message) => {
  console.error(`ab: ${message}`);
  process.exit(1);
};

// sh + tar for snapshots, posix paths when matching Vite ids, dir symlinks
if (process.platform === "win32") {
  fail("Windows isn't supported, run it from WSL");
}

const git = (args, { cwd = REPO, allowFail = false } = {}) => {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 256 * 1024 * 1024,
    }).trim();
  } catch (error) {
    if (allowFail) {
      return null;
    }
    fail(
      `git ${args.join(" ")} failed: ${
        error.stderr?.toString().trim() || error.message
      }`,
    );
  }
};

// -----------------------------------------------------------------------------
// args
// -----------------------------------------------------------------------------

let port;
const positional = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "-h" || arg === "--help") {
    console.log(USAGE);
    process.exit(0);
  } else if (arg === "-p" || arg === "--port") {
    port = Number(argv[++i]);
  } else if (arg.startsWith("--port=")) {
    port = Number(arg.slice("--port=".length));
  } else if (arg === "--clean") {
    fs.rmSync(CACHE, { recursive: true, force: true });
    console.log(`ab: removed ${CACHE}`);
    process.exit(0);
  } else if (arg.startsWith("-")) {
    fail(`unknown option ${arg}\n\n${USAGE}`);
  } else {
    positional.push(arg);
  }
}
if (positional.length < 1 || positional.length > 2) {
  fail(`expected one or two refs\n\n${USAGE}`);
}
if (port !== undefined && !Number.isInteger(port)) {
  fail("--port needs a number");
}

// -----------------------------------------------------------------------------
// trees
// -----------------------------------------------------------------------------

let nodeModules;
try {
  nodeModules = fs.realpathSync(path.join(REPO, "node_modules"));
} catch {
  fail(`no node_modules in ${REPO} — run yarn install first`);
}
/** the checkout whose node_modules every tree uses */
const installRoot = path.dirname(nodeModules);
const installedLock = fs
  .readFileSync(path.join(installRoot, "yarn.lock"), "utf8")
  .trim();

/** directories are resolved against where `yarn ab` was run from */
const asDir = (arg) => {
  const dir = path.resolve(process.env.INIT_CWD ?? process.cwd(), arg);
  return fs.existsSync(path.join(dir, "packages", "excalidraw", "index.tsx"))
    ? dir
    : null;
};

const resolveCommit = (ref) => {
  const verify = (rev) =>
    git(["rev-parse", "--verify", "--quiet", `${rev}^{commit}`], {
      allowFail: true,
    });
  let sha = verify(ref);
  if (!sha) {
    console.log(`ab: "${ref}" isn't known locally, fetching it from origin…`);
    if (git(["fetch", "-q", "origin", ref], { allowFail: true }) !== null) {
      sha = verify("FETCH_HEAD");
    }
  }
  return sha || fail(`can't resolve "${ref}" to a commit`);
};

/** `replace: false` leaves anything already there alone (live checkouts) */
const ensureLink = (target, linkPath, replace) => {
  let exists = false;
  let current = null;
  try {
    exists = !!fs.lstatSync(linkPath);
    current = fs.readlinkSync(linkPath);
  } catch {
    // missing, or not a link
  }
  if (current === target || (exists && !replace)) {
    return;
  }
  fs.rmSync(linkPath, { force: true });
  fs.symlinkSync(target, linkPath, "dir");
};

/** bare imports in a tree resolve into the installed node_modules */
const linkNodeModules = (root, { replace }) => {
  ensureLink(nodeModules, path.join(root, "node_modules"), replace);
  for (const pkg of fs.readdirSync(path.join(root, "packages"))) {
    const src = path.join(installRoot, "packages", pkg, "node_modules");
    const pkgDir = path.join(root, "packages", pkg);
    if (fs.existsSync(src) && fs.statSync(pkgDir).isDirectory()) {
      ensureLink(src, path.join(pkgDir, "node_modules"), replace);
    }
  }
};

/** extracts the commit's packages/ into the cache (once per commit) */
const snapshot = (sha) => {
  const root = path.join(CACHE, sha);
  if (!fs.existsSync(path.join(root, ".complete"))) {
    const tmp = `${root}.tmp-${process.pid}`;
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    const gitArchive = spawnSync(
      "git",
      ["-C", REPO, "archive", "--format=tar", sha, "packages"],
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    if (gitArchive.status !== 0 || !gitArchive.stdout) {
      fail(`failed to archive packages for ${sha}`);
    }
    const tarExtract = spawnSync("tar", ["-x", "-C", tmp], {
      input: gitArchive.stdout,
      stdio: ["pipe", "ignore", "inherit"],
    });
    if (tarExtract.status !== 0) {
      fail(`failed to extract snapshot for ${sha}`);
    }
    fs.writeFileSync(path.join(tmp, ".complete"), "");
    fs.rmSync(root, { recursive: true, force: true });
    fs.renameSync(tmp, root);
  }
  linkNodeModules(root, { replace: true });
  return root;
};

const lockWarning = (lock) =>
  lock !== null && lock.trim() !== installedLock
    ? `yarn.lock differs from the installed node_modules (${installRoot}), so its dependency changes aren't in effect`
    : "";

const makeTree = (side, arg, label = arg) => {
  const dir = asDir(arg);
  if (dir) {
    // a checkout with its own install keeps using it (React aside, which the
    // harness dedupes); one without (or sharing ours) gets the missing links
    const ownModules = path.join(dir, "node_modules");
    const sharesInstall =
      !fs.existsSync(ownModules) || fs.realpathSync(ownModules) === nodeModules;
    if (sharesInstall) {
      linkNodeModules(dir, { replace: false });
    }
    const sha = git(["rev-parse", "HEAD"], { cwd: dir });
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: dir });
    let lock = null;
    try {
      lock = fs.readFileSync(path.join(dir, "yarn.lock"), "utf8");
    } catch {
      // no lockfile
    }
    return {
      side,
      kind: "dir",
      root: dir,
      label: `${path.basename(dir)}${branch !== "HEAD" ? ` (${branch})` : ""}`,
      sha,
      subject: git(["log", "-1", "--format=%s", sha], { cwd: dir }),
      dirty:
        git(
          ["status", "--porcelain", "--untracked-files=no", "--", "packages"],
          { cwd: dir },
        ).length > 0,
      warning: sharesInstall ? lockWarning(lock) : "",
    };
  }
  const sha = resolveCommit(arg);
  return {
    side,
    kind: "commit",
    root: snapshot(sha),
    label,
    sha,
    subject: git(["log", "-1", "--format=%s", sha]),
    dirty: false,
    warning: lockWarning(
      git(["show", `${sha}:yarn.lock`], { allowFail: true }),
    ),
  };
};

const left = makeTree("left", positional[0]);
let right;
if (positional[1]) {
  right = makeTree("right", positional[1]);
} else {
  if (git(["fetch", "-q", "origin", "master"], { allowFail: true }) === null) {
    console.warn(`ab: couldn't fetch master, using the local ${MASTER}`);
  }
  const cwd = left.kind === "dir" ? left.root : REPO;
  const base = git(["merge-base", left.sha, MASTER], { cwd });
  right = makeTree("right", base, "master (merge base)");
  if (base === left.sha && !left.dirty) {
    console.warn(
      `ab: ${positional[0]} is already on master — both panes run the same code`,
    );
  }
}

// -----------------------------------------------------------------------------
// server
// -----------------------------------------------------------------------------

process.env.AB_TREES = JSON.stringify({ left, right });

const { createServer } = await import("vite");
const server = await createServer({
  configFile: path.join(HARNESS, "vite.config.mts"),
  ...(port ? { server: { port } } : {}),
});
await server.listen();

const describe = (tree) =>
  `${tree.label} @ ${tree.sha.slice(0, 9)}${
    tree.dirty ? " +uncommitted" : ""
  } — ${tree.subject}` +
  `\n         ${tree.kind === "dir" ? "live" : "snapshot"}: ${tree.root}` +
  (tree.warning ? `\n         ⚠ ${tree.warning}` : "");
console.log(`\n  left : ${describe(left)}\n  right: ${describe(right)}`);
server.printUrls();
