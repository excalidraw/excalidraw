/* eslint-disable no-console -- CLI hydrate script */
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getTerraformImportPresetDb,
  loadImportPresetsCatalog,
  resetTerraformImportPresetDbSingleton,
  upsertAndHydratePresetFromCatalog,
} from "./terraformImportPresetDb.mjs";
import { formatCompactStats } from "./compactTerraformImportPresetDb.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_DB_PATH = path.join(REPO_ROOT, "terraform-import-presets.db");

const presetId = process.argv[2];
const dbPath = process.argv[3] ?? DEFAULT_DB_PATH;

if (!presetId) {
  console.error(
    "Usage: node excalidraw-app/dev/hydrateTerraformImportPreset.mjs <preset-id> [db-path]",
  );
  process.exit(1);
}

const catalog = loadImportPresetsCatalog();
if (!catalog.some((entry) => entry.id === presetId)) {
  console.error(`Preset id not found in catalog: ${presetId}`);
  process.exit(1);
}

resetTerraformImportPresetDbSingleton();
const db = getTerraformImportPresetDb(dbPath);
const { hydrated, missing, compactStats } =
  upsertAndHydratePresetFromCatalog(db, presetId);

console.log(`Hydrated preset "${presetId}" into ${dbPath}`);
console.log(`  ${hydrated} file(s) loaded from disk`);
if (compactStats) {
  console.log(`  Compact: ${formatCompactStats(compactStats)}`);
}

if (missing.length > 0) {
  console.warn("Missing files (not hydrated):");
  for (const filePath of missing) {
    console.warn(`  ${filePath}`);
  }
  process.exitCode = 1;
}
