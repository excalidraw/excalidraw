import {
  getTerraformImportPresetSourcesFromDb,
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

export const HAS_CLOUDFLARE_PLAN_FIXTURES = hasTerraformBackendFile(
  "cloudflare/cloudflare-plan.json",
);

export const HAS_STAGING_MULTI_STATE_PRESET =
  getTerraformImportPresetSourcesFromDb("staging-multi-state-expanded") != null;

export const HAS_STAGING_CLOUDFLARE_MULTI_IMPORT_FIXTURES =
  HAS_CLOUDFLARE_PLAN_FIXTURES && HAS_STAGING_MULTI_STATE_PRESET;

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

type StagingPlanDotBundle = {
  plan: Record<string, unknown>;
  dotText: string;
  label: string;
};

/** Representative staging stacks for faster AWS+Cloudflare import tests. */
const STAGING_CLOUDFLARE_SMOKE_STACK_IDS = [
  "00-east-network",
  "20-east-messaging",
] as const;

/** Staging multi-state stacks + Cloudflare plan for multi-provider import tests. */
export function loadStagingCloudflareMultiImportFixture(options?: {
  /** `smoke` — two AWS stacks + Cloudflare; `all` — full staging catalog (default). */
  stacks?: "smoke" | "all";
}) {
  const stacks = options?.stacks ?? "all";
  let stagingBundles: StagingPlanDotBundle[] =
    loadStagingMultiStatePlanDotBundlesFromDb();
  if (!stagingBundles.length) {
    throw new Error("staging-multi-state-expanded preset stacks missing");
  }
  if (stacks === "smoke") {
    stagingBundles = stagingBundles.filter((bundle) =>
      (STAGING_CLOUDFLARE_SMOKE_STACK_IDS as readonly string[]).includes(
        bundle.label,
      ),
    );
    if (!stagingBundles.length) {
      throw new Error("staging smoke stacks missing from preset DB");
    }
  }
  return {
    planDotBundles: [
      ...stagingBundles.map((bundle) => ({
        plan: bundle.plan,
        dotText: bundle.dotText,
        label: bundle.label,
      })),
      {
        plan: JSON.parse(
          readTerraformBackendFile("cloudflare/cloudflare-plan.json"),
        ),
        dotText: readTerraformBackendFile("cloudflare/cloudflare-plan.dot"),
        label: "cloudflare",
      },
    ],
    tfd: readStagingMultiStatePipelineTfdFromDb(),
  };
}

export {
  hasTerraformImportRepoFileInDb,
  loadStagingMultiStatePlanDotBundlesFromDb,
  readStagingMultiStatePipelineTfdFromDb,
  readTerraformImportRepoFileText,
};
