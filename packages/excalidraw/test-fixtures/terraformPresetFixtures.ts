import {
  hasTerraformImportRepoFileInDb,
  loadStagingMultiStatePlanDotBundlesFromDb,
  readStagingMultiStatePipelineTfdFromDb,
  readTerraformImportRepoFileText,
} from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";

export const TERRAFORM_BACKEND_REPO = "packages/backend/terraform";

/** Read a plan/dot/tfd/tfstate file under `packages/backend/terraform/` from the preset DB. */
export function readTerraformBackendFile(fileName: string): string {
  return readTerraformImportRepoFileText(
    `${TERRAFORM_BACKEND_REPO}/${fileName.replace(/^\/+/, "")}`,
  );
}

export function hasTerraformBackendFile(fileName: string): boolean {
  return hasTerraformImportRepoFileInDb(
    `${TERRAFORM_BACKEND_REPO}/${fileName.replace(/^\/+/, "")}`,
  );
}

/** Legacy monolithic fixtures (gitignored); present locally after hydrate, absent in CI. */
export const HAS_ALLPLANMODULES_FIXTURES = hasTerraformBackendFile(
  "allplanmodules.json",
);
export const HAS_DELPLAN_FIXTURES = hasTerraformBackendFile("delplan.json");
export const HAS_CLOUDFLARE_PLAN_FIXTURES = hasTerraformBackendFile(
  "cloudflare/cloudflare-plan.json",
);
export const HAS_AWS_CLOUDFLARE_MULTI_IMPORT_FIXTURES =
  HAS_ALLPLANMODULES_FIXTURES && HAS_CLOUDFLARE_PLAN_FIXTURES;

const onCi = Boolean(process.env.CI);
const underCoverage = process.env.VITEST_COVERAGE === "1";

/** Sync tests that load/decompress all 25 stacks from the preset DB. */
export const STAGING_DB_LOAD_TEST_TIMEOUT_MS = onCi ? 120_000 : 30_000;

/** Full 25-stack semantic layout (GitHub Actions; slower still under coverage). */
export const STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS = onCi
  ? underCoverage
    ? 600_000
    : 360_000
  : 180_000;

export function loadAwsCloudflareMultiImportFixture() {
  return {
    awsPlan: JSON.parse(readTerraformBackendFile("allplanmodules.json")),
    awsDot: readTerraformBackendFile("allplanmodules.dot"),
    cfPlan: JSON.parse(
      readTerraformBackendFile("cloudflare/cloudflare-plan.json"),
    ),
    cfDot: readTerraformBackendFile("cloudflare/cloudflare-plan.dot"),
    tfd: readTerraformBackendFile("allplanmodules.tfd"),
  };
}

export {
  hasTerraformImportRepoFileInDb,
  loadStagingMultiStatePlanDotBundlesFromDb,
  readStagingMultiStatePipelineTfdFromDb,
  readTerraformImportRepoFileText,
};
