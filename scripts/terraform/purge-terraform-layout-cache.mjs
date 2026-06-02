#!/usr/bin/env node
/**
 * Purge all keys in the production layout cache KV namespace.
 * Used on master deploy before re-seeding precomputed layouts.
 *
 * Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 * Usage: node scripts/terraform/purge-terraform-layout-cache.mjs [--preview]
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const usePreview = process.argv.includes("--preview");
const namespaceId = usePreview
  ? "ffdd6e30dd904f1e899e1e3da72f27f4"
  : "f47a2e1592bd4edc8e9a132683dbb534";

let cursor;
let deleted = 0;

do {
  const args = [
    "kv",
    "key",
    "list",
    `--namespace-id=${namespaceId}`,
    "--json",
  ];
  if (cursor) {
    args.push(`--cursor=${cursor}`);
  }

  const list = spawnSync("npx", ["wrangler@4", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: process.env,
  });

  if (list.status !== 0) {
    console.error(list.stderr || list.stdout);
    process.exit(list.status ?? 1);
  }

  const parsed = JSON.parse(list.stdout);
  const keys = parsed.result?.map((row) => row.name) ?? parsed.keys ?? [];

  for (const key of keys) {
    const del = spawnSync(
      "npx",
      [
        "wrangler@4",
        "kv",
        "key",
        "delete",
        key,
        `--namespace-id=${namespaceId}`,
      ],
      { cwd: REPO_ROOT, stdio: "pipe", env: process.env },
    );
    if (del.status !== 0) {
      console.error(`Failed to delete ${key}`, del.stderr?.toString());
      process.exit(del.status ?? 1);
    }
    deleted += 1;
  }

  cursor = parsed.result_info?.cursor;
  if (parsed.list_complete === true || !cursor) {
    cursor = undefined;
  }
} while (cursor);

console.log(
  `Purged ${deleted} key(s) from ${usePreview ? "preview" : "production"} layout cache KV.`,
);
