import {
  loadStagingMultiStatePlanDotBundlesFromDb,
  readStagingMultiStatePipelineTfdFromDb,
  readTerraformBackendFile,
} from "../test-fixtures/terraformPresetFixtures";

import type { TerraformPlanParsingSources } from "./terraformPlanParsing";

/** Shared staging-multi-state-expanded sources for layout snapshot / parity tests. */
export function stagingMultiStateLayoutSources(): TerraformPlanParsingSources {
  const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
  const tfd = readStagingMultiStatePipelineTfdFromDb();
  return {
    planDotBundles: bundles,
    states: [],
    stateLabels: [],
    tfdTexts: [tfd],
    tfdLabels: ["pipeline.tfd"],
  };
}

/** Pipeline view uses the same tfd path as golden snapshots (backend file). */
export function stagingMultiStatePipelineLayoutSources(): TerraformPlanParsingSources {
  const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
  const tfd = readTerraformBackendFile("staging-multi-state/pipeline.tfd");
  return {
    planDotBundles: bundles,
    states: [],
    stateLabels: [],
    tfdTexts: [tfd],
    tfdLabels: ["pipeline.tfd"],
  };
}
