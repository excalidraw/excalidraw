import { newElementWith } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import { DEFAULT_LAYER_ID } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  Layer,
  LayerId,
} from "@excalidraw/element/types";

import { t } from "../i18n";

import { register } from "./register";

import type { AppClassProperties, AppState } from "../types";

/**
 * Check if moving to layer action should be enabled.
 * Requires at least one element selected and more than one layer available.
 */
const enableActionMoveToLayer = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  app: AppClassProperties,
) => {
  const selectedElements = app.scene.getSelectedElements({
    selectedElementIds: appState.selectedElementIds,
    includeBoundTextElement: true,
  });

  return selectedElements.length > 0 && appState.layers.length > 1;
};

/**
 * Action to move selected elements to a different layer.
 * The target layer ID is passed as the action value.
 */
export const actionMoveToLayer = register({
  name: "moveToLayer",
  label: "labels.moveToLayer",
  trackEvent: { category: "element" },
  perform: (elements, appState, targetLayerId, app) => {
    if (!targetLayerId || typeof targetLayerId !== "string") {
      return {
        appState,
        elements,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    // Verify target layer exists
    const targetLayer = appState.layers.find((l) => l.id === targetLayerId);
    if (!targetLayer) {
      return {
        appState,
        elements,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: true,
    });

    if (selectedElements.length === 0) {
      return {
        appState,
        elements,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const selectedElementIds = new Set(selectedElements.map((el) => el.id));

    const nextElements = elements.map((element) => {
      if (selectedElementIds.has(element.id)) {
        return newElementWith(element, {
          layerId: targetLayerId,
        });
      }
      return element;
    });

    return {
      appState,
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState, _, app) =>
    enableActionMoveToLayer(elements, appState, app),
});

/**
 * Get the layer name for a given element.
 * Returns the layer name or "Default" if element has no layer or layer not found.
 */
export const getElementLayerName = (
  element: ExcalidrawElement,
  appState: AppState,
): string => {
  if (!element.layerId) {
    // Find default layer (lowest order)
    const defaultLayer = appState.layers.reduce((min, layer) =>
      layer.order < min.order ? layer : min,
    );
    return defaultLayer?.name || t("labels.defaultLayer");
  }

  const layer = appState.layers.find((l) => l.id === element.layerId);
  return layer?.name || t("labels.defaultLayer");
};

/**
 * Get the effective layer ID for an element.
 * Returns the element's layerId or the default layer ID if not set.
 */
const getEffectiveLayerId = (
  element: ExcalidrawElement,
  layers: readonly Layer[],
): LayerId => {
  if (element.layerId) {
    return element.layerId;
  }
  // Find default layer (lowest order)
  if (layers.length === 0) {
    return DEFAULT_LAYER_ID;
  }
  return layers.reduce((min, layer) => (layer.order < min.order ? layer : min))
    .id;
};

/**
 * Check if merge selected layers action should be enabled.
 * Requires at least 2 layers selected.
 */
const enableActionMergeSelectedLayers = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const selectedCount = Object.keys(appState.selectedLayerIds).length;
  return selectedCount >= 2;
};

/**
 * Check if merge all layers action should be enabled.
 * Requires at least 2 layers to exist.
 */
const enableActionMergeAllLayers = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  return appState.layers.length >= 2;
};

/**
 * Merge layers: move all elements from source layers to target layer,
 * preserving z-order (elements from higher layers stay on top).
 *
 * @param elements - All elements in the scene
 * @param layers - All layers
 * @param layerIdsToMerge - IDs of layers to merge
 * @returns Object with updated elements and layers
 */
const performLayerMerge = (
  elements: readonly ExcalidrawElement[],
  layers: readonly Layer[],
  layerIdsToMerge: readonly LayerId[],
): {
  elements: readonly ExcalidrawElement[];
  layers: readonly Layer[];
  targetLayerId: LayerId;
} => {
  if (layerIdsToMerge.length < 2) {
    const targetLayerId =
      layerIdsToMerge[0] || layers[0]?.id || DEFAULT_LAYER_ID;
    return { elements, layers, targetLayerId };
  }

  // Get the layers to merge, sorted by order (highest first)
  const layersToMerge = layers
    .filter((layer) => layerIdsToMerge.includes(layer.id))
    .sort((a, b) => b.order - a.order);

  if (layersToMerge.length < 2) {
    const targetLayerId =
      layersToMerge[0]?.id || layers[0]?.id || DEFAULT_LAYER_ID;
    return { elements, layers, targetLayerId };
  }

  // Target layer is the topmost selected layer (highest order)
  const targetLayer = layersToMerge[0];
  const sourceLayerIds = new Set(
    layersToMerge.slice(1).map((layer) => layer.id),
  );

  // Group elements by their effective layer, maintaining their original order
  // We need to reorder elements so that elements from higher layers come after
  // elements from lower layers (since later elements render on top)

  // Create a map of layer order for quick lookup
  const layerOrderMap = new Map(layers.map((l) => [l.id, l.order]));

  // Separate elements into those being merged and those not affected
  const elementsInMergedLayers: ExcalidrawElement[] = [];
  const elementsNotInMerge: ExcalidrawElement[] = [];

  elements.forEach((element) => {
    const effectiveLayerId = getEffectiveLayerId(element, layers);
    if (
      effectiveLayerId === targetLayer.id ||
      sourceLayerIds.has(effectiveLayerId)
    ) {
      elementsInMergedLayers.push(element);
    } else {
      elementsNotInMerge.push(element);
    }
  });

  // Sort elements being merged by their layer order (lower order first, so higher order ends up on top)
  elementsInMergedLayers.sort((a, b) => {
    const aLayerId = getEffectiveLayerId(a, layers);
    const bLayerId = getEffectiveLayerId(b, layers);
    const aOrder = layerOrderMap.get(aLayerId) ?? 0;
    const bOrder = layerOrderMap.get(bLayerId) ?? 0;
    return aOrder - bOrder;
  });

  // Update elements: move source layer elements to target layer
  const updatedMergedElements = elementsInMergedLayers.map((element) => {
    const effectiveLayerId = getEffectiveLayerId(element, layers);
    if (sourceLayerIds.has(effectiveLayerId)) {
      return newElementWith(element, { layerId: targetLayer.id });
    }
    return element;
  });

  // Reconstruct elements array: non-merged elements stay in place,
  // merged elements are placed at the position of the first merged element
  // This maintains the overall stacking while grouping merged elements together
  let mergedInserted = false;
  const nextElements: ExcalidrawElement[] = [];

  elements.forEach((element) => {
    const effectiveLayerId = getEffectiveLayerId(element, layers);
    const isInMerge =
      effectiveLayerId === targetLayer.id ||
      sourceLayerIds.has(effectiveLayerId);

    if (isInMerge) {
      if (!mergedInserted) {
        // Insert all merged elements at this position
        nextElements.push(...updatedMergedElements);
        mergedInserted = true;
      }
      // Skip the original element (it's already in updatedMergedElements)
    } else {
      nextElements.push(element);
    }
  });

  // If no merged elements were in the original array, append them
  if (!mergedInserted && updatedMergedElements.length > 0) {
    nextElements.push(...updatedMergedElements);
  }

  // Remove source layers from the layers array
  const nextLayers = layers.filter((layer) => !sourceLayerIds.has(layer.id));

  return {
    elements: nextElements,
    layers: nextLayers,
    targetLayerId: targetLayer.id,
  };
};

/**
 * Action to merge selected layers into the topmost selected layer.
 * Elements from lower layers are moved to the target layer.
 * The relative z-order of elements is preserved.
 */
export const actionMergeSelectedLayers = register({
  name: "mergeSelectedLayers",
  label: "labels.mergeSelectedLayers",
  trackEvent: { category: "layer" },
  perform: (elements, appState, _, app) => {
    const selectedLayerIds = Object.keys(appState.selectedLayerIds);

    if (selectedLayerIds.length < 2) {
      return {
        appState,
        elements,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const {
      elements: nextElements,
      layers: nextLayers,
      targetLayerId,
    } = performLayerMerge(elements, appState.layers, selectedLayerIds);

    return {
      appState: {
        ...appState,
        layers: nextLayers,
        activeLayerId: targetLayerId,
        selectedLayerIds: { [targetLayerId]: true },
      },
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState) =>
    enableActionMergeSelectedLayers(elements, appState),
});

/**
 * Action to merge all layers into the topmost layer.
 * All elements are moved to the top layer while preserving z-order.
 */
export const actionMergeAllLayers = register({
  name: "mergeAllLayers",
  label: "labels.mergeAllLayers",
  trackEvent: { category: "layer" },
  perform: (elements, appState, _, app) => {
    if (appState.layers.length < 2) {
      return {
        appState,
        elements,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const allLayerIds = appState.layers.map((layer) => layer.id);
    const {
      elements: nextElements,
      layers: nextLayers,
      targetLayerId,
    } = performLayerMerge(elements, appState.layers, allLayerIds);

    return {
      appState: {
        ...appState,
        layers: nextLayers,
        activeLayerId: targetLayerId,
        selectedLayerIds: {},
      },
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (elements, appState) =>
    enableActionMergeAllLayers(elements, appState),
});
