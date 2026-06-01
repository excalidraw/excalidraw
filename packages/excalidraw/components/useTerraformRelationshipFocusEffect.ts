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
  getTerraformEdgeHoverPeekKeyFromHoveredIds,
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
} from "./terraformVisibility";

import type { AppClassProperties, AppState, UIAppState } from "../types";

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

  React.useEffect(() => {
    const allElements = app.scene.getElementsIncludingDeleted();
    const hoveredPeek = getTerraformEdgeHoverPeekKeyFromHoveredIds(
      allElements,
      appState.hoveredElementIds,
    );
    const terraformElement = getTerraformElementForSelection(
      elements,
      appState.selectedElementIds,
      appState.selectedGroupIds,
    );
    const selectedGraphKey =
      terraformElement && isTerraformResourceElement(terraformElement)
        ? getTerraformGraphAddressForElement(terraformElement)
        : null;
    const activeFocusNodePath = hoveredPeek || selectedGraphKey;
    const focusInputsSig = terraformFocusInputsSig(
      activeFocusNodePath,
      appState.hoveredElementIds,
      appState.selectedElementIds,
      appState.terraformEdgeLayerPins,
      appState.viewBackgroundColor,
    );
    const currentSceneSig = terraformFocusSceneSig(
      allElements,
      activeFocusNodePath,
    );
    if (
      focusInputsSig === lastTerraformFocusInputsSigRef.current &&
      currentSceneSig === lastTerraformFocusSceneSigRef.current
    ) {
      return;
    }

    const result = applyTerraformRelationshipFocus(
      allElements,
      activeFocusNodePath,
      appState.viewBackgroundColor,
    );

    const pinReconcile = buildTerraformReconcileOptionsForAppState(
      appState.terraformEdgeLayerPins,
      activeFocusNodePath,
    );
    let next = result.elements;
    if (pinReconcile) {
      next = reconcileTerraformVisibility(
        result.shouldRepairBindings ? repairTerraformEdgeBindings(next) : next,
        pinReconcile,
      );
    } else if (result.shouldRepairBindings) {
      next = repairTerraformEdgeBindings(next);
    }

    const commitFocusState = (sceneSig: string) => {
      lastTerraformFocusInputsSigRef.current = focusInputsSig;
      lastTerraformFocusSceneSigRef.current = sceneSig;
    };

    if (
      !result.didChange &&
      next.length === allElements.length &&
      next.every((element, index) => element === allElements[index])
    ) {
      commitFocusState(currentSceneSig);
      return;
    }

    if (
      !result.didChange &&
      (appState.terraformEdgeLayerPins == null ||
        terraformEdgesVisibilitySig(next) ===
          terraformEdgesVisibilitySig(allElements))
    ) {
      commitFocusState(currentSceneSig);
      return;
    }

    const nextFocusSceneSig = terraformFocusSceneSig(next, activeFocusNodePath);
    if (nextFocusSceneSig === lastTerraformFocusSceneSigRef.current) {
      commitFocusState(nextFocusSceneSig);
      return;
    }

    commitFocusState(nextFocusSceneSig);
    app.scene.replaceAllElements(next);
  }, [
    app,
    appState.hoveredElementIds,
    appState.selectedElementIds,
    appState.selectedGroupIds,
    appState.terraformEdgeLayerPins,
    appState.viewBackgroundColor,
    elements,
  ]);
}
