#!/usr/bin/env node
/**
 * Precompute Terraform layout scenes for builtin presets and write KV bulk JSON.
 *
 * Usage:
 *   LAYOUT_CACHE_VERSION=$(git rev-parse --short HEAD) yarn precompute:terraform-layout-cache
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const version =
  process.env.LAYOUT_CACHE_VERSION?.trim().slice(0, 12) ||
  spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).stdout?.trim();

if (!version) {
  console.error(
    "LAYOUT_CACHE_VERSION or git HEAD is required for layout cache keys.",
  );
  process.exit(2);
}

process.env.TERRAFORM_IMPORT_PRESETS_DB =
  process.env.TERRAFORM_IMPORT_PRESETS_DB ||
  "packages/excalidraw/test-fixtures/terraform-import-presets.db";
process.env.PRECOMPUTE_LAYOUT_CACHE = "1";
process.env.LAYOUT_CACHE_VERSION = version;

const result = spawnSync(
  "yarn",
  [
    "vitest",
    "run",
    "packages/excalidraw/scripts/precomputeTerraformLayoutCache.test.ts",
    "--watch=false",
  ],
  {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: process.env,
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(
  `Wrote functions/generated/terraform-layout-cache-bulk.json (version v${version})`,
);
