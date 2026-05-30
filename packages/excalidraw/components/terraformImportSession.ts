import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { TerraformImportPreset } from "./terraformImportPresetsTypes";
import type { TerraformPlanParsingSources } from "./terraformPlanParsing";

import type { AppState } from "../types";

import type { TerraformModuleLayoutOptions } from "./terraformModuleLayoutOptions";
import type {
  TerraformPipelineLayoutMode,
  TerraformPipelineVerticalSolverMode,
} from "./terraformPipelineLayoutMode";

export type TerraformImportSessionSnapshot = {
  elements: readonly ExcalidrawElement[];
  terraformEdgeLayerPins: AppState["terraformEdgeLayerPins"];
  enableDeclaredDataFlow: boolean;
};

export type TerraformImportSession = {
  sources: TerraformPlanParsingSources;
  semanticLayout: boolean;
  pipelineLayout: boolean;
  pipelineLayoutMode?: TerraformPipelineLayoutMode;
  pipelineVerticalSolverMode?: TerraformPipelineVerticalSolverMode;
  moduleLayoutOptions: TerraformModuleLayoutOptions;
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
};

export const hasTerraformImportSession = (): boolean => activeSession != null;
