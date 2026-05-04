import { newElementWith } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

type TerraformLayerState = {
  dependencyLayerEnabled?: boolean;
  dataFlowLayerEnabled?: boolean;
};

const getCustomData = (element: ExcalidrawElement) => element.customData ?? {};

export const getTerraformEdgeLayer = (element: ExcalidrawElement) => {
  const layer = getCustomData(element).terraformEdgeLayer;
  return layer === "dependency" || layer === "dataFlow" ? layer : null;
};

export const getTerraformVisibilityKey = (element: ExcalidrawElement) => {
  const customData = getCustomData(element);
  return (
    customData.terraformVisibilityKey ||
    customData.terraformCategoryId ||
    customData.nodePath ||
    null
  );
};

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
  overrides: TerraformLayerState = {},
) => ({
  dependencyLayerEnabled:
    overrides.dependencyLayerEnabled ??
    elements.some((element) => getTerraformEdgeLayer(element) === "dependency"),
  dataFlowLayerEnabled:
    overrides.dataFlowLayerEnabled ??
    elements.some((element) => getTerraformEdgeLayer(element) === "dataFlow"),
});

const reconcileTerraformVisibility = (
  elements: readonly ExcalidrawElement[],
  overrides: TerraformLayerState = {},
) => {
  const visibleKeys = getVisibleTerraformKeys(elements);
  const layerState = deriveLayerState(elements, overrides);

  return elements.map((element) => {
    if (isTerraformGroupElement(element)) {
      const shouldShow = groupHasVisibleChild(element, visibleKeys);
      if (element.isDeleted === !shouldShow && element.opacity === 100) {
        return element;
      }
      return newElementWith(element, {
        isDeleted: !shouldShow,
        opacity: 100,
        customData: clearPreviewCustomData(element.customData),
      });
    }

    const layer = getTerraformEdgeLayer(element);
    if (!layer) {
      return element;
    }

    const shouldShow =
      (layer === "dependency"
        ? layerState.dependencyLayerEnabled
        : layerState.dataFlowLayerEnabled) &&
      edgeEndpointsAreVisible(element, visibleKeys);

    if (element.isDeleted === !shouldShow && element.opacity === 100) {
      return element;
    }

    return newElementWith(element, {
      isDeleted: !shouldShow,
      opacity: 100,
      customData: clearPreviewCustomData(element.customData),
    });
  });
};

export const toggleTerraformExplode = (
  elements: readonly ExcalidrawElement[],
  triggerElement: ExcalidrawElement,
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

  return reconcileTerraformVisibility(nextElements);
};