import { tfComfortPx } from "./terraformLayoutComfort";

export type ModulePackingMode = "default" | "box" | "rectpacking";

export type DefaultGridPackingParams = {
  resourceGap: number;
  submoduleGap: number;
  rootStackMinCellWidth: number;
};

export type ElkBoxPackingParams = {
  nodeSpacing: number;
  padding: number;
  aspectRatio: number;
};

export type ElkRectPackingOptimizationGoal = "MAX_SCALE_DRIVEN" | "MIN_AREA";

export type ElkRectPackingParams = {
  nodeSpacing: number;
  padding: number;
  aspectRatio: number;
  /** -1 lets ELK choose width automatically. */
  targetWidth: number;
  compactionIterations: number;
  orderByHeight: boolean;
  optimizationGoal: ElkRectPackingOptimizationGoal;
};

export type TerraformModuleLayoutOptions = {
  mode: ModulePackingMode;
  defaultGrid: DefaultGridPackingParams;
  box: ElkBoxPackingParams;
  rectpacking: ElkRectPackingParams;
};

export type PartialTerraformModuleLayoutOptions = {
  mode?: ModulePackingMode;
  defaultGrid?: Partial<DefaultGridPackingParams>;
  box?: Partial<ElkBoxPackingParams>;
  rectpacking?: Partial<ElkRectPackingParams>;
};

export type ModulePackingParamFieldType = "number" | "boolean" | "select";

export type ModulePackingParamField = {
  mode: ModulePackingMode;
  group: "defaultGrid" | "box" | "rectpacking";
  key: string;
  label: string;
  type: ModulePackingParamFieldType;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  options?: ReadonlyArray<{ value: string; label: string }>;
};

const px = tfComfortPx;

export const DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS: TerraformModuleLayoutOptions =
  {
    mode: "default",
    defaultGrid: {
      resourceGap: px(20),
      submoduleGap: px(32),
      rootStackMinCellWidth: px(360),
    },
    box: {
      nodeSpacing: px(32),
      padding: px(15),
      aspectRatio: 1.3,
    },
    rectpacking: {
      nodeSpacing: px(32),
      padding: px(15),
      aspectRatio: 1.3,
      targetWidth: -1,
      compactionIterations: 1,
      orderByHeight: false,
      optimizationGoal: "MAX_SCALE_DRIVEN",
    },
  };

export const MODULE_PACKING_MODE_OPTIONS: ReadonlyArray<{
  value: ModulePackingMode;
  label: string;
  description: string;
}> = [
  {
    value: "default",
    label: "Default grid",
    description:
      "Sqrt row wrap for submodules and resources (current behavior).",
  },
  {
    value: "box",
    label: "ELK Box",
    description:
      "Simple ELK container packing for variable-size module children.",
  },
  {
    value: "rectpacking",
    label: "ELK Rectpacking",
    description:
      "Height-bundled rows with compaction; good for uneven submodule sizes.",
  },
];

export const MODULE_PACKING_PARAM_FIELDS: ReadonlyArray<ModulePackingParamField> =
  [
    {
      mode: "default",
      group: "defaultGrid",
      key: "resourceGap",
      label: "Resource gap",
      type: "number",
      min: 0,
      step: 1,
      hint: "Spacing between resource cards in the grid.",
    },
    {
      mode: "default",
      group: "defaultGrid",
      key: "submoduleGap",
      label: "Submodule gap",
      type: "number",
      min: 0,
      step: 1,
      hint: "Spacing between nested module frames.",
    },
    {
      mode: "default",
      group: "defaultGrid",
      key: "rootStackMinCellWidth",
      label: "Root stack min cell width",
      type: "number",
      min: 100,
      step: 1,
      hint: "Minimum column width when packing multi-stack roots.",
    },
    {
      mode: "box",
      group: "box",
      key: "nodeSpacing",
      label: "Node spacing",
      type: "number",
      min: 0,
      step: 1,
    },
    {
      mode: "box",
      group: "box",
      key: "padding",
      label: "Padding",
      type: "number",
      min: 0,
      step: 1,
    },
    {
      mode: "box",
      group: "box",
      key: "aspectRatio",
      label: "Aspect ratio",
      type: "number",
      min: 0.1,
      step: 0.1,
    },
    {
      mode: "rectpacking",
      group: "rectpacking",
      key: "nodeSpacing",
      label: "Node spacing",
      type: "number",
      min: 0,
      step: 1,
    },
    {
      mode: "rectpacking",
      group: "rectpacking",
      key: "padding",
      label: "Padding",
      type: "number",
      min: 0,
      step: 1,
    },
    {
      mode: "rectpacking",
      group: "rectpacking",
      key: "aspectRatio",
      label: "Aspect ratio",
      type: "number",
      min: 0.1,
      step: 0.1,
    },
    {
      mode: "rectpacking",
      group: "rectpacking",
      key: "targetWidth",
      label: "Target width",
      type: "number",
      min: -1,
      step: 1,
      hint: "-1 for automatic width.",
    },
    {
      mode: "rectpacking",
      group: "rectpacking",
      key: "compactionIterations",
      label: "Compaction iterations",
      type: "number",
      min: 0,
      max: 20,
      step: 1,
    },
    {
      mode: "rectpacking",
      group: "rectpacking",
      key: "orderByHeight",
      label: "Order by height",
      type: "boolean",
    },
    {
      mode: "rectpacking",
      group: "rectpacking",
      key: "optimizationGoal",
      label: "Optimization goal",
      type: "select",
      options: [
        { value: "MAX_SCALE_DRIVEN", label: "Max scale driven" },
        { value: "MIN_AREA", label: "Min area" },
      ],
    },
  ];

export const resolveTerraformModuleLayoutOptions = (
  partial?: PartialTerraformModuleLayoutOptions,
): TerraformModuleLayoutOptions => ({
  mode: partial?.mode ?? DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS.mode,
  defaultGrid: {
    ...DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS.defaultGrid,
    ...partial?.defaultGrid,
  },
  box: {
    ...DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS.box,
    ...partial?.box,
  },
  rectpacking: {
    ...DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS.rectpacking,
    ...partial?.rectpacking,
  },
});

const elkPadding = (uniform: number) =>
  `[top=${uniform},left=${uniform},bottom=${uniform},right=${uniform}]`;

export const buildElkBoxLayoutOptions = (
  params: ElkBoxPackingParams,
): Record<string, string> => ({
  "elk.algorithm": "box",
  "elk.spacing.nodeNode": String(params.nodeSpacing),
  "elk.padding": elkPadding(params.padding),
  "elk.aspectRatio": String(params.aspectRatio),
});

export const buildElkRectPackingLayoutOptions = (
  params: ElkRectPackingParams,
): Record<string, string> => ({
  "elk.algorithm": "rectpacking",
  "elk.spacing.nodeNode": String(params.nodeSpacing),
  "elk.padding": elkPadding(params.padding),
  "elk.aspectRatio": String(params.aspectRatio),
  "elk.rectpacking.widthApproximation.targetWidth": String(params.targetWidth),
  "elk.rectpacking.packing.compaction.iterations": String(
    params.compactionIterations,
  ),
  "elk.rectpacking.orderBySize": String(params.orderByHeight),
  "elk.rectpacking.widthApproximation.optimizationGoal":
    params.optimizationGoal,
});

export type TerraformModulePackingMeta = {
  mode: ModulePackingMode;
  params: DefaultGridPackingParams | ElkBoxPackingParams | ElkRectPackingParams;
};

export const moduleLayoutOptionsToMeta = (
  options: TerraformModuleLayoutOptions,
): TerraformModulePackingMeta => {
  switch (options.mode) {
    case "box":
      return { mode: "box", params: { ...options.box } };
    case "rectpacking":
      return { mode: "rectpacking", params: { ...options.rectpacking } };
    default:
      return { mode: "default", params: { ...options.defaultGrid } };
  }
};

export const paramFieldsForMode = (
  mode: ModulePackingMode,
): ReadonlyArray<ModulePackingParamField> =>
  MODULE_PACKING_PARAM_FIELDS.filter((field) => field.mode === mode);
