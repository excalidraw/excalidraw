import React from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  getTerraformGraphAddressForElement,
  isTerraformResourceElement,
} from "./terraformElementMetadata";
import { applyTerraformRelationshipFocus } from "./terraformRelationshipFocus";
import {
  getTerraformElementForSelection,
  terraformEdgesVisibilitySig,
  terraformFocusInputsSig,
  terraformFocusSceneSig,
} from "./terraformElementActionsSelection";
import {
  buildTerraformReconcileOptionsForAppState,
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
} from "./terraformVisibility";
import {
  getTerraformRuntimePerformanceSnapshot,
  isBelowTerraformRuntimeThreshold,
  subscribeTerraformRuntimePerformance,
  type TerraformRuntimePerformanceSettings,
} from "./terraformRuntimePerformance";

import type { AppClassProperties, AppState, UIAppState } from "../types";

export const buildTerraformRuntimeFocusUpdate = ({
  allElements,
  activeFocusNodePath,
  selectedElementIds,
  pins,
  viewBackgroundColor,
  skipBindingRepair,
  lastFocusInputsSig,
  lastFocusSceneSig,
}: {
  allElements: readonly NonDeletedExcalidrawElement[];
  activeFocusNodePath: string | null;
  selectedElementIds: UIAppState["selectedElementIds"];
  pins: UIAppState["terraformEdgeLayerPins"];
  viewBackgroundColor: string;
  skipBindingRepair: boolean;
  lastFocusInputsSig: string | null;
  lastFocusSceneSig: string | null;
}) => {
  const focusInputsSig = terraformFocusInputsSig(
    activeFocusNodePath,
    selectedElementIds,
    pins,
    viewBackgroundColor,
  );
  const currentSceneSig = terraformFocusSceneSig(
    allElements,
    activeFocusNodePath,
  );
  if (
    focusInputsSig === lastFocusInputsSig &&
    currentSceneSig === lastFocusSceneSig
  ) {
    return {
      elements: allElements,
      focusInputsSig,
      focusSceneSig: currentSceneSig,
      shouldReplace: false,
    };
  }

  const result = applyTerraformRelationshipFocus(
    allElements,
    activeFocusNodePath,
    viewBackgroundColor,
  );
  const pinReconcile = buildTerraformReconcileOptionsForAppState(
    pins,
    activeFocusNodePath,
  );
  const shouldRepairBindings =
    result.shouldRepairBindings && !skipBindingRepair;
  const repaired = shouldRepairBindings
    ? repairTerraformEdgeBindings(result.elements)
    : result.elements;
  const next = pinReconcile
    ? reconcileTerraformVisibility(repaired, pinReconcile)
    : repaired;
  const referencesStable =
    next.length === allElements.length &&
    next.every((element, index) => element === allElements[index]);
  const visibilityStable =
    pins == null ||
    terraformEdgesVisibilitySig(next) ===
      terraformEdgesVisibilitySig(allElements);

  if (!result.didChange && (referencesStable || visibilityStable)) {
    return {
      elements: next,
      focusInputsSig,
      focusSceneSig: currentSceneSig,
      shouldReplace: false,
    };
  }

  const nextFocusSceneSig = terraformFocusSceneSig(next, activeFocusNodePath);
  return {
    elements: next,
    focusInputsSig,
    focusSceneSig: nextFocusSceneSig,
    shouldReplace: nextFocusSceneSig !== lastFocusSceneSig,
  };
};

export function useTerraformRelationshipFocusEffect({
  app,
  appState,
  elements,
}: {
  app: AppClassProperties;
  appState: UIAppState;
  elements: readonly NonDeletedExcalidrawElement[];
  setAppState: React.Component<any, AppState>["setState"];
}) {
  const lastTerraformFocusSceneSigRef = React.useRef<string | null>(null);
  const lastTerraformFocusInputsSigRef = React.useRef<string | null>(null);
  const runtimeSnapshot = React.useSyncExternalStore(
    subscribeTerraformRuntimePerformance,
    getTerraformRuntimePerformanceSnapshot,
    getTerraformRuntimePerformanceSnapshot,
  );
  const allElements = app.scene.getElementsIncludingDeleted();

  React.useEffect(() => {
    const terraformElement = getTerraformElementForSelection(
      elements,
      appState.selectedElementIds,
      appState.selectedGroupIds,
    );
    const selectedGraphKey =
      terraformElement && isTerraformResourceElement(terraformElement)
        ? getTerraformGraphAddressForElement(terraformElement)
        : null;
    // Relationship focus is driven by selection (click), not hover: hovering
    // re-washed ~93% of elements on every pointer move, busting render caches
    // and stalling the canvas during rapid hover + pan. See
    // docs/terraform-canvas-hover-unrender-investigation.md.
    const activeFocusNodePath = selectedGraphKey;
    const update = buildTerraformRuntimeFocusUpdate({
      allElements,
      activeFocusNodePath,
      selectedElementIds: appState.selectedElementIds,
      pins: appState.terraformEdgeLayerPins,
      viewBackgroundColor: appState.viewBackgroundColor,
      skipBindingRepair: runtimeSnapshot.value.skipBindingRepairDuringFocus,
      lastFocusInputsSig: lastTerraformFocusInputsSigRef.current,
      lastFocusSceneSig: lastTerraformFocusSceneSigRef.current,
    });
    lastTerraformFocusInputsSigRef.current = update.focusInputsSig;
    lastTerraformFocusSceneSigRef.current = update.focusSceneSig;
    if (update.shouldReplace) {
      app.scene.replaceAllElements(update.elements);
    }
  }, [
    allElements,
    app,
    appState.selectedElementIds,
    appState.selectedGroupIds,
    appState.terraformEdgeLayerPins,
    appState.viewBackgroundColor,
    elements,
    runtimeSnapshot.version,
    runtimeSnapshot.value.skipBindingRepairDuringFocus,
  ]);
}

export const resolveTerraformEffectiveFocusKey = ({
  hoveredGraphKey,
  selectedGraphKey,
  zoom,
  settings,
}: {
  hoveredGraphKey: string | null;
  selectedGraphKey: string | null;
  zoom: number;
  settings: TerraformRuntimePerformanceSettings;
}) => {
  const effectiveHover =
    settings.suppressHoverFocusBelowZoom &&
    isBelowTerraformRuntimeThreshold(zoom, settings)
      ? null
      : hoveredGraphKey;
  return effectiveHover || selectedGraphKey;
};
