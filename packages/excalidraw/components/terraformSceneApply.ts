import type { ExcalidrawElement } from "@excalidraw/element/types";

import { restoreElements } from "../data/restore";

import { applyTerraformRelationshipFocus } from "./terraformRelationshipFocus";
import {
  buildTerraformReconcileOptionsForAppState,
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
} from "./terraformVisibility";
import {
  terraformPlanParsingFromSources,
  type TerraformImportWarning,
  type TerraformPlanParsingSources,
} from "./terraformPlanParsing";
import { loadTerraformImportPresetSources } from "./terraformImportPresetLoader";
import {
  cloneTerraformElementsForSnapshot,
  getTerraformImportSession,
  setTerraformImportSession,
} from "./terraformImportSession";

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
          typeof (entry as BinaryFileData).id === "string" &&
          typeof (entry as BinaryFileData).dataURL === "string",
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
  importedTfdTexts?: string[];
  preset?: TerraformImportPreset | null;
  updateSession?: boolean;
  scrollToContent?: boolean;
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
  const res = await terraformPlanParsingFromSources(sources, {
    semanticLayout: options.semanticLayout,
  });
  const scene = await res.json();
  // #region agent log
  fetch("http://127.0.0.1:7923/ingest/de798ee9-b1d9-4571-a526-b10e653d3365", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "36bd3e",
    },
    body: JSON.stringify({
      sessionId: "36bd3e",
      location: "terraformSceneApply.ts:runTerraformImportFromSources",
      message: "import parse finished",
      data: {
        ok: res.ok,
        semanticLayout: options.semanticLayout,
        layoutEngine: (scene as { meta?: { layoutEngine?: string } }).meta
          ?.layoutEngine,
        elementCount: Array.isArray(
          (scene as { elements?: unknown[] }).elements,
        )
          ? (scene as { elements: unknown[] }).elements.length
          : 0,
        elkFastPath: (scene as { meta?: { elkFastPath?: boolean } }).meta
          ?.elkFastPath,
      },
      hypothesisId: "I",
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  if (!res.ok) {
    const err =
      scene && typeof scene === "object" && "error" in scene
        ? String((scene as { error?: unknown }).error)
        : "";
    throw new Error(err || "Local parse failed");
  }

  const importedTfdTexts = options.importedTfdTexts ?? [];
  const enableDeclaredDataFlow = importedTfdTexts.some((t) => t.trim());
  const { elements, terraformEdgeLayerPins } = applyTerraformExcalidrawScene(
    app,
    setAppState,
    scene as TerraformExcalidrawScenePayload,
    {
      enableDeclaredDataFlow,
      scrollToContent: options.scrollToContent,
    },
  );

  if (options.updateSession !== false) {
    setTerraformImportSession({
      sources,
      semanticLayout: options.semanticLayout,
      preset: options.preset ?? null,
      importedTfdTexts,
      snapshot: {
        elements: cloneTerraformElementsForSnapshot(elements),
        terraformEdgeLayerPins,
        enableDeclaredDataFlow,
      },
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
    importedTfdTexts,
    preset: session.preset,
  });
};
