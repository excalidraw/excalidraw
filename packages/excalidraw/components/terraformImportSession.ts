import type { ExcalidrawElement } from "@excalidraw/element/types";

import { clearTerraformImportPrepCache } from "./terraformImportPrepCache";

import type { TerraformImportPreset } from "./terraformImportPresetsTypes";
import type { TerraformPlanParsingSources } from "./terraformPlanParsing";

import type { AppState } from "../types";

import type { TerraformModuleLayoutOptions } from "./terraformModuleLayoutOptions";
import type { TerraformColorMode } from "./terraformPrimaryVisibility";

export type TerraformImportSessionSnapshot = {
  elements: readonly ExcalidrawElement[];
  terraformEdgeLayerPins: AppState["terraformEdgeLayerPins"];
  enableDeclaredDataFlow: boolean;
};

export type TerraformImportSession = {
  sources: TerraformPlanParsingSources;
  sourceFingerprint?: string;
  semanticLayout: boolean;
  layoutMode?: import("./terraformImportDialogUtils").TerraformLayoutMode;
  moduleLayoutOptions: TerraformModuleLayoutOptions;
  /** Pipeline compact mode — primary-card-only clusters, satellites added on click. */
  pipelineCompact?: boolean;
  /** Zoom LOD — hide labels/satellites when zoomed out. Default true. */
  terraformLodEnabled?: boolean;
  /** LOD preset — performance / balanced / detailed. Default balanced. */
  terraformLodPreset?: import("./terraformLod").TerraformLodPreset;
  /** Pipeline layout variant — classic global grid or compound hierarchy. */
  pipelineLayoutVariant?: import("./terraformImportDialogUtils").PipelineLayoutVariant;
  /** Pipeline packed mode — push sink-only groups right, re-pack lanes in Y. */
  pipelinePacked?: boolean;
  /** Packed only — pull slack clusters to their leftmost TFD-feasible column. */
  pipelinePackedPullLeft?: boolean;
  /** Pipeline — draw non-TFD resources in per-hull "Unconnected" strips. */
  pipelineIncludeAncillary?: boolean;
  /** Pipeline — nesting-aware semantic placement (forced bands + straightening). */
  pipelineSemanticPlacement?: boolean;
  /** RCLL M4 — X-disjoint swimlane lanes rise to share Y rows. */
  pipelineSwimlaneLaneRise?: boolean;
  /** RCLL M6 — per-container barycenter crossing-min reorder. */
  pipelineReorder?: boolean;
  /** RCLL subnet de-band — collapse subnet lanes into one VPC stack (frames → rails). */
  pipelineSubnetDeBand?: boolean;
  /** RCLL M8r — whole-model-global sibling-separation ranking (needs lane-rise). */
  pipelineRankSeparate?: boolean;
  /** RCLL M5 — Brandes–Köpf leaf straightening (Y-only spine alignment). */
  pipelineStraighten?: boolean;
  /** RCLL M5b — de-density: spread crowded columns. */
  pipelineDeDensify?: boolean;
  /** RCLL "Column packing" tri-state: `spread` (M5b) / `none` / `compact` (M5c). */
  pipelineColumnPacking?: "spread" | "none" | "compact";
  /** RCLL "Layout" profile — `readable | balanced | compact` (expands into the RCLL flags). */
  pipelineLayoutProfile?: import("./terraformPipelineLayoutProfiles").RcllLayoutProfile;
  /** RCLL M3b / DEC-1 — X-disjoint cycle groups rise to share Y. Default on. */
  pipelineStaircaseBandOverlap?: boolean;
  /** Frame tint mode: category/hierarchy vs plan-action default frames. */
  colorMode?: TerraformColorMode;
  preset: TerraformImportPreset | null;
  importedTfdTexts: string[];
  snapshot: TerraformImportSessionSnapshot;
};

let activeSession: TerraformImportSession | null = null;

export const cloneTerraformElementsForSnapshot = (
  elements: readonly ExcalidrawElement[],
): ExcalidrawElement[] => structuredClone(elements) as ExcalidrawElement[];

export const setTerraformImportSession = (session: TerraformImportSession) => {
  activeSession = {
    ...session,
    snapshot: {
      ...session.snapshot,
      elements: cloneTerraformElementsForSnapshot(session.snapshot.elements),
    },
  };
};

export const getTerraformImportSession = (): TerraformImportSession | null =>
  activeSession;

export const clearTerraformImportSession = () => {
  activeSession = null;
  clearTerraformImportPrepCache();
};

export const hasTerraformImportSession = (): boolean => activeSession != null;

export const updateTerraformImportSessionColorMode = (
  colorMode: TerraformColorMode,
) => {
  if (activeSession) {
    activeSession = { ...activeSession, colorMode };
  }
};

export const updateTerraformImportSessionLodEnabled = (
  terraformLodEnabled: boolean,
) => {
  if (activeSession) {
    activeSession = { ...activeSession, terraformLodEnabled };
  }
};

export const updateTerraformImportSessionLodPreset = (
  terraformLodPreset: import("./terraformLod").TerraformLodPreset,
) => {
  if (activeSession) {
    activeSession = { ...activeSession, terraformLodPreset };
  }
};
