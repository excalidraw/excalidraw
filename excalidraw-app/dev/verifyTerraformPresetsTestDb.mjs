/* eslint-disable no-console -- CLI verify script */
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TEST_FIXTURE_DB_PATH,
  verifyTerraformImportPresetTestDb,
} from "./terraformImportPresetDb.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const dbPath = process.env.TERRAFORM_IMPORT_PRESETS_DB
  ? path.isAbsolute(process.env.TERRAFORM_IMPORT_PRESETS_DB)
    ? process.env.TERRAFORM_IMPORT_PRESETS_DB
    : path.resolve(REPO_ROOT, process.env.TERRAFORM_IMPORT_PRESETS_DB)
  : TEST_FIXTURE_DB_PATH;

const { presetCount, withContent } = verifyTerraformImportPresetTestDb(dbPath);
console.log(
  `OK: ${withContent}/${presetCount} terraform import presets have plan+dot content in ${dbPath}`,
);
