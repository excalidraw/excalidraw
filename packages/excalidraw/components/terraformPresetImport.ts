import {
  DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
  resolveTerraformModuleLayoutOptions,
  type TerraformModuleLayoutOptions,
} from "./terraformModuleLayoutOptions";
import { loadTerraformImportPresetSources } from "./terraformImportPresetLoader";
import {
  runTerraformImportFromSources,
  type RunTerraformImportFromSourcesResult,
} from "./terraformSceneApply";

import type {
  TerraformLayoutMode,
  TerraformView,
} from "./terraformImportDialogUtils";
import type { TerraformPlanParsingSources } from "./terraformPlanParsing";
import type { TerraformImportPreset } from "./terraformImportPresetsTypes";
import type { TerraformImportPresetWarning } from "./terraformImportPresetsTypes";
import type { TerraformLayoutProgress } from "./terraformLayoutWorkerTypes";
import type { AppClassProperties, AppState } from "../types";
import type React from "react";

type SetAppState = React.Component<any, AppState>["setState"];

export type { TerraformLayoutMode };

export const deriveLayoutModeFromView = (
  view: TerraformView,
  sources: Pick<TerraformPlanParsingSources, "planDotBundles" | "states">,
): TerraformLayoutMode => {
  const canUseSemanticView =
    sources.planDotBundles.length > 0 || sources.states.length > 0;
  if (view === "rcll" && canUseSemanticView) {
    return "rcll";
  }
  if (view === "pipeline" && canUseSemanticView) {
    return "pipeline";
  }
  if (view === "semantic" && canUseSemanticView) {
    return "semantic";
  }
  return "module";
};

export type RunTerraformImportFromSourcesArgs = {
  app: AppClassProperties;
  setAppState: SetAppState;
  sources: TerraformPlanParsingSources;
  view: TerraformView;
  moduleLayoutOptions?: TerraformModuleLayoutOptions;
  /** Pipeline view: start with satellites hidden (true, default) or all visible (false). */
  pipelineCompact?: boolean;
  pipelineLayoutVariant?: import("./terraformImportDialogUtils").PipelineLayoutVariant;
  pipelinePacked?: boolean;
  pipelinePackedPullLeft?: boolean;
  pipelineIncludeAncillary?: boolean;
  pipelineSemanticPlacement?: boolean;
  pipelineSwimlaneLaneRise?: boolean;
  pipelineReorder?: boolean;
  pipelineSubnetDeBand?: boolean;
  pipelineRankSeparate?: boolean;
  pipelineStraighten?: boolean;
  pipelineDeDensify?: boolean;
  pipelineStaircaseBandOverlap?: boolean;
  importedTfdTexts?: string[];
  preset?: TerraformImportPreset | null;
  signal?: AbortSignal;
  onLayoutProgress?: (progress: TerraformLayoutProgress) => void;
};

export const runTerraformImportWithView = async ({
  app,
  setAppState,
  sources,
  view,
  moduleLayoutOptions = DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
  pipelineCompact,
  pipelineLayoutVariant,
  pipelinePacked,
  pipelinePackedPullLeft,
  pipelineIncludeAncillary,
  pipelineSemanticPlacement,
  pipelineSwimlaneLaneRise,
  pipelineReorder,
  pipelineSubnetDeBand,
  pipelineRankSeparate,
  pipelineStraighten,
  pipelineDeDensify,
  pipelineStaircaseBandOverlap,
  importedTfdTexts,
  preset = null,
  signal,
  onLayoutProgress,
}: RunTerraformImportFromSourcesArgs): Promise<RunTerraformImportFromSourcesResult> => {
  const layoutMode = deriveLayoutModeFromView(view, sources);
  const semanticLayout = layoutMode === "semantic";
  const isPipelineFamily = layoutMode === "pipeline" || layoutMode === "rcll";
  return runTerraformImportFromSources(app, setAppState, sources, {
    semanticLayout,
    layoutMode: isPipelineFamily ? layoutMode : undefined,
    moduleLayoutOptions:
      layoutMode === "module" ? moduleLayoutOptions : undefined,
    ...(isPipelineFamily
      ? {
          pipelineCompact,
          pipelineLayoutVariant,
          pipelinePacked,
          pipelinePackedPullLeft,
          pipelineIncludeAncillary,
          pipelineSemanticPlacement,
          pipelineSwimlaneLaneRise,
          pipelineReorder,
          pipelineSubnetDeBand,
          pipelineRankSeparate,
          pipelineStraighten,
          pipelineDeDensify,
          pipelineStaircaseBandOverlap,
        }
      : {}),
    importedTfdTexts,
    preset,
    signal,
    onLayoutProgress,
  });
};

export type RunTerraformPresetImportOptions = {
  view?: TerraformView;
  moduleLayoutOptions?: TerraformModuleLayoutOptions;
  pipelineCompact?: boolean;
  pipelineLayoutVariant?: import("./terraformImportDialogUtils").PipelineLayoutVariant;
  pipelinePacked?: boolean;
  pipelinePackedPullLeft?: boolean;
  pipelineIncludeAncillary?: boolean;
  pipelineSemanticPlacement?: boolean;
  pipelineSwimlaneLaneRise?: boolean;
  pipelineReorder?: boolean;
  pipelineSubnetDeBand?: boolean;
  pipelineRankSeparate?: boolean;
  pipelineStraighten?: boolean;
  pipelineDeDensify?: boolean;
  pipelineStaircaseBandOverlap?: boolean;
  signal?: AbortSignal;
  onLayoutProgress?: (progress: TerraformLayoutProgress) => void;
};

export type RunTerraformPresetImportResult =
  RunTerraformImportFromSourcesResult & {
    presetSources: Awaited<ReturnType<typeof loadTerraformImportPresetSources>>;
  };

export const runTerraformPresetImport = async (
  app: AppClassProperties,
  setAppState: SetAppState,
  preset: TerraformImportPreset,
  options: RunTerraformPresetImportOptions = {},
): Promise<RunTerraformPresetImportResult> => {
  const presetSources = await loadTerraformImportPresetSources(preset, {
    allowDirectoryHandleFallback: true,
  });
  const view = options.view ?? preset.view;
  const moduleLayoutOptions =
    options.moduleLayoutOptions ?? DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS;
  const sources: TerraformPlanParsingSources = {
    planDotBundles: presetSources.planDotBundles,
    states: presetSources.states,
    stateLabels: presetSources.stateLabels,
    tfdTexts: presetSources.tfdTexts,
    tfdLabels: presetSources.tfdLabels,
    repoName: presetSources.repoName,
    stackCatalog: presetSources.stackCatalog,
    warnings: presetSources.warnings,
  };
  const result = await runTerraformImportWithView({
    app,
    setAppState,
    sources,
    view,
    moduleLayoutOptions,
    pipelineCompact: options.pipelineCompact,
    pipelineLayoutVariant: options.pipelineLayoutVariant,
    pipelinePacked: options.pipelinePacked,
    pipelinePackedPullLeft: options.pipelinePackedPullLeft,
    pipelineIncludeAncillary: options.pipelineIncludeAncillary,
    pipelineSemanticPlacement: options.pipelineSemanticPlacement,
    pipelineSwimlaneLaneRise: options.pipelineSwimlaneLaneRise,
    pipelineReorder: options.pipelineReorder,
    pipelineSubnetDeBand: options.pipelineSubnetDeBand,
    pipelineRankSeparate: options.pipelineRankSeparate,
    pipelineStraighten: options.pipelineStraighten,
    pipelineDeDensify: options.pipelineDeDensify,
    pipelineStaircaseBandOverlap: options.pipelineStaircaseBandOverlap,
    importedTfdTexts: presetSources.tfdTexts,
    preset,
    signal: options.signal,
    onLayoutProgress: options.onLayoutProgress,
  });
  return { ...result, presetSources };
};

export type TerraformPresetImportSideEffects = {
  extraWarnings?: TerraformImportPresetWarning[];
};

export const resolveModuleLayoutOptionsForDemo = (
  pack?: TerraformModuleLayoutOptions["mode"],
): TerraformModuleLayoutOptions =>
  pack
    ? resolveTerraformModuleLayoutOptions({ mode: pack })
    : DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS;
