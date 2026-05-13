import {
  isBindableElement,
  isLinearElement,
  newElementWith,
} from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import type { Scene } from "@excalidraw/element";

import type {
  ExcalidrawBindableElement,
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { LocalPoint } from "@excalidraw/math";

import {
  getTerraformGraphAddressForElement,
  isTerraformSemanticOverviewScene,
} from "./terraformElementMetadata";

import type { PointerDownState } from "../types";

/**
 * Terraform-import scene helpers: soft-hide (`isDeleted`) for filtered views, explode
 * expand/collapse for dependency neighborhoods, and edge rebind after layout changes.
 * Element `customData` is written by `packages/backend/excalidraw.js`.
 */

export type TerraformEdgeLayerPins = {
  dependency: boolean;
  dataFlow: boolean;
  networking: boolean;
};

/** Default after ELK / topology layout: all edge layers off until pins or hover reveal. */
export const TERRAFORM_IMPORT_EDGE_LAYER_PINS: TerraformEdgeLayerPins = {
  dependency: false,
  dataFlow: false,
  networking: false,
};

export type TerraformVisibilityReconcileOverrides = {
  dependencyLayerEnabled?: boolean;
  dataFlowLayerEnabled?: boolean;
  networkingLayerEnabled?: boolean;
  pins?: TerraformEdgeLayerPins;
  hoverPeekKey?: string | null;
};

/** Build reconcile overrides from editor appState (legacy when `pins` is null). */
export const buildTerraformReconcileOptionsForAppState = (
  pins: TerraformEdgeLayerPins | null,
  hoverPeekKey: string | null | undefined,
): TerraformVisibilityReconcileOverrides | undefined =>
  pins != null
    ? {
        pins,
        hoverPeekKey: hoverPeekKey ?? null,
      }
    : undefined;

const getCustomData = (element: ExcalidrawElement) => element.customData ?? {};

/** Infer pin snapshot from current edge visibility (legacy scenes, first menu interaction). */
export const inferLegacyTerraformEdgePinsFromElements = (
  elements: readonly ExcalidrawElement[],
): TerraformEdgeLayerPins => ({
  dependency: elements.some(
    (e) =>
      getTerraformEdgeLayer(e) === "dependency" &&
      !getCustomData(e).terraformDependencyPreview &&
      !e.isDeleted,
  ),
  dataFlow: elements.some(
    (e) => getTerraformEdgeLayer(e) === "dataFlow" && !e.isDeleted,
  ),
  networking: elements.some(
    (e) => getTerraformEdgeLayer(e) === "networking" && !e.isDeleted,
  ),
});

/** Graph peek key from hovered element ids (first matching Terraform address). */
export const getTerraformEdgeHoverPeekKeyFromHoveredIds = (
  elements: readonly ExcalidrawElement[],
  hoveredElementIds: Readonly<{ [id: string]: true }>,
): string | null => {
  for (const el of elements) {
    if (!hoveredElementIds[el.id] || el.isDeleted) {
      continue;
    }
    const addr = getTerraformGraphAddressForElement(el);
    if (addr) {
      return addr;
    }
  }
  return null;
};

/** `"dependency"` | `"dataFlow"` | `"networking"` for Terraform edges, or null for non-terraform edges. */
export const getTerraformEdgeLayer = (element: ExcalidrawElement) => {
  const layer = getCustomData(element).terraformEdgeLayer;
  return layer === "dependency" ||
    layer === "dataFlow" ||
    layer === "networking"
    ? layer
    : null;
};

/**
 * Stable graph id for a Terraform-backed element (`terraformVisibilityKey`, then fallbacks).
 */
export const getTerraformVisibilityKey = (element: ExcalidrawElement) => {
  const customData = getCustomData(element);
  return (
    customData.terraformVisibilityKey ||
    customData.terraformCategoryId ||
    customData.nodePath ||
    null
  );
};

/**
 * After {@link mirrorAndDetachTerraformResourceLabels}, card titles are plain text with
 * `containerId: null`, so {@link dragSelectedElements} does not move them with the rectangle.
 * Call once per drag step (after `dragSelectedElements`) so labels track the same delta as
 * their card (including snap), using `pointerDownState.originalElements` for baselines.
 */
export const syncTerraformDetachedResourceLabelsWithDraggedCards = (
  scene: Scene,
  pointerDownState: PointerDownState,
  selectedElements: readonly NonDeletedExcalidrawElement[],
): void => {
  const labelByVisibilityKey = new Map<string, NonDeletedExcalidrawElement>();
  for (const el of scene.getNonDeletedElements()) {
    if (el.type !== "text" || el.isDeleted) {
      continue;
    }
    if ("containerId" in el && el.containerId) {
      continue;
    }
    const cd = getCustomData(el);
    if (
      !cd.terraform ||
      cd.terraformVisibilityRole !== "resource" ||
      typeof cd.nodePath !== "string"
    ) {
      continue;
    }
    const key = getTerraformVisibilityKey(el);
    if (!key) {
      continue;
    }
    labelByVisibilityKey.set(key, el);
  }

  for (const element of selectedElements) {
    if (element.isDeleted || element.type !== "rectangle") {
      continue;
    }
    const cd = getCustomData(element);
    if (cd.terraformVisibilityRole !== "resource") {
      continue;
    }
    const key = getTerraformVisibilityKey(element);
    if (!key) {
      continue;
    }
    const origRect = pointerDownState.originalElements.get(element.id);
    if (!origRect) {
      continue;
    }
    const dx = element.x - origRect.x;
    const dy = element.y - origRect.y;
    if (dx === 0 && dy === 0) {
      continue;
    }
    const label = labelByVisibilityKey.get(key);
    if (!label || label.id === element.id) {
      continue;
    }
    const origLabel = pointerDownState.originalElements.get(label.id);
    if (!origLabel) {
      continue;
    }
    scene.mutateElement(label, {
      x: origLabel.x + dx,
      y: origLabel.y + dy,
    });
  }
};

// --- Element classification (roles written by the backend exporter) ---

const isTerraformGraphElement = (element: ExcalidrawElement) =>
  Boolean(getCustomData(element).terraformVisibilityRole);

const isTerraformGroupElement = (element: ExcalidrawElement) =>
  getCustomData(element).terraformVisibilityRole === "group";

const isExplodableTerraformElement = (element: ExcalidrawElement) =>
  getCustomData(element).terraformNodeKind === "category" ||
  getCustomData(element).terraformNodeKind === "resource";

const isInitiallyVisibleTerraformElement = (element: ExcalidrawElement) =>
  getCustomData(element).terraformInitiallyVisible === true;

const clearPreviewCustomData = (
  customData: ExcalidrawElement["customData"],
) => {
  const nextCustomData = { ...(customData ?? {}) };
  delete nextCustomData.terraformPreview;
  delete nextCustomData.terraformPreviewOwner;
  delete nextCustomData.terraformDependencyPreview;
  return nextCustomData;
};

// --- Explode: parent/child keys for progressive disclosure ---

const getVisibleTerraformKeys = (elements: readonly ExcalidrawElement[]) => {
  const visibleKeys = new Set<string>();
  for (const element of elements) {
    const key = getTerraformVisibilityKey(element);
    if (
      key &&
      !element.isDeleted &&
      isTerraformGraphElement(element) &&
      !isTerraformGroupElement(element)
    ) {
      visibleKeys.add(key);
    }
  }
  return visibleKeys;
};

const getTerraformParentKeys = (element: ExcalidrawElement) => {
  const customData = getCustomData(element);
  const parents = new Set<string>();

  if (typeof customData.terraformExplodeParent === "string") {
    parents.add(customData.terraformExplodeParent);
  }

  if (Array.isArray(customData.terraformExplodeParentKeys)) {
    for (const parent of customData.terraformExplodeParentKeys) {
      if (typeof parent === "string") {
        parents.add(parent);
      }
    }
  }

  return parents;
};

const getDirectChildKeys = (
  elements: readonly ExcalidrawElement[],
  parentKey: string,
) => {
  const childKeys = new Set<string>();
  for (const element of elements) {
    const key = getTerraformVisibilityKey(element);
    if (
      key &&
      isTerraformGraphElement(element) &&
      !isTerraformGroupElement(element) &&
      getTerraformParentKeys(element).has(parentKey)
    ) {
      childKeys.add(key);
    }
  }
  return childKeys;
};

const getDescendantKeys = (
  elements: readonly ExcalidrawElement[],
  parentKey: string,
) => {
  const descendants = new Set<string>();
  let didAdd = true;

  while (didAdd) {
    didAdd = false;
    for (const element of elements) {
      const key = getTerraformVisibilityKey(element);
      const parentKeys = getTerraformParentKeys(element);
      if (
        key &&
        !isTerraformGroupElement(element) &&
        !descendants.has(key) &&
        (parentKeys.has(parentKey) ||
          [...parentKeys].some((parent) => descendants.has(parent)))
      ) {
        descendants.add(key);
        didAdd = true;
      }
    }
  }

  return descendants;
};

// --- Edge visibility (endpoints must exist on screen) ---

const edgeEndpointsAreVisible = (
  element: ExcalidrawElement,
  visibleKeys: Set<string>,
) => {
  const relationship = getCustomData(element).relationship;
  return (
    typeof relationship?.source === "string" &&
    typeof relationship?.target === "string" &&
    visibleKeys.has(relationship.source) &&
    visibleKeys.has(relationship.target)
  );
};

const groupHasVisibleChild = (
  element: ExcalidrawElement,
  visibleKeys: Set<string>,
) => {
  const childKeys = getCustomData(element).terraformGroupChildKeys;
  return Boolean(
    Array.isArray(childKeys) &&
      childKeys.some((key) => typeof key === "string" && visibleKeys.has(key)),
  );
};

const deriveLayerState = (
  elements: readonly ExcalidrawElement[],
  overrides: TerraformVisibilityReconcileOverrides = {},
) => {
  if (overrides.pins != null) {
    return {
      dependencyLayerEnabled: overrides.pins.dependency,
      dataFlowLayerEnabled: overrides.pins.dataFlow,
      networkingLayerEnabled: overrides.pins.networking,
    };
  }
  return {
    dependencyLayerEnabled:
      overrides.dependencyLayerEnabled ??
      elements.some(
        (element) => getTerraformEdgeLayer(element) === "dependency",
      ),
    dataFlowLayerEnabled:
      overrides.dataFlowLayerEnabled ??
      elements.some((element) => getTerraformEdgeLayer(element) === "dataFlow"),
    networkingLayerEnabled:
      overrides.networkingLayerEnabled ??
      elements.some(
        (element) => getTerraformEdgeLayer(element) === "networking",
      ),
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getEdgePointTowardTarget = (
  pos: { x: number; y: number },
  w: number,
  h: number,
  target: { x: number; y: number },
) => {
  const cx = pos.x + w / 2;
  const cy = pos.y + h / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return {
      x: cx,
      y: cy,
      fixedPoint: [0.5, 0.5] as [number, number],
    };
  }

  const halfW = Math.max(w / 2, 1e-6);
  const halfH = Math.max(h / 2, 1e-6);
  const scale = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
  const x = cx + dx * scale;
  const y = cy + dy * scale;

  return {
    x,
    y,
    fixedPoint: [
      clamp((x - pos.x) / w, 0, 1),
      clamp((y - pos.y) / h, 0, 1),
    ] as [number, number],
  };
};

const getCenterClippedBindingPoints = (
  posA: { x: number; y: number },
  posB: { x: number; y: number },
  wA: number,
  hA: number,
  wB: number,
  hB: number,
) => {
  const centerA = { x: posA.x + wA / 2, y: posA.y + hA / 2 };
  const centerB = { x: posB.x + wB / 2, y: posB.y + hB / 2 };

  const start = getEdgePointTowardTarget(posA, wA, hA, centerB);
  const end = getEdgePointTowardTarget(posB, wB, hB, centerA);

  return {
    startPoint: { x: start.x, y: start.y },
    endPoint: { x: end.x, y: end.y },
    startFixed: [0.5, 0.5] as [number, number],
    endFixed: [0.5, 0.5] as [number, number],
  };
};

const offsetLineSegment = (
  startPoint: { x: number; y: number },
  endPoint: { x: number; y: number },
  offset: number,
) => {
  if (!offset) {
    return { startPoint, endPoint };
  }

  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = Math.hypot(dx, dy) || 1;
  const offsetX = (-dy / length) * offset;
  const offsetY = (dx / length) * offset;

  return {
    startPoint: { x: startPoint.x + offsetX, y: startPoint.y + offsetY },
    endPoint: { x: endPoint.x + offsetX, y: endPoint.y + offsetY },
  };
};

const fixedPointForAbsolutePoint = (
  rect: ExcalidrawBindableElement,
  point: { x: number; y: number },
): [number, number] => {
  const w = rect.width || 1;
  const h = rect.height || 1;
  return [
    clamp((point.x - rect.x) / w, 0, 1),
    clamp((point.y - rect.y) / h, 0, 1),
  ];
};

const isTerraformNetworkingDependencyEdge = (element: ExcalidrawElement) =>
  getTerraformEdgeLayer(element) === "networking" &&
  getCustomData(element).relationship &&
  typeof getCustomData(element).relationship === "object" &&
  (getCustomData(element).relationship as { type?: string }).type ===
    "networking_dependency";

/** Unordered pairs that have a DOT structural dependency line (generic or networking-primitive subset). */
const collectTerraformStructuralDependencyPairKeys = (
  elements: readonly ExcalidrawElement[],
) => {
  const keys = new Set<string>();
  for (const element of elements) {
    const layer = getTerraformEdgeLayer(element);
    if (
      layer !== "dependency" &&
      !(layer === "networking" && isTerraformNetworkingDependencyEdge(element))
    ) {
      continue;
    }
    const relationship = getCustomData(element).relationship;
    if (
      typeof relationship?.source === "string" &&
      typeof relationship?.target === "string"
    ) {
      keys.add([relationship.source, relationship.target].sort().join("|||"));
    }
  }
  return keys;
};

const collectTerraformResourceRects = (
  elements: readonly ExcalidrawElement[],
) => {
  const rects = new Map<string, ExcalidrawBindableElement>();
  for (const element of elements) {
    if (element.isDeleted || !isBindableElement(element)) {
      continue;
    }
    const customData = getCustomData(element);
    if (customData.terraformAwsIconGlyph === true) {
      continue;
    }
    if (customData.terraformVisibilityRole !== "resource") {
      continue;
    }
    // Detached card labels mirror `terraformVisibilityKey` / role from the rectangle
    // (`mirrorAndDetachTerraformResourceLabels`). Only **card** shapes may anchor edges;
    // otherwise the map keeps the last matching element (often text) and bindings
    // miss drags on the rectangle.
    if (element.type !== "rectangle") {
      continue;
    }
    const key = getTerraformVisibilityKey(element);
    if (key) {
      rects.set(key, element);
    }
  }
  return rects;
};

// --- Arrow geometry (mirrors backend binding math for client-side updates) ---

/**
 * Recomputes Terraform dependency / data-flow / networking edge geometry and orbit
 * bindings from current resource rectangle positions. Call after visibility toggles
 * so edges stay attached when soft-delete temporarily cleared edge bindings.
 */
export const repairTerraformEdgeBindings = (
  elements: readonly ExcalidrawElement[],
): ExcalidrawElement[] => {
  /** Legacy scenes used `line`; Excalidraw binding updates only run for `arrow`. */
  const normalizedElements = elements.map((element) => {
    if (
      getTerraformEdgeLayer(element) &&
      isLinearElement(element) &&
      element.type === "line" &&
      (element.startBinding ?? element.endBinding)
    ) {
      return newElementWith(element, { type: "arrow" });
    }
    return element;
  });

  const resourceRects = collectTerraformResourceRects(normalizedElements);
  const structuralDependencyPairKeys =
    collectTerraformStructuralDependencyPairKeys(normalizedElements);

  const boundEdgeIdsByRect = new Map<string, Set<string>>();

  const addBoundEdge = (rectId: string, edgeId: string) => {
    let set = boundEdgeIdsByRect.get(rectId);
    if (!set) {
      set = new Set();
      boundEdgeIdsByRect.set(rectId, set);
    }
    set.add(edgeId);
  };

  const updated = normalizedElements.map((element) => {
    const layer = getTerraformEdgeLayer(element);
    if (
      !layer ||
      !isLinearElement(element) ||
      element.isDeleted ||
      element.points.length < 2
    ) {
      return element;
    }

    const relationship = getCustomData(element).relationship;
    if (
      typeof relationship?.source !== "string" ||
      typeof relationship?.target !== "string"
    ) {
      return element;
    }

    const rectA = resourceRects.get(relationship.source);
    const rectB = resourceRects.get(relationship.target);
    if (!rectA || !rectB) {
      return element;
    }

    const posA = { x: rectA.x, y: rectA.y };
    const posB = { x: rectB.x, y: rectB.y };
    const wA = rectA.width;
    const hA = rectA.height;
    const wB = rectB.width;
    const hB = rectB.height;

    let startPoint: { x: number; y: number };
    let endPoint: { x: number; y: number };
    let startFixed: [number, number];
    let endFixed: [number, number];

    if (
      layer === "dependency" ||
      isTerraformNetworkingDependencyEdge(element)
    ) {
      const pts = getCenterClippedBindingPoints(posA, posB, wA, hA, wB, hB);
      startPoint = pts.startPoint;
      endPoint = pts.endPoint;
      startFixed = pts.startFixed;
      endFixed = pts.endFixed;
    } else {
      const pairKey = [relationship.source, relationship.target]
        .sort()
        .join("|||");
      const offset = structuralDependencyPairKeys.has(pairKey) ? 18 : 0;
      const raw = getCenterClippedBindingPoints(posA, posB, wA, hA, wB, hB);
      const shifted = offsetLineSegment(raw.startPoint, raw.endPoint, offset);
      startPoint = shifted.startPoint;
      endPoint = shifted.endPoint;
      startFixed = fixedPointForAbsolutePoint(rectA, shifted.startPoint);
      endFixed = fixedPointForAbsolutePoint(rectB, shifted.endPoint);
    }

    const startX = startPoint.x;
    const startY = startPoint.y;
    const endX = endPoint.x;
    const endY = endPoint.y;

    addBoundEdge(rectA.id, element.id);
    addBoundEdge(rectB.id, element.id);

    return newElementWith(element, {
      x: startX,
      y: startY,
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(endX - startX, endY - startY),
      ],
      startBinding: {
        elementId: rectA.id,
        fixedPoint: startFixed,
        mode: "orbit",
      },
      endBinding: {
        elementId: rectB.id,
        fixedPoint: endFixed,
        mode: "orbit",
      },
    });
  });

  return updated.map((element) => {
    const edgeIds = boundEdgeIdsByRect.get(element.id);
    if (!edgeIds || !isBindableElement(element)) {
      return element;
    }

    let boundElements = element.boundElements?.slice() ?? [];
    for (const edgeId of edgeIds) {
      if (!boundElements.some((entry) => entry.id === edgeId)) {
        boundElements = boundElements.concat({
          id: edgeId,
          type: "arrow",
        });
      }
    }

    return newElementWith(element, { boundElements });
  });
};

/** Applies soft-delete to edges and group wrappers based on visible resource keys and layer flags. */
export const reconcileTerraformVisibility = (
  elements: readonly ExcalidrawElement[],
  overrides: TerraformVisibilityReconcileOverrides = {},
) => {
  const visibleKeys = getVisibleTerraformKeys(elements);
  const layerState = deriveLayerState(elements, overrides);
  const semanticScene = isTerraformSemanticOverviewScene(elements);
  const pinMode = overrides.pins != null;
  const hoverPeekKey =
    pinMode && overrides.hoverPeekKey ? overrides.hoverPeekKey : null;

  return elements.map((element) => {
    if (isTerraformGroupElement(element)) {
      const shouldShow = groupHasVisibleChild(element, visibleKeys);
      if (
        element.isDeleted === !shouldShow &&
        (semanticScene || element.opacity === 100)
      ) {
        return element;
      }
      return newElementWith(element, {
        isDeleted: !shouldShow,
        ...(semanticScene ? {} : { opacity: 100 }),
        customData: clearPreviewCustomData(element.customData),
      });
    }

    const layer = getTerraformEdgeLayer(element);
    if (!layer) {
      return element;
    }

    const layerEnabled =
      layer === "dependency"
        ? layerState.dependencyLayerEnabled
        : layer === "dataFlow"
        ? layerState.dataFlowLayerEnabled
        : layerState.networkingLayerEnabled;

    const relationship = getCustomData(element).relationship as
      | { source?: unknown; target?: unknown }
      | undefined;
    const hoverTouches =
      hoverPeekKey &&
      typeof relationship?.source === "string" &&
      typeof relationship?.target === "string" &&
      (relationship.source === hoverPeekKey ||
        relationship.target === hoverPeekKey);

    const shouldShow =
      (layerEnabled || Boolean(hoverTouches)) &&
      edgeEndpointsAreVisible(element, visibleKeys);

    if (
      element.isDeleted === !shouldShow &&
      (semanticScene || element.opacity === 100)
    ) {
      return element;
    }

    return newElementWith(element, {
      isDeleted: !shouldShow,
      ...(semanticScene ? {} : { opacity: 100 }),
      customData: clearPreviewCustomData(element.customData),
    });
  });
};

/**
 * Expands or collapses dependency neighbors of a category/resource card: toggles `terraformExploded`,
 * soft-hides non-primary children when collapsing, then reconciles visibility and edge bindings.
 */
export const toggleTerraformExplode = (
  elements: readonly ExcalidrawElement[],
  triggerElement: ExcalidrawElement,
  reconcileOverrides?: TerraformVisibilityReconcileOverrides,
) => {
  if (!isExplodableTerraformElement(triggerElement)) {
    return elements;
  }

  const triggerKey = getTerraformVisibilityKey(triggerElement);
  if (!triggerKey) {
    return elements;
  }

  const directChildren = getDirectChildKeys(elements, triggerKey);
  if (directChildren.size === 0) {
    return elements;
  }

  const isExpanded = elements.some(
    (element) =>
      getTerraformVisibilityKey(element) === triggerKey &&
      getCustomData(element).terraformExploded === true,
  );
  const affectedKeys = isExpanded
    ? getDescendantKeys(elements, triggerKey)
    : directChildren;
  const expandedKeys = new Set(
    elements
      .filter((element) => getCustomData(element).terraformExploded === true)
      .map(getTerraformVisibilityKey)
      .filter((key): key is string => Boolean(key) && key !== triggerKey),
  );

  const nextElements = elements.map((element) => {
    const key = getTerraformVisibilityKey(element);
    const customData = getCustomData(element);
    const isTrigger = key === triggerKey;
    const isAffected = key && affectedKeys.has(key);
    const visibleFromAnotherExpandedParent =
      isExpanded &&
      key &&
      [...getTerraformParentKeys(element)].some(
        (parentKey) =>
          expandedKeys.has(parentKey) && !affectedKeys.has(parentKey),
      );

    if (isTrigger) {
      return newElementWith(element, {
        customData: {
          ...clearPreviewCustomData(element.customData),
          terraformExploded: !isExpanded,
        },
      });
    }

    if (isAffected) {
      return newElementWith(element, {
        isDeleted:
          isExpanded &&
          !isInitiallyVisibleTerraformElement(element) &&
          !visibleFromAnotherExpandedParent,
        opacity: 100,
        customData: {
          ...clearPreviewCustomData(element.customData),
          terraformExploded: isExpanded ? false : customData.terraformExploded,
        },
      });
    }

    return element;
  });

  return repairTerraformEdgeBindings(
    reconcileTerraformVisibility(nextElements, reconcileOverrides),
  );
};

/** Keys that appear as `terraformExplodeParent` on at least one other element (explode triggers). */
const collectTerraformParentKeysWithChildren = (
  elements: readonly ExcalidrawElement[],
) => {
  const keysWithChildren = new Set<string>();
  for (const element of elements) {
    const key = getTerraformVisibilityKey(element);
    if (!key || isTerraformGroupElement(element)) {
      continue;
    }
    for (const parentKey of getTerraformParentKeys(element)) {
      keysWithChildren.add(parentKey);
    }
  }
  return keysWithChildren;
};

/**
 * True when the scene matches the fully-expanded outcome of
 * {@link expandAllTerraformExplode} (semantic overview uses `terraformExpandAllView`;
 * module-style graphs use `terraformExploded` vs {@link collectTerraformParentKeysWithChildren}).
 */
export const isTerraformExpandAllActive = (
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (isTerraformSemanticOverviewScene(elements)) {
    let keyedResourceCount = 0;
    for (const e of elements) {
      const cd = getCustomData(e);
      if (cd.terraformVisibilityRole !== "resource") {
        continue;
      }
      const key = getTerraformVisibilityKey(e);
      if (!key) {
        continue;
      }
      keyedResourceCount++;
      if (cd.terraformExpandAllView !== true) {
        return false;
      }
    }
    return keyedResourceCount > 0;
  }

  const keysWithChildren = collectTerraformParentKeysWithChildren(elements);
  if (keysWithChildren.size === 0) {
    return false;
  }

  const keysOnResources = new Set(
    elements
      .filter((e) => getCustomData(e).terraformVisibilityRole === "resource")
      .map((e) => getTerraformVisibilityKey(e))
      .filter((k): k is string => Boolean(k)),
  );
  if (![...keysWithChildren].some((k) => keysOnResources.has(k))) {
    return false;
  }

  for (const element of elements) {
    const cd = getCustomData(element);
    if (cd.terraformVisibilityRole !== "resource") {
      continue;
    }
    const key = getTerraformVisibilityKey(element);
    if (!key) {
      continue;
    }
    const shouldExplode = keysWithChildren.has(key);
    if (Boolean(cd.terraformExploded) !== shouldExplode) {
      return false;
    }
  }

  return true;
};

/** Show every Terraform resource rectangle and mark explode triggers expanded. */
export const expandAllTerraformExplode = (
  elements: readonly ExcalidrawElement[],
  reconcileOverrides?: TerraformVisibilityReconcileOverrides,
): ExcalidrawElement[] => {
  const semanticScene = isTerraformSemanticOverviewScene(elements);
  const keysWithChildren = collectTerraformParentKeysWithChildren(elements);
  const next = elements.map((element) => {
    const customData = getCustomData(element);
    if (customData.terraformVisibilityRole !== "resource") {
      return element;
    }
    const key = getTerraformVisibilityKey(element);
    if (!key) {
      return element;
    }
    return newElementWith(element, {
      isDeleted: false,
      opacity: 100,
      customData: {
        ...clearPreviewCustomData(element.customData),
        terraformExploded: keysWithChildren.has(key),
        ...(semanticScene ? { terraformExpandAllView: true as const } : {}),
      },
    });
  });
  return repairTerraformEdgeBindings(
    reconcileTerraformVisibility(next, reconcileOverrides),
  );
};

/** Restore default visibility (primary types only) and collapse explode triggers. */
export const collapseAllTerraformExplode = (
  elements: readonly ExcalidrawElement[],
  reconcileOverrides?: TerraformVisibilityReconcileOverrides,
): ExcalidrawElement[] => {
  const semanticScene = isTerraformSemanticOverviewScene(elements);
  const next = elements.map((element) => {
    const customData = getCustomData(element);
    if (customData.terraformVisibilityRole !== "resource") {
      return element;
    }
    const key = getTerraformVisibilityKey(element);
    if (!key) {
      return element;
    }
    const shouldShow = isInitiallyVisibleTerraformElement(element);
    if (semanticScene) {
      return newElementWith(element, {
        isDeleted: false,
        opacity: 100,
        customData: {
          ...clearPreviewCustomData(element.customData),
          terraformExploded: false,
          terraformExpandAllView: false,
        },
      });
    }
    return newElementWith(element, {
      isDeleted: !shouldShow,
      opacity: 100,
      customData: {
        ...clearPreviewCustomData(element.customData),
        terraformExploded: false,
      },
    });
  });
  return repairTerraformEdgeBindings(
    reconcileTerraformVisibility(next, reconcileOverrides),
  );
};
