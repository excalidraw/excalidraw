/* eslint-disable no-console -- CLI export script */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  compactTerraformImportPresetDb,
  formatCompactStats,
} from "./compactTerraformImportPresetDb.mjs";
import {
  TEST_FIXTURE_DB_PATH,
  TEST_FIXTURE_DB_RELATIVE_PATH,
  verifyTerraformImportPresetTestDb,
} from "./terraformImportPresetDb.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const sourcePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(REPO_ROOT, "terraform-import-presets.db");

if (!fs.existsSync(sourcePath)) {
  console.error(
    `Source DB not found: ${sourcePath}\nRun yarn seed:terraform-presets first.`,
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(TEST_FIXTURE_DB_PATH), { recursive: true });
fs.copyFileSync(sourcePath, TEST_FIXTURE_DB_PATH);

for (const suffix of ["-wal", "-shm"]) {
  const sidecar = `${TEST_FIXTURE_DB_PATH}${suffix}`;
  if (fs.existsSync(sidecar)) {
    fs.unlinkSync(sidecar);
  }
}

const compactStats = compactTerraformImportPresetDb(TEST_FIXTURE_DB_PATH);

const { presetCount, withContent } =
  verifyTerraformImportPresetTestDb(TEST_FIXTURE_DB_PATH);

console.log(
  `Exported ${withContent}/${presetCount} hydrated preset(s) to ${TEST_FIXTURE_DB_RELATIVE_PATH}`,
);
console.log(`  Compact: ${formatCompactStats(compactStats)}`);
