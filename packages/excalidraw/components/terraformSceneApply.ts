import type { ExcalidrawElement } from "@excalidraw/element/types";

import { restoreElements } from "../data/restore";

import { applyTerraformRelationshipFocus } from "./terraformRelationshipFocus";
import {
  buildTerraformReconcileOptionsForAppState,
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
} from "./terraformVisibility";
import {
  DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
  type TerraformModuleLayoutOptions,
} from "./terraformModuleLayoutOptions";
import { fetchPresetLayoutCache } from "./terraformLayoutCacheClient";
import { layoutTerraformViaWorkers } from "./terraformLayoutWorkerClient";

import {
  type TerraformImportWarning,
  type TerraformPlanParsingSources,
} from "./terraformPlanParsing";
import { loadTerraformImportPresetSources } from "./terraformImportPresetLoader";
import { terraformImportPrepFingerprint } from "./terraformImportPrepCache";
import { TERRAFORM_LOD_DEFAULT_PRESET } from "./terraformLod";
import {
  cloneTerraformElementsForSnapshot,
  getTerraformImportSession,
  setTerraformImportSession,
} from "./terraformImportSession";
import {
  TERRAFORM_COLOR_MODE_DEFAULT,
  applyTerraformColorModeToElements,
  type TerraformColorMode,
} from "./terraformPrimaryVisibility";

import type { TerraformLayoutProgress } from "./terraformLayoutWorkerTypes";

import type React from "react";

import type { TerraformImportPreset } from "./terraformImportPresetsTypes";
import type { TerraformView } from "./terraformImportDialogUtils";
import type { AppClassProperties, AppState, BinaryFileData } from "../types";

type SetAppState = React.Component<any, AppState>["setState"];

export type TerraformExcalidrawScenePayload = {
  elements?: unknown;
  files?: Record<string, BinaryFileData>;
  meta?: { importWarnings?: TerraformImportWarning[] };
};

export type ApplyTerraformExcalidrawSceneOptions = {
  enableDeclaredDataFlow?: boolean;
  terraformEdgeLayerPins?: AppState["terraformEdgeLayerPins"];
  terraformLodEnabled?: boolean;
  terraformLodPreset?: AppState["terraformLodPreset"];
  scrollToContent?: boolean;
};

const defaultTerraformEdgeLayerPins = (
  enableDeclaredDataFlow: boolean,
): NonNullable<AppState["terraformEdgeLayerPins"]> => ({
  dependency: false,
  dataFlow: false,
  declaredDataFlow: enableDeclaredDataFlow,
  networking: false,
  topologyFrameFlow: false,
});

export const applyTerraformExcalidrawScene = (
  app: AppClassProperties,
  setAppState: SetAppState,
  scene: TerraformExcalidrawScenePayload,
  options: ApplyTerraformExcalidrawSceneOptions = {},
) => {
  const files = scene.files;
  if (files && typeof files === "object") {
    const list = Object.values(files).filter((entry): entry is BinaryFileData =>
      Boolean(
        entry &&
          typeof entry === "object" &&
          typeof entry.id === "string" &&
          typeof entry.dataURL === "string",
      ),
    );
    if (list.length > 0) {
      app.addFiles(list);
    }
  }

  const enableDeclaredDataFlow = Boolean(options.enableDeclaredDataFlow);
  const terraformEdgeLayerPins =
    options.terraformEdgeLayerPins ??
    defaultTerraformEdgeLayerPins(enableDeclaredDataFlow);

  const elements = restoreElements(
    scene.elements as readonly ExcalidrawElement[] | null | undefined,
    null,
    {
      repairBindings: true,
    },
  );
  const focus = applyTerraformRelationshipFocus(
    elements,
    null,
    app.state.viewBackgroundColor ?? "#ffffff",
  );
  const pinReconcile = buildTerraformReconcileOptionsForAppState(
    terraformEdgeLayerPins,
    null,
  );
  let nextElements = focus.elements;
  if (pinReconcile) {
    nextElements = reconcileTerraformVisibility(
      focus.shouldRepairBindings
        ? repairTerraformEdgeBindings(nextElements)
        : nextElements,
      pinReconcile,
    );
  } else if (focus.shouldRepairBindings) {
    nextElements = repairTerraformEdgeBindings(nextElements);
  }
  app.scene.replaceAllElements(nextElements);
  setAppState({
    terraformEdgeLayerPins,
    terraformEdgeHoverPeekKey: null,
    terraformLodEnabled: options.terraformLodEnabled ?? true,
    terraformLodPreset:
      options.terraformLodPreset ?? TERRAFORM_LOD_DEFAULT_PRESET,
  });
  if (options.scrollToContent !== false) {
    app.scrollToContent();
  }

  return {
    elements: nextElements,
    terraformEdgeLayerPins,
    enableDeclaredDataFlow,
  };
};

export type RunTerraformImportFromSourcesOptions = {
  semanticLayout: boolean;
  layoutMode?: import("./terraformImportDialogUtils").TerraformLayoutMode;
  moduleLayoutOptions?: TerraformModuleLayoutOptions;
  /** Pipeline compact mode — primary-card-only clusters, satellites added on click. Default true. */
  pipelineCompact?: boolean;
  /** Zoom LOD — hide labels/satellites when zoomed out. Default true. */
  terraformLodEnabled?: boolean;
  terraformLodPreset?: AppState["terraformLodPreset"];
  pipelineLayoutVariant?: import("./terraformImportDialogUtils").PipelineLayoutVariant;
  /** Pipeline packed mode — push sink-only groups right and re-pack lanes in Y. Default false. */
  pipelinePacked?: boolean;
  /** Packed only — pull slack clusters to their leftmost TFD-feasible column. Default false. */
  pipelinePackedPullLeft?: boolean;
  /** Pipeline — draw non-TFD resources in per-hull "Unconnected" strips. Default false. */
  pipelineIncludeAncillary?: boolean;
  /** Pipeline — nesting-aware semantic placement (forced bands + straightening). Default false. */
  pipelineSemanticPlacement?: boolean;
  /** RCLL M4 — X-disjoint swimlane lanes rise to share Y rows. Default false. */
  pipelineSwimlaneLaneRise?: boolean;
  /** RCLL M6 — per-container barycenter crossing-min reorder. Default false. */
  pipelineReorder?: boolean;
  /** RCLL subnet de-band — collapse subnet lanes into one VPC stack. Default false. */
  pipelineSubnetDeBand?: boolean;
  /** RCLL M8r — whole-model-global sibling-separation ranking (needs lane-rise). Default false. */
  pipelineRankSeparate?: boolean;
  /** RCLL M5 — Brandes–Köpf leaf straightening. Default false. */
  pipelineStraighten?: boolean;
  /** RCLL M5b — de-density: spread crowded columns. Default false. */
  pipelineDeDensify?: boolean;
  /** RCLL M3b / DEC-1 — X-disjoint cycle groups rise to share Y. Default on (undefined). */
  pipelineStaircaseBandOverlap?: boolean;
  /** Frame tint mode for pipeline/semantic topology views. */
  colorMode?: TerraformColorMode;
  importedTfdTexts?: string[];
  preset?: TerraformImportPreset | null;
  updateSession?: boolean;
  scrollToContent?: boolean;
  onLayoutProgress?: (progress: TerraformLayoutProgress) => void;
  signal?: AbortSignal;
};

export type RunTerraformImportFromSourcesResult = {
  importWarnings?: TerraformImportWarning[];
};

async function layoutTerraformSceneFromSources(
  sources: TerraformPlanParsingSources,
  options: RunTerraformImportFromSourcesOptions,
  layoutMode: import("./terraformImportDialogUtils").TerraformLayoutMode,
  moduleLayoutOptions: TerraformModuleLayoutOptions,
): Promise<TerraformExcalidrawScenePayload> {
  const presetId = options.preset?.id?.trim();
  // Packed and ancillary pipeline scenes are not part of the KV layout cache
  // key yet; skip the cache so such imports never return the default layout.
  // RCLL view is never cached (M0 delegates; no cache key for its dials yet).
  const skipLayoutCache =
    layoutMode === "rcll" ||
    (layoutMode === "pipeline" &&
      (options.pipelineLayoutVariant === "v2" ||
        options.pipelinePacked === true ||
        options.pipelinePackedPullLeft === true ||
        options.pipelineIncludeAncillary === true ||
        options.pipelineSemanticPlacement === true));
  if (presetId && !skipLayoutCache) {
    const cached = await fetchPresetLayoutCache(
      presetId,
      layoutMode as TerraformView,
      layoutMode === "module" ? moduleLayoutOptions : undefined,
      { signal: options.signal },
    );
    if (cached) {
      return cached;
    }
  }

  return layoutTerraformViaWorkers(
    sources,
    {
      semanticLayout: options.semanticLayout,
      ...(options.layoutMode ? { layoutMode } : {}),
      moduleLayoutOptions:
        layoutMode === "module" ? moduleLayoutOptions : undefined,
      ...(layoutMode === "pipeline" || layoutMode === "rcll"
        ? {
            pipelineCompact: options.pipelineCompact !== false,
            pipelineLayoutVariant:
              options.pipelineLayoutVariant ??
              (layoutMode === "rcll" ? "rcll" : "classic"),
            pipelinePacked: options.pipelinePacked === true,
            pipelinePackedPullLeft: options.pipelinePackedPullLeft === true,
            pipelineIncludeAncillary: options.pipelineIncludeAncillary === true,
            pipelineSemanticPlacement:
              options.pipelineSemanticPlacement === true,
            pipelineSwimlaneLaneRise:
              options.pipelineSwimlaneLaneRise === true,
            pipelineReorder: options.pipelineReorder === true,
            pipelineSubnetDeBand: options.pipelineSubnetDeBand === true,
            pipelineRankSeparate: options.pipelineRankSeparate === true,
            pipelineStraighten: options.pipelineStraighten === true,
            pipelineDeDensify: options.pipelineDeDensify === true,
            // Default-on: undefined ⇒ engine default (true). Only an explicit
            // false (Stacked) flows through.
            pipelineStaircaseBandOverlap: options.pipelineStaircaseBandOverlap,
          }
        : {}),
      colorMode: options.colorMode ?? TERRAFORM_COLOR_MODE_DEFAULT,
    },
    {
      onProgress: options.onLayoutProgress,
      signal: options.signal,
    },
  );
}

export const runTerraformImportFromSources = async (
  app: AppClassProperties,
  setAppState: SetAppState,
  sources: TerraformPlanParsingSources,
  options: RunTerraformImportFromSourcesOptions,
): Promise<RunTerraformImportFromSourcesResult> => {
  const moduleLayoutOptions =
    options.moduleLayoutOptions ?? DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS;
  const layoutMode: import("./terraformImportDialogUtils").TerraformLayoutMode =
    options.layoutMode ?? (options.semanticLayout ? "semantic" : "module");
  const sourceFingerprint = terraformImportPrepFingerprint(sources);
  const importedTfdTexts = options.importedTfdTexts ?? [];
  const enableDeclaredDataFlow = importedTfdTexts.some((t) => t.trim());

  const scene = await layoutTerraformSceneFromSources(
    sources,
    options,
    layoutMode,
    moduleLayoutOptions,
  );

  const { elements, terraformEdgeLayerPins } = applyTerraformExcalidrawScene(
    app,
    setAppState,
    scene,
    {
      enableDeclaredDataFlow,
      scrollToContent: options.scrollToContent,
      terraformLodEnabled: options.terraformLodEnabled !== false,
      terraformLodPreset:
        options.terraformLodPreset ?? TERRAFORM_LOD_DEFAULT_PRESET,
    },
  );

  if (options.updateSession !== false) {
    const nextSnapshot = {
      elements: cloneTerraformElementsForSnapshot(elements),
      terraformEdgeLayerPins,
      enableDeclaredDataFlow,
    };
    setTerraformImportSession({
      sources,
      sourceFingerprint,
      semanticLayout: options.semanticLayout,
      ...(options.layoutMode ? { layoutMode } : {}),
      moduleLayoutOptions,
      terraformLodEnabled: options.terraformLodEnabled !== false,
      terraformLodPreset:
        options.terraformLodPreset ?? TERRAFORM_LOD_DEFAULT_PRESET,
      ...(layoutMode === "pipeline" || layoutMode === "rcll"
        ? {
            pipelineCompact: options.pipelineCompact !== false,
            pipelineLayoutVariant:
              options.pipelineLayoutVariant ??
              (layoutMode === "rcll" ? "rcll" : "classic"),
            pipelinePacked: options.pipelinePacked === true,
            pipelinePackedPullLeft: options.pipelinePackedPullLeft === true,
            pipelineIncludeAncillary: options.pipelineIncludeAncillary === true,
            pipelineSemanticPlacement:
              options.pipelineSemanticPlacement === true,
            pipelineSwimlaneLaneRise:
              options.pipelineSwimlaneLaneRise === true,
            pipelineReorder: options.pipelineReorder === true,
            pipelineSubnetDeBand: options.pipelineSubnetDeBand === true,
            pipelineRankSeparate: options.pipelineRankSeparate === true,
            pipelineStraighten: options.pipelineStraighten === true,
            pipelineDeDensify: options.pipelineDeDensify === true,
            // Default-on: undefined ⇒ engine default (true). Only an explicit
            // false (Stacked) flows through.
            pipelineStaircaseBandOverlap: options.pipelineStaircaseBandOverlap,
          }
        : {}),
      colorMode: options.colorMode ?? TERRAFORM_COLOR_MODE_DEFAULT,
      preset: options.preset ?? null,
      importedTfdTexts,
      snapshot: nextSnapshot,
    });
  }

  const warnings = (
    scene as { meta?: { importWarnings?: TerraformImportWarning[] } }
  ).meta?.importWarnings;

  return { importWarnings: warnings };
};

export const resetTerraformLayout = (
  app: AppClassProperties,
  setAppState: SetAppState,
): boolean => {
  const session = getTerraformImportSession();
  if (!session) {
    return false;
  }

  const { snapshot } = session;
  const colorMode = session.colorMode ?? TERRAFORM_COLOR_MODE_DEFAULT;
  const elements = applyTerraformColorModeToElements(
    cloneTerraformElementsForSnapshot(snapshot.elements),
    colorMode,
  );
  applyTerraformExcalidrawScene(
    app,
    setAppState,
    { elements },
    {
      enableDeclaredDataFlow: snapshot.enableDeclaredDataFlow,
      terraformEdgeLayerPins: snapshot.terraformEdgeLayerPins,
      terraformLodEnabled: session.terraformLodEnabled !== false,
      terraformLodPreset:
        session.terraformLodPreset ?? TERRAFORM_LOD_DEFAULT_PRESET,
    },
  );
  return true;
};

export const refreshTerraformLayout = async (
  app: AppClassProperties,
  setAppState: SetAppState,
): Promise<RunTerraformImportFromSourcesResult> => {
  const session = getTerraformImportSession();
  if (!session) {
    throw new Error("No Terraform import session — import a scene first.");
  }

  let sources = session.sources;
  let importedTfdTexts = session.importedTfdTexts;

  if (session.preset) {
    const presetSources = await loadTerraformImportPresetSources(
      session.preset,
      { allowDirectoryHandleFallback: true },
    );
    sources = {
      planDotBundles: presetSources.planDotBundles,
      states: presetSources.states,
      stateLabels: presetSources.stateLabels,
      tfdTexts: presetSources.tfdTexts,
      tfdLabels: presetSources.tfdLabels,
    };
    importedTfdTexts = presetSources.tfdTexts;
  }

  return runTerraformImportFromSources(app, setAppState, sources, {
    semanticLayout: session.semanticLayout,
    layoutMode: session.layoutMode,
    moduleLayoutOptions: session.moduleLayoutOptions,
    pipelineCompact: session.pipelineCompact,
    pipelineLayoutVariant: session.pipelineLayoutVariant ?? "classic",
    colorMode: session.colorMode,
    terraformLodEnabled: session.terraformLodEnabled,
    terraformLodPreset:
      session.terraformLodPreset ?? TERRAFORM_LOD_DEFAULT_PRESET,
    importedTfdTexts,
    preset: session.preset,
  });
};
