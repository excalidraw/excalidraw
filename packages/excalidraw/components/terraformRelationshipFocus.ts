import { newElementWith } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  getTerraformGraphAddressForElement,
  isTerraformGroupElement,
  isTerraformLayerEdge,
  isTerraformResourceElement,
  isTerraformSemanticOverviewScene,
} from "./terraformElementMetadata";
import {
  dimmedTerraformElementOverrides,
  restoredTerraformElementOverrides,
} from "./terraformColorWash";
import {
  isTerraformExpandAllActive,
  getTerraformVisibilityKey,
  repairTerraformEdgeBindings,
} from "./terraformVisibility";

/**
 * Semantic dim levels (0–100). Identical numeric scale to the legacy `opacity` knobs
 * but applied as a color-wash factor (`1 - level / 100`) by `terraformColorWash`,
 * so dimmed elements still fully cover what's behind them on canvas. `level === 100`
 * means "no dimming" (and triggers a restore of any previously stashed colors).
 */
const TERRAFORM_FOCUS_NODE_LEVEL = 100;
const TERRAFORM_RELATED_LEVEL = 85;
/** Multi-hop focus: nodes two-plus hops out along the dataflow path. */
const TERRAFORM_RELATED_FAR_LEVEL = 55;
const TERRAFORM_CONTAINER_LEVEL = 60;
const TERRAFORM_DIM_NODE_LEVEL = 25;
const TERRAFORM_DIM_EDGE_LEVEL = 15;

/** Hops of dataflow neighborhood revealed on hover focus (degree-of-interest). */
const TERRAFORM_FOCUS_MAX_HOPS = 3;

/** Greyed dependency / data-flow edges when no node is focused. */
const TERRAFORM_AMBIENT_EDGE_LEVEL = 22;
/** Collapsed overview: non-primary resource cards. */
const TERRAFORM_AMBIENT_NON_PRIMARY_NODE_LEVEL = 35;
/** Collapsed overview: primary resource cards (see `terraformInitiallyVisible`). */
const TERRAFORM_AMBIENT_PRIMARY_NODE_LEVEL = 100;
/** Collapsed overview: account/region/VPC/module frame rectangles. */
const TERRAFORM_AMBIENT_GROUP_LEVEL = 68;

const DEFAULT_VIEW_BACKGROUND_COLOR = "#ffffff";

const getRelationship = (element: ExcalidrawElement) =>
  element.customData?.relationship &&
  typeof element.customData.relationship === "object"
    ? element.customData.relationship
    : null;

const getRelationshipEndpoints = (element: ExcalidrawElement) => {
  const relationship = getRelationship(element);
  const source =
    typeof relationship?.source === "string" ? relationship.source : null;
  const target =
    typeof relationship?.target === "string" ? relationship.target : null;

  return source && target ? { source, target } : null;
};

const getDirectionEndpointHints = (element: ExcalidrawElement) => {
  const relationship = getRelationship(element);
  if (!Array.isArray(relationship?.directions)) {
    return [];
  }

  return (relationship.directions as unknown[])
    .map((direction) => {
      if (!direction || typeof direction !== "object") {
        return null;
      }
      const entry = direction as { source?: unknown; target?: unknown };
      const source = typeof entry.source === "string" ? entry.source : null;
      const target = typeof entry.target === "string" ? entry.target : null;
      return source && target ? { source, target } : null;
    })
    .filter((direction): direction is { source: string; target: string } =>
      Boolean(direction),
    );
};

/**
 * Bound label text may omit `nodePath` while its container card has it. Without the
 * same address as the rectangle, related-node reveal leaves the label soft-deleted and
 * it never renders (`getBoundTextElement` only sees non-deleted elements).
 */
const resolveTerraformFocusNodePath = (
  element: ExcalidrawElement,
  elementById: ReadonlyMap<string, ExcalidrawElement>,
): string | null => {
  const own = getTerraformGraphAddressForElement(element);
  if (own) {
    return own;
  }
  if (
    element.type === "text" &&
    "containerId" in element &&
    typeof element.containerId === "string" &&
    element.containerId
  ) {
    return getTerraformGraphAddressForElement(
      elementById.get(element.containerId),
    );
  }
  return null;
};

const isTerraformResourceLikeElement = (
  element: ExcalidrawElement,
  elementById?: ReadonlyMap<string, ExcalidrawElement>,
) => {
  if (
    element.customData?.terraformVisibilityRole === "resource" ||
    isTerraformResourceElement(element)
  ) {
    return true;
  }
  if (
    elementById &&
    element.type === "text" &&
    "containerId" in element &&
    typeof element.containerId === "string" &&
    element.containerId
  ) {
    const container = elementById.get(element.containerId);
    return Boolean(
      container &&
        (container.customData?.terraformVisibilityRole === "resource" ||
          isTerraformResourceElement(container)),
    );
  }
  return false;
};

const isTerraformFocusManagedElement = (
  element: ExcalidrawElement,
  elementById?: ReadonlyMap<string, ExcalidrawElement>,
) =>
  isTerraformLayerEdge(element) ||
  isTerraformResourceLikeElement(element, elementById) ||
  isTerraformGroupElement(element);

const isParentGroupOfFocusedNode = (
  element: ExcalidrawElement,
  focusedNodePaths: Set<string>,
) => {
  const childKeys = element.customData?.terraformGroupChildKeys;
  return Boolean(
    Array.isArray(childKeys) &&
      childKeys.some(
        (key) => typeof key === "string" && focusedNodePaths.has(key),
      ),
  );
};

type PreviewAction = "set" | "clear" | "leave";

/**
 * Builds the wash + opacity + customData patch for one focus update step. Returns
 * `null` when nothing would change so the caller can keep the original reference.
 *
 * - `level >= 100` → restore stashed originals (if any) and ensure `opacity: 100`.
 * - `level < 100`  → blend stroke / background toward `viewBackgroundColor` and
 *   stash the originals under `customData.terraformDimmedOriginals`.
 * - `previewAction` toggles `customData.terraformFocusPreview` independently.
 */
const buildTerraformFocusUpdate = (
  element: ExcalidrawElement,
  level: number,
  nextIsDeleted: boolean,
  previewAction: PreviewAction,
  viewBackgroundColor: string,
): ExcalidrawElement | null => {
  const washPatch =
    level >= 100
      ? restoredTerraformElementOverrides(element)
      : dimmedTerraformElementOverrides(element, level, viewBackgroundColor);

  let nextCustomData: Record<string, any> = washPatch
    ? { ...washPatch.customData }
    : { ...(element.customData ?? {}) };

  if (previewAction === "set") {
    if (nextCustomData.terraformFocusPreview !== true) {
      nextCustomData = {
        ...nextCustomData,
        terraformFocusPreview: true,
      };
    }
  } else if (previewAction === "clear") {
    if (nextCustomData.terraformFocusPreview !== undefined) {
      nextCustomData = { ...nextCustomData };
      delete nextCustomData.terraformFocusPreview;
    }
  }

  const opacityChanged = element.opacity !== 100;
  const isDeletedChanged = element.isDeleted !== nextIsDeleted;
  const colorsChanged = washPatch !== null;
  const prevPreview = element.customData?.terraformFocusPreview === true;
  const nextPreview = nextCustomData.terraformFocusPreview === true;
  const previewChanged = prevPreview !== nextPreview;

  if (
    !opacityChanged &&
    !isDeletedChanged &&
    !colorsChanged &&
    !previewChanged
  ) {
    return null;
  }

  return newElementWith(element, {
    isDeleted: nextIsDeleted,
    opacity: 100,
    customData: nextCustomData,
    ...(washPatch
      ? {
          strokeColor: washPatch.strokeColor,
          backgroundColor: washPatch.backgroundColor,
          fillStyle: washPatch.fillStyle,
        }
      : {}),
  });
};

/**
 * Bounded BFS over the dataflow/dependency edge graph from the focused node,
 * up to {@link TERRAFORM_FOCUS_MAX_HOPS}. Returns the reachable neighborhood
 * (with per-node hop distance for degree-of-interest dimming) and every edge
 * whose endpoints both fall inside that neighborhood, so a multi-hop path
 * (org → account → trunk → API → datastore) lights up on hover, not just one hop.
 */
export const getTerraformRelationshipFocus = (
  allElements: readonly ExcalidrawElement[],
  focusNodePath: string | null,
  maxHops: number = TERRAFORM_FOCUS_MAX_HOPS,
) => {
  const focusedNodePaths = new Set<string>();
  const relatedNodePaths = new Set<string>();
  const focusedEdgeIds = new Set<string>();
  // Edges between the focus and a direct (1-hop) neighbor. Only these gate the
  // reveal of soft-deleted elements; revealing the full multi-hop neighborhood
  // would fight the collapsed-overview visibility reconciler and never settle.
  const nearEdgeIds = new Set<string>();
  const nodeDistance = new Map<string, number>();

  if (!focusNodePath) {
    return {
      focusedNodePaths,
      relatedNodePaths,
      focusedEdgeIds,
      nearEdgeIds,
      nodeDistance,
    };
  }

  // Undirected adjacency from layer edges (follow flow both up and downstream).
  const adjacency = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    (adjacency.get(a) ?? adjacency.set(a, new Set()).get(a)!).add(b);
    (adjacency.get(b) ?? adjacency.set(b, new Set()).get(b)!).add(a);
  };
  for (const element of allElements) {
    if (!isTerraformLayerEdge(element)) {
      continue;
    }
    const endpoints = getRelationshipEndpoints(element);
    if (endpoints) {
      link(endpoints.source, endpoints.target);
    }
    for (const direction of getDirectionEndpointHints(element)) {
      link(direction.source, direction.target);
    }
  }

  // BFS to assign hop distances within the budget.
  nodeDistance.set(focusNodePath, 0);
  focusedNodePaths.add(focusNodePath);
  let frontier = [focusNodePath];
  for (let hop = 1; hop <= maxHops && frontier.length > 0; hop++) {
    const next: string[] = [];
    for (const node of frontier) {
      for (const neighbor of adjacency.get(node) ?? []) {
        if (nodeDistance.has(neighbor)) {
          continue;
        }
        nodeDistance.set(neighbor, hop);
        focusedNodePaths.add(neighbor);
        relatedNodePaths.add(neighbor);
        next.push(neighbor);
      }
    }
    frontier = next;
  }

  // Light every edge whose endpoints are both inside the focused neighborhood.
  for (const element of allElements) {
    if (!isTerraformLayerEdge(element)) {
      continue;
    }
    const isNear = (a: string, b: string) =>
      (nodeDistance.get(a) ?? 99) <= 1 && (nodeDistance.get(b) ?? 99) <= 1;
    const endpoints = getRelationshipEndpoints(element);
    if (
      endpoints &&
      nodeDistance.has(endpoints.source) &&
      nodeDistance.has(endpoints.target)
    ) {
      focusedEdgeIds.add(element.id);
      if (isNear(endpoints.source, endpoints.target)) {
        nearEdgeIds.add(element.id);
      }
      continue;
    }
    for (const direction of getDirectionEndpointHints(element)) {
      if (
        nodeDistance.has(direction.source) &&
        nodeDistance.has(direction.target)
      ) {
        focusedEdgeIds.add(element.id);
        if (isNear(direction.source, direction.target)) {
          nearEdgeIds.add(element.id);
        }
        break;
      }
    }
  }

  return {
    focusedNodePaths,
    relatedNodePaths,
    focusedEdgeIds,
    nearEdgeIds,
    nodeDistance,
  };
};

export const applyTerraformRelationshipFocus = (
  allElements: readonly ExcalidrawElement[],
  focusNodePath: string | null,
  viewBackgroundColor: string = DEFAULT_VIEW_BACKGROUND_COLOR,
) => {
  const {
    focusedNodePaths,
    relatedNodePaths,
    focusedEdgeIds,
    nearEdgeIds,
    nodeDistance,
  } = getTerraformRelationshipFocus(allElements, focusNodePath);
  const elementById = new Map(allElements.map((e) => [e.id, e]));
  const duplicateHighlightCanonical = (() => {
    if (!focusNodePath) {
      return null as string | null;
    }
    for (const el of allElements) {
      if (el.isDeleted) {
        continue;
      }
      const cd = el.customData ?? {};
      if (
        getTerraformVisibilityKey(el) === focusNodePath &&
        cd.terraformSemanticLayoutDuplicate === true
      ) {
        return resolveTerraformFocusNodePath(el, elementById);
      }
    }
    return null;
  })();
  let didChange = false;

  const trackChange = (
    element: ExcalidrawElement,
    updated: ExcalidrawElement | null,
  ) => {
    if (updated) {
      didChange = true;
      return updated;
    }
    return element;
  };

  const nextElements = allElements.map((element) => {
    const isFocusActive = focusNodePath !== null;
    const isPreview = element.customData?.terraformFocusPreview === true;

    if (!isFocusActive) {
      if (isPreview) {
        return trackChange(
          element,
          buildTerraformFocusUpdate(
            element,
            TERRAFORM_FOCUS_NODE_LEVEL,
            true,
            "clear",
            viewBackgroundColor,
          ),
        );
      }

      if (!isTerraformFocusManagedElement(element, elementById)) {
        return element;
      }

      if (!isTerraformSemanticOverviewScene(allElements)) {
        return trackChange(
          element,
          buildTerraformFocusUpdate(
            element,
            TERRAFORM_FOCUS_NODE_LEVEL,
            element.isDeleted,
            "clear",
            viewBackgroundColor,
          ),
        );
      }

      if (element.isDeleted) {
        return element;
      }

      const expandAllView = isTerraformExpandAllActive(allElements);

      if (isTerraformLayerEdge(element)) {
        return trackChange(
          element,
          buildTerraformFocusUpdate(
            element,
            TERRAFORM_AMBIENT_EDGE_LEVEL,
            element.isDeleted,
            "clear",
            viewBackgroundColor,
          ),
        );
      }

      if (isTerraformResourceLikeElement(element, elementById)) {
        const isPrimary =
          element.customData?.terraformInitiallyVisible === true;
        const isBoundTerraformLabel =
          element.type === "text" &&
          "containerId" in element &&
          Boolean(element.containerId);
        const nextLevel = isBoundTerraformLabel
          ? TERRAFORM_FOCUS_NODE_LEVEL
          : expandAllView || isPrimary
          ? TERRAFORM_AMBIENT_PRIMARY_NODE_LEVEL
          : TERRAFORM_AMBIENT_NON_PRIMARY_NODE_LEVEL;
        return trackChange(
          element,
          buildTerraformFocusUpdate(
            element,
            nextLevel,
            element.isDeleted,
            "clear",
            viewBackgroundColor,
          ),
        );
      }

      if (isTerraformGroupElement(element)) {
        return trackChange(
          element,
          buildTerraformFocusUpdate(
            element,
            TERRAFORM_AMBIENT_GROUP_LEVEL,
            element.isDeleted,
            "clear",
            viewBackgroundColor,
          ),
        );
      }

      return element;
    }

    if (isTerraformLayerEdge(element)) {
      const isFocusedEdge = focusedEdgeIds.has(element.id);
      const nextLevel = isFocusedEdge
        ? TERRAFORM_RELATED_LEVEL
        : TERRAFORM_DIM_EDGE_LEVEL;
      // Reveal only direct (1-hop) edges; deeper neighborhood edges light when
      // already visible but are never un-deleted (keeps collapsed overview stable).
      const shouldReveal = nearEdgeIds.has(element.id) && element.isDeleted;
      const shouldHideExpiredPreview = !isFocusedEdge && isPreview;
      const nextIsDeleted = shouldHideExpiredPreview
        ? true
        : shouldReveal
        ? false
        : element.isDeleted;
      const previewAction: PreviewAction = shouldHideExpiredPreview
        ? "clear"
        : shouldReveal
        ? "set"
        : "leave";

      return trackChange(
        element,
        buildTerraformFocusUpdate(
          element,
          nextLevel,
          nextIsDeleted,
          previewAction,
          viewBackgroundColor,
        ),
      );
    }

    if (isTerraformResourceLikeElement(element, elementById)) {
      const nodePath = resolveTerraformFocusNodePath(element, elementById);
      const vis = getTerraformVisibilityKey(element);
      const isFocusLayout = vis === focusNodePath;
      const isCoDuplicate =
        duplicateHighlightCanonical != null &&
        nodePath === duplicateHighlightCanonical &&
        element.customData?.terraformSemanticLayoutDuplicate === true &&
        !isFocusLayout;
      const isFocusNode =
        isFocusLayout ||
        (nodePath === focusNodePath && duplicateHighlightCanonical == null);
      const isRelatedNode = Boolean(nodePath && relatedNodePaths.has(nodePath));
      // Degree-of-interest falloff: 1 hop reads as related, 2+ hops are dimmer
      // but still legible, so a multi-hop path stays traceable without flooding.
      const hopDistance = nodePath ? nodeDistance.get(nodePath) : undefined;
      const relatedLevel =
        hopDistance != null && hopDistance >= 2
          ? TERRAFORM_RELATED_FAR_LEVEL
          : TERRAFORM_RELATED_LEVEL;
      const cardLevel = isFocusNode
        ? TERRAFORM_FOCUS_NODE_LEVEL
        : isCoDuplicate
        ? TERRAFORM_RELATED_LEVEL
        : isRelatedNode
        ? relatedLevel
        : TERRAFORM_DIM_NODE_LEVEL;
      // Bound labels share the same dimming as their card and become unreadable when
      // washed toward white. Keep label text at full color so resource names stay
      // visible during hover focus.
      const isBoundTerraformLabel =
        element.type === "text" &&
        "containerId" in element &&
        Boolean(element.containerId);
      const nextLevel = isBoundTerraformLabel
        ? TERRAFORM_FOCUS_NODE_LEVEL
        : cardLevel;
      // Reveal only the focus and its direct (1-hop) neighbors; nodes deeper in
      // the multi-hop neighborhood are dimmed by falloff but never un-deleted.
      const isNearRelated = isRelatedNode && (hopDistance ?? 99) <= 1;
      const shouldReveal =
        (isFocusNode || isCoDuplicate || isNearRelated) && element.isDeleted;
      const shouldHideExpiredPreview =
        !isFocusNode && !isCoDuplicate && !isNearRelated && isPreview;
      const nextIsDeleted = shouldHideExpiredPreview
        ? true
        : shouldReveal
        ? false
        : element.isDeleted;
      const previewAction: PreviewAction = shouldHideExpiredPreview
        ? "clear"
        : shouldReveal
        ? "set"
        : "leave";

      return trackChange(
        element,
        buildTerraformFocusUpdate(
          element,
          nextLevel,
          nextIsDeleted,
          previewAction,
          viewBackgroundColor,
        ),
      );
    }

    if (isTerraformGroupElement(element)) {
      const isFocusedParent = isParentGroupOfFocusedNode(
        element,
        focusedNodePaths,
      );
      const nextLevel = isFocusedParent
        ? TERRAFORM_CONTAINER_LEVEL
        : TERRAFORM_DIM_NODE_LEVEL;
      const shouldReveal = isFocusedParent && element.isDeleted;
      const shouldHideExpiredPreview = !isFocusedParent && isPreview;
      const nextIsDeleted = shouldHideExpiredPreview
        ? true
        : shouldReveal
        ? false
        : element.isDeleted;
      const previewAction: PreviewAction = shouldHideExpiredPreview
        ? "clear"
        : shouldReveal
        ? "set"
        : "leave";

      return trackChange(
        element,
        buildTerraformFocusUpdate(
          element,
          nextLevel,
          nextIsDeleted,
          previewAction,
          viewBackgroundColor,
        ),
      );
    }

    return element;
  });

  return { elements: nextElements, didChange, shouldRepairBindings: didChange };
};

/** Clear transient focus wash / preview flags and rebind edges after reload. */
export const stabilizeTerraformSceneAfterPersistence = (
  elements: readonly ExcalidrawElement[],
  viewBackgroundColor = "#ffffff",
): ExcalidrawElement[] => {
  const { elements: cleared } = applyTerraformRelationshipFocus(
    elements,
    null,
    viewBackgroundColor,
  );
  return repairTerraformEdgeBindings(cleared);
};
