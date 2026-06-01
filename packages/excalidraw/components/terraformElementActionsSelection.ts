import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import {
  getTerraformGraphAddressForElement,
  isTerraformGroupElement,
  isTerraformInspectableElement,
  isTerraformLayerEdge,
  isTerraformResourceElement,
} from "./terraformElementMetadata";
import { getTerraformEdgeLayer } from "./terraformVisibility";

import type { AppState, UIAppState } from "../types";

export const terraformEdgesVisibilitySig = (
  els: readonly ExcalidrawElement[],
): string =>
  els
    .filter((e) => getTerraformEdgeLayer(e))
    .map((e) => `${e.id}:${e.isDeleted ? 1 : 0}`)
    .sort()
    .join(";");

export const terraformFocusSceneSig = (
  els: readonly ExcalidrawElement[],
  focusNodePath: string | null,
) =>
  `${focusNodePath ?? ""}::${els
    .filter((e) => e.customData?.terraform)
    .map(
      (e) =>
        `${e.id}:${e.isDeleted ? 1 : 0}:${e.strokeColor}:${e.backgroundColor}:${
          e.customData?.terraformFocusPreview ? 1 : 0
        }`,
    )
    .sort()
    .join(";")}`;

export const terraformFocusInputsSig = (
  activeFocusNodePath: string | null,
  hoveredElementIds: Readonly<{ [id: string]: true }>,
  selectedElementIds: Readonly<{ [id: string]: true }>,
  pins: AppState["terraformEdgeLayerPins"],
  viewBackgroundColor: string,
) =>
  [
    activeFocusNodePath ?? "",
    Object.keys(hoveredElementIds).sort().join(","),
    Object.keys(selectedElementIds).sort().join(","),
    pins ? JSON.stringify(pins) : "",
    viewBackgroundColor,
  ].join("|");

export const getTerraformElementForSelection = (
  elements: readonly NonDeletedExcalidrawElement[],
  selectedElementIds: UIAppState["selectedElementIds"],
  selectedGroupIdsMap: UIAppState["selectedGroupIds"],
) => {
  const selectedIds = Object.keys(selectedElementIds);
  if (selectedIds.length === 0) {
    return null;
  }

  const selectedElements = elements.filter(
    (element) => selectedElementIds[element.id],
  );

  const selectedTerraformNode = selectedElements.find((element) =>
    isTerraformResourceElement(element),
  );
  if (selectedTerraformNode) {
    return selectedTerraformNode;
  }

  const selectedTerraformGroup = selectedElements.find((element) =>
    isTerraformGroupElement(element),
  );
  if (selectedTerraformGroup) {
    return selectedTerraformGroup;
  }

  const selectedTerraformEdge = selectedElements.find((element) =>
    isTerraformLayerEdge(element),
  );
  if (selectedTerraformEdge) {
    return selectedTerraformEdge;
  }

  const selectedTerraformContainer = selectedElements.find(
    (element) =>
      "containerId" in element &&
      Boolean(element.containerId) &&
      elements.some(
        (candidate) =>
          candidate.id === element.containerId &&
          isTerraformInspectableElement(candidate),
      ),
  );
  if (
    selectedTerraformContainer &&
    "containerId" in selectedTerraformContainer &&
    selectedTerraformContainer.containerId
  ) {
    const container = elements.find(
      (element) => element.id === selectedTerraformContainer.containerId,
    );
    if (container && isTerraformInspectableElement(container)) {
      return container;
    }
  }

  const selectedGroupIds = new Set<string>([
    ...Object.keys(selectedGroupIdsMap),
    ...selectedElements.flatMap((element) => element.groupIds || []),
  ]);

  if (selectedGroupIds.size === 0) {
    return null;
  }

  const groupedTerraformElements = elements.filter(
    (element) =>
      isTerraformInspectableElement(element) &&
      (element.groupIds || []).some((groupId) => selectedGroupIds.has(groupId)),
  );

  return groupedTerraformElements.length === 1
    ? groupedTerraformElements[0]
    : null;
};

export const getTerraformGroupKind = (customData: Record<string, any>) => {
  if (customData.terraformModuleGroup) {
    return "Module";
  }
  if (customData.terraformSubnetGroup) {
    return "Subnet";
  }
  if (customData.terraformVpcGroup) {
    return "VPC";
  }
  if (customData.terraformRegionGroup) {
    return "Region";
  }
  if (customData.terraformAccountGroup) {
    return "Account";
  }
  return "Group";
};

export const getTerraformGroupTitle = (customData: Record<string, any>) => {
  if (customData.modulePath) {
    return customData.modulePath;
  }
  if (customData.subnetLabel || customData.subnetId) {
    return customData.subnetLabel || customData.subnetId;
  }
  if (customData.vpcLabel || customData.vpcId) {
    return customData.vpcLabel || customData.vpcId;
  }
  if (customData.region) {
    return customData.region;
  }
  if (customData.accountId) {
    return customData.accountId;
  }
  return "Terraform group";
};

export const getTerraformContainerFacets = (customData: Record<string, any>) =>
  Array.isArray(customData.terraformContainerFacets)
    ? customData.terraformContainerFacets
    : [];

export const findTerraformElementByNodePath = (
  elements: readonly ExcalidrawElement[],
  nodePath: string,
): ExcalidrawElement | null => {
  let duplicateFallback: ExcalidrawElement | null = null;
  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }
    if (getTerraformGraphAddressForElement(el) !== nodePath) {
      continue;
    }
    if (el.customData?.terraformSemanticLayoutDuplicate === true) {
      duplicateFallback = duplicateFallback ?? el;
      continue;
    }
    return el;
  }
  return duplicateFallback;
};
