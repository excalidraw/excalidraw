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
import { layoutTerraformViaWorkers } from "./terraformLayoutWorkerClient";

import {
  type TerraformImportWarning,
  type TerraformPlanParsingSources,
} from "./terraformPlanParsing";
import { loadTerraformImportPresetSources } from "./terraformImportPresetLoader";
import { terraformImportPrepFingerprint } from "./terraformImportPrepCache";
import {
  cloneTerraformElementsForSnapshot,
  getTerraformImportSession,
  setTerraformImportSession,
} from "./terraformImportSession";

import type { TerraformLayoutProgress } from "./terraformLayoutWorkerTypes";

import type React from "react";

import type { TerraformImportPreset } from "./terraformImportPresetsTypes";
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
  scrollToContent?: boolean;
};

const defaultTerraformEdgeLayerPins = (
  enableDeclaredDataFlow: boolean,
): NonNullable<AppState["terraformEdgeLayerPins"]> => ({
  dependency: false,
  dataFlow: false,
  declaredDataFlow: enableDeclaredDataFlow,
  networking: false,
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
  layoutMode?: "module" | "semantic" | "pipeline";
  moduleLayoutOptions?: TerraformModuleLayoutOptions;
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

export const runTerraformImportFromSources = async (
  app: AppClassProperties,
  setAppState: SetAppState,
  sources: TerraformPlanParsingSources,
  options: RunTerraformImportFromSourcesOptions,
): Promise<RunTerraformImportFromSourcesResult> => {
  const moduleLayoutOptions =
    options.moduleLayoutOptions ?? DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS;
  const layoutMode =
    options.layoutMode ?? (options.semanticLayout ? "semantic" : "module");
  const sourceFingerprint = terraformImportPrepFingerprint(sources);
  const importedTfdTexts = options.importedTfdTexts ?? [];
  const enableDeclaredDataFlow = importedTfdTexts.some((t) => t.trim());
  const scene = await layoutTerraformViaWorkers(
    sources,
    {
      semanticLayout: options.semanticLayout,
      ...(options.layoutMode ? { layoutMode } : {}),
      moduleLayoutOptions:
        layoutMode === "module" ? moduleLayoutOptions : undefined,
    },
    {
      onProgress: options.onLayoutProgress,
      signal: options.signal,
    },
  );

  const { elements, terraformEdgeLayerPins } = applyTerraformExcalidrawScene(
    app,
    setAppState,
    scene,
    {
      enableDeclaredDataFlow,
      scrollToContent: options.scrollToContent,
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
  applyTerraformExcalidrawScene(
    app,
    setAppState,
    { elements: cloneTerraformElementsForSnapshot(snapshot.elements) },
    {
      enableDeclaredDataFlow: snapshot.enableDeclaredDataFlow,
      terraformEdgeLayerPins: snapshot.terraformEdgeLayerPins,
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
    importedTfdTexts,
    preset: session.preset,
  });
};
