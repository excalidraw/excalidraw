/* eslint-disable no-console -- CLI seed script */
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getTerraformImportPresetDb,
  listTerraformImportPresetsFromDb,
  resetTerraformImportPresetDbSingleton,
  seedAllBuiltinsFromCatalog,
} from "./terraformImportPresetDb.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_DB_PATH = path.join(REPO_ROOT, "terraform-import-presets.db");

const dbPath = process.argv[2] ?? DEFAULT_DB_PATH;

resetTerraformImportPresetDbSingleton();
const db = getTerraformImportPresetDb(dbPath);
const { presetCount, results } = seedAllBuiltinsFromCatalog(db);

const missing = results.flatMap((entry) =>
  (entry.missing ?? []).map((filePath) => ({ presetId: entry.id, filePath })),
);

const presets = listTerraformImportPresetsFromDb();
const withContent = presets.filter((preset) => preset.hasContent);

console.log(`Seeded ${presetCount} built-in preset(s) into ${dbPath}`);
console.log(`  ${withContent.length} preset(s) have stored plan+dot content`);

if (missing.length > 0) {
  console.warn("Missing files (not hydrated):");
  for (const entry of missing) {
    console.warn(`  [${entry.presetId}] ${entry.filePath}`);
  }
  process.exitCode = 1;
}
