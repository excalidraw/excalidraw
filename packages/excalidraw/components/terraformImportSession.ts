import type { ExcalidrawElement } from "@excalidraw/element/types";

import { clearTerraformImportPrepCache } from "./terraformImportPrepCache";

import type { TerraformImportPreset } from "./terraformImportPresetsTypes";
import type { TerraformPlanParsingSources } from "./terraformPlanParsing";

import type { AppState } from "../types";

import type { TerraformModuleLayoutOptions } from "./terraformModuleLayoutOptions";

export type TerraformImportSessionSnapshot = {
  elements: readonly ExcalidrawElement[];
  terraformEdgeLayerPins: AppState["terraformEdgeLayerPins"];
  enableDeclaredDataFlow: boolean;
};

export type TerraformImportSession = {
  sources: TerraformPlanParsingSources;
  sourceFingerprint?: string;
  semanticLayout: boolean;
  layoutMode?: "module" | "semantic" | "pipeline";
  moduleLayoutOptions: TerraformModuleLayoutOptions;
  /** Pipeline compact mode — primary-card-only clusters, satellites added on click. */
  pipelineCompact?: boolean;
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
