export type TerraformPipelineLayoutMode =
  | "legacy"
  | "local-shims"
  | "global-relayer";

export const DEFAULT_TERRAFORM_PIPELINE_LAYOUT_MODE: TerraformPipelineLayoutMode =
  "legacy";

export type TerraformPipelineVerticalSolverMode =
  | "none"
  | "straight-y"
  | "straight-reorder"
  | "straight-relay"
  | "constrained-ls"
  | "elk"
  | "exact-qp";

export const DEFAULT_TERRAFORM_PIPELINE_VERTICAL_SOLVER_MODE: TerraformPipelineVerticalSolverMode =
  "straight-y";
