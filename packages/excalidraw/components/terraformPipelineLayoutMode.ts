export type TerraformPipelineLayoutMode =
  | "legacy"
  | "local-shims"
  | "global-relayer";

export const DEFAULT_TERRAFORM_PIPELINE_LAYOUT_MODE: TerraformPipelineLayoutMode =
  "legacy";

