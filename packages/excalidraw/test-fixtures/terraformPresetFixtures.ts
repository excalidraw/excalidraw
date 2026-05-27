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
