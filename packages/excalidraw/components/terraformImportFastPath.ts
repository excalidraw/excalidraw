import type {
  TerraformLayoutOptions,
  TerraformPlanParsingSources,
} from "./terraformPlanParsing";

export const STAGING_MULTI_STATE_EXPANDED_PRESET_ID =
  "staging-multi-state-expanded";

function isStagingFastPathFlagEnabled(): boolean {
  return import.meta.env.VITE_TERRAFORM_STAGING_FASTPATH === "1";
}

export function isStagingMultiStateExpandedSources(
  sources: TerraformPlanParsingSources,
): boolean {
  if (sources.planDotBundles.length !== 25) {
    return false;
  }
  if (sources.stackCatalog && sources.stackCatalog.length !== 25) {
    return false;
  }
  return true;
}

export function shouldUseStagingExpandedFastPath(
  _options: TerraformLayoutOptions | undefined,
  sources: TerraformPlanParsingSources,
): boolean {
  if (!isStagingFastPathFlagEnabled()) {
    return false;
  }
  return isStagingMultiStateExpandedSources(sources);
}
