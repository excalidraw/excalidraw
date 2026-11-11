#!/usr/bin/env node

/**
 * Posts a performance run — a commit's build and the commit before's, measured
 * side by side (`perf.mjs --compare --base <commit> --out perf.json`) — or a
 * build's bundle stats (`yarn stats:bundle` →
 * `excalidraw-app/build/bundle-stats.json`) to the Excalidraw+ api, which
 * stores it for the admin's Performance and Bundle size pages. Needs
 * `OSS_STATS_TOKEN`; the commit is `--commit`, `GITHUB_SHA` or HEAD, read from
 * this repo, and the admin orders the runs by its time (the merge's).
 *
 *   node scripts/stats/post.mjs perf perf.json
 *   node scripts/stats/post.mjs bundle excalidraw-app/build/bundle-stats.json
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { parseArgs } from "node:util";

const {
  positionals: [kind, file],
  values: args,
} = parseArgs({
  allowPositionals: true,
  options: {
    commit: { type: "string" },
    api: {
      type: "string",
      default:
        process.env.OSS_STATS_API_URL || "https://backend.excalidraw.com",
    },
  },
});

/** The api's `OSS_STATS_TOKEN_HEADER`. */
const TOKEN_HEADER = "x-oss-stats-token";

if (!["perf", "bundle"].includes(kind) || !file) {
  console.error(
    "Usage: post.mjs <perf|bundle> <file.json> [--commit <sha>] [--api <url>]",
  );
  process.exit(1);
}

const token = process.env.OSS_STATS_TOKEN;
if (!token) {
  console.error("OSS_STATS_TOKEN is not set");
  process.exit(1);
}

const git = (...gitArgs) =>
  execFileSync("git", gitArgs, { encoding: "utf8" }).trim();

const commitSha = git(
  "rev-parse",
  args.commit || process.env.GITHUB_SHA || "HEAD",
);
const commit = {
  commitSha,
  commitTitle: git("log", "-1", "--format=%s", commitSha),
  committedAt: git("log", "-1", "--format=%cI", commitSha),
  runUrl: process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null,
};
const data = JSON.parse(fs.readFileSync(file, "utf8"));
if (kind === "perf") {
  // the admin only compares a commit with the commit before, measured alongside it
  if (!data.base?.commitSha) {
    console.error(
      "A perf run needs the commit before's build: perf.mjs --compare --base <commit>",
    );
    process.exit(1);
  }
  data.base.commitSha = git("rev-parse", data.base.commitSha);
}
const body = { ...commit, ...data };

const response = await fetch(`${args.api}/api/oss/${kind}-runs`, {
  method: "POST",
  headers: { "content-type": "application/json", [TOKEN_HEADER]: token },
  body: JSON.stringify(body),
});

if (!response.ok) {
  console.error(
    `${response.status} ${response.statusText}: ${await response.text()}`,
  );
  process.exit(1);
}

const { id } = await response.json();
console.info(`Stored the ${kind} run of ${commitSha.slice(0, 7)} as ${id}`);
