import { newElementWith } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  isTerraformGroupElement,
  isTerraformLayerEdge,
  isTerraformResourceElement,
} from "./terraformElementMetadata";

const TERRAFORM_FOCUS_NODE_OPACITY = 100;
const TERRAFORM_RELATED_OPACITY = 85;
const TERRAFORM_CONTAINER_OPACITY = 60;
const TERRAFORM_DIM_NODE_OPACITY = 25;
const TERRAFORM_DIM_EDGE_OPACITY = 15;

const clearTerraformFocusPreviewData = (
  customData: ExcalidrawElement["customData"],
) => {
  const nextCustomData = { ...(customData ?? {}) };
  delete nextCustomData.terraformFocusPreview;
  return nextCustomData;
};

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

const getRelatedNodePathsForEdge = (
  element: ExcalidrawElement,
  focusNodePath: string,
) => {
  const relatedNodePaths = new Set<string>();
  const endpoints = getRelationshipEndpoints(element);

  if (endpoints?.source === focusNodePath) {
    relatedNodePaths.add(endpoints.target);
  }
  if (endpoints?.target === focusNodePath) {
    relatedNodePaths.add(endpoints.source);
  }

  if (relatedNodePaths.size > 0) {
    return relatedNodePaths;
  }

  for (const direction of getDirectionEndpointHints(element)) {
    if (direction.source === focusNodePath) {
      relatedNodePaths.add(direction.target);
    }
    if (direction.target === focusNodePath) {
      relatedNodePaths.add(direction.source);
    }
  }

  return relatedNodePaths;
};

const getTerraformNodePath = (element: ExcalidrawElement) =>
  typeof element.customData?.nodePath === "string"
    ? element.customData.nodePath
    : null;

/** Graph address for focus / edges (`nodePath`, else `terraformVisibilityKey`). */
const readTerraformGraphAddress = (
  element: ExcalidrawElement | undefined,
): string | null => {
  if (!element?.customData) {
    return null;
  }
  const cd = element.customData;
  if (typeof cd.nodePath === "string" && cd.nodePath.length > 0) {
    return cd.nodePath;
  }
  if (
    typeof cd.terraformVisibilityKey === "string" &&
    cd.terraformVisibilityKey.length > 0
  ) {
    return cd.terraformVisibilityKey;
  }
  return null;
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
  const own = readTerraformGraphAddress(element);
  if (own) {
    return own;
  }
  if (
    element.type === "text" &&
    "containerId" in element &&
    typeof element.containerId === "string" &&
    element.containerId
  ) {
    return readTerraformGraphAddress(elementById.get(element.containerId));
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

const getFocusPreviewCustomData = (
  element: ExcalidrawElement,
  shouldReveal: boolean,
  shouldHideExpiredPreview: boolean,
) => {
  if (shouldHideExpiredPreview) {
    return clearTerraformFocusPreviewData(element.customData);
  }
  if (shouldReveal) {
    return {
      ...(element.customData ?? {}),
      terraformFocusPreview: true,
    };
  }
  return element.customData;
};

export const getTerraformRelationshipFocus = (
  allElements: readonly ExcalidrawElement[],
  focusNodePath: string | null,
) => {
  const focusedNodePaths = new Set<string>();
  const relatedNodePaths = new Set<string>();
  const focusedEdgeIds = new Set<string>();

  if (!focusNodePath) {
    return { focusedNodePaths, relatedNodePaths, focusedEdgeIds };
  }

  focusedNodePaths.add(focusNodePath);

  for (const element of allElements) {
    if (!isTerraformLayerEdge(element)) {
      continue;
    }

    const edgeRelatedNodePaths = getRelatedNodePathsForEdge(
      element,
      focusNodePath,
    );
    if (edgeRelatedNodePaths.size === 0) {
      continue;
    }

    focusedEdgeIds.add(element.id);
    for (const nodePath of edgeRelatedNodePaths) {
      relatedNodePaths.add(nodePath);
      focusedNodePaths.add(nodePath);
    }
  }

  return { focusedNodePaths, relatedNodePaths, focusedEdgeIds };
};

export const applyTerraformRelationshipFocus = (
  allElements: readonly ExcalidrawElement[],
  focusNodePath: string | null,
) => {
  const { focusedNodePaths, relatedNodePaths, focusedEdgeIds } =
    getTerraformRelationshipFocus(allElements, focusNodePath);
  const elementById = new Map(allElements.map((e) => [e.id, e]));
  let didChange = false;

  const nextElements = allElements.map((element) => {
    const isFocusActive = focusNodePath !== null;
    const isPreview = element.customData?.terraformFocusPreview === true;

    if (!isFocusActive) {
      if (
        isPreview ||
        (isTerraformFocusManagedElement(element, elementById) &&
          element.opacity !== 100)
      ) {
        didChange = true;
        return newElementWith(element, {
          isDeleted: isPreview ? true : element.isDeleted,
          opacity: 100,
          customData: clearTerraformFocusPreviewData(element.customData),
        });
      }
      return element;
    }

    if (isTerraformLayerEdge(element)) {
      const isFocusedEdge = focusedEdgeIds.has(element.id);
      const nextOpacity = isFocusedEdge
        ? TERRAFORM_RELATED_OPACITY
        : TERRAFORM_DIM_EDGE_OPACITY;
      const shouldReveal = isFocusedEdge && element.isDeleted;
      const shouldHideExpiredPreview = !isFocusedEdge && isPreview;
      const nextIsDeleted = shouldHideExpiredPreview
        ? true
        : shouldReveal
        ? false
        : element.isDeleted;
      const nextCustomData = getFocusPreviewCustomData(
        element,
        shouldReveal,
        shouldHideExpiredPreview,
      );

      if (
        element.opacity === nextOpacity &&
        element.isDeleted === nextIsDeleted &&
        !shouldReveal &&
        !shouldHideExpiredPreview
      ) {
        return element;
      }

      didChange = true;
      return newElementWith(element, {
        isDeleted: nextIsDeleted,
        opacity: nextOpacity,
        customData: nextCustomData,
      });
    }

    if (isTerraformResourceLikeElement(element, elementById)) {
      const nodePath = resolveTerraformFocusNodePath(element, elementById);
      const isFocusNode = nodePath === focusNodePath;
      const isRelatedNode = Boolean(nodePath && relatedNodePaths.has(nodePath));
      const cardOpacity = isFocusNode
        ? TERRAFORM_FOCUS_NODE_OPACITY
        : isRelatedNode
          ? TERRAFORM_RELATED_OPACITY
          : TERRAFORM_DIM_NODE_OPACITY;
      // Bound labels share the same dimming as their card and become unreadable at 25%.
      // Keep label text at full opacity so resource names stay visible during hover focus.
      const isBoundTerraformLabel =
        element.type === "text" &&
        "containerId" in element &&
        Boolean(element.containerId);
      const nextOpacity = isBoundTerraformLabel
        ? TERRAFORM_FOCUS_NODE_OPACITY
        : cardOpacity;
      const shouldReveal = (isFocusNode || isRelatedNode) && element.isDeleted;
      const shouldHideExpiredPreview =
        !isFocusNode && !isRelatedNode && isPreview;
      const nextIsDeleted = shouldHideExpiredPreview
        ? true
        : shouldReveal
        ? false
        : element.isDeleted;
      const nextCustomData = getFocusPreviewCustomData(
        element,
        shouldReveal,
        shouldHideExpiredPreview,
      );

      if (
        element.opacity === nextOpacity &&
        element.isDeleted === nextIsDeleted &&
        !shouldReveal &&
        !shouldHideExpiredPreview
      ) {
        return element;
      }

      didChange = true;
      return newElementWith(element, {
        isDeleted: nextIsDeleted,
        opacity: nextOpacity,
        customData: nextCustomData,
      });
    }

    if (isTerraformGroupElement(element)) {
      const isFocusedParent = isParentGroupOfFocusedNode(
        element,
        focusedNodePaths,
      );
      const nextOpacity = isFocusedParent
        ? TERRAFORM_CONTAINER_OPACITY
        : TERRAFORM_DIM_NODE_OPACITY;
      const shouldReveal = isFocusedParent && element.isDeleted;
      const shouldHideExpiredPreview = !isFocusedParent && isPreview;
      const nextIsDeleted = shouldHideExpiredPreview
        ? true
        : shouldReveal
        ? false
        : element.isDeleted;
      const nextCustomData = getFocusPreviewCustomData(
        element,
        shouldReveal,
        shouldHideExpiredPreview,
      );

      if (
        element.opacity === nextOpacity &&
        element.isDeleted === nextIsDeleted &&
        !shouldReveal &&
        !shouldHideExpiredPreview
      ) {
        return element;
      }

      didChange = true;
      return newElementWith(element, {
        isDeleted: nextIsDeleted,
        opacity: nextOpacity,
        customData: nextCustomData,
      });
    }

    return element;
  });

  return { elements: nextElements, didChange, shouldRepairBindings: didChange };
};
