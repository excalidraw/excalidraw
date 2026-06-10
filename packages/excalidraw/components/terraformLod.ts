import { isFrameLikeElement } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  NonDeletedElementsMap,
} from "@excalidraw/element/types";

import { TERRAFORM_GROUP_FLAGS } from "./terraformElementMetadata";
import {
  getTerraformEdgeLayer,
  getTerraformVisibilityKey,
  isTerraformExpandAllActive,
} from "./terraformVisibility";

/** Minimum zoom to show detached resource labels (performance tier base). */
export const TERRAFORM_LOD_LABEL_ZOOM = 0.35;
/** Minimum zoom to show AWS icon glyphs (performance tier base). */
export const TERRAFORM_LOD_ICON_ZOOM = 0.4;
/** Minimum zoom to show tier-1 satellites and satelliteCluster frames (performance tier base). */
export const TERRAFORM_LOD_SATELLITE1_ZOOM = 0.5;
/** Minimum zoom to show tier-2 satellites (performance tier base). */
export const TERRAFORM_LOD_SATELLITE2_ZOOM = 0.65;

/** Pipeline topology frame name thresholds — performance tier bases. */
export const TERRAFORM_LOD_PIPELINE_FRAME_NAME_ZOOM = {
  region: 0.2,
  vpc: 0.3,
  subnetZone: 0.45,
  primaryCluster: 0.65,
} as const;

export type TerraformLodPreset = "performance" | "balanced" | "detailed";

export const TERRAFORM_LOD_DEFAULT_PRESET: TerraformLodPreset = "balanced";

/** Multiplier on base thresholds; lower = visible farther out (more detail when zoomed out). */
export const TERRAFORM_LOD_PRESET_SCALE: Record<TerraformLodPreset, number> = {
  performance: 1,
  balanced: 0.65,
  detailed: 0.4,
};

const LOD_ZOOM_CLAMP_MIN = 0.05;
const LOD_ZOOM_CLAMP_MAX = 1;

const scaleLodZoom = (base: number, preset: TerraformLodPreset): number =>
  Math.min(
    LOD_ZOOM_CLAMP_MAX,
    Math.max(LOD_ZOOM_CLAMP_MIN, base * TERRAFORM_LOD_PRESET_SCALE[preset]),
  );

export type TerraformLodThresholds = {
  label: number;
  icon: number;
  satellite1: number;
  satellite2: number;
  frameName: {
    region: number;
    vpc: number;
    subnetZone: number;
    primaryCluster: number;
  };
};

export function getTerraformLodThresholds(
  preset: TerraformLodPreset = TERRAFORM_LOD_DEFAULT_PRESET,
): TerraformLodThresholds {
  return {
    label: scaleLodZoom(TERRAFORM_LOD_LABEL_ZOOM, preset),
    icon: scaleLodZoom(TERRAFORM_LOD_ICON_ZOOM, preset),
    satellite1: scaleLodZoom(TERRAFORM_LOD_SATELLITE1_ZOOM, preset),
    satellite2: scaleLodZoom(TERRAFORM_LOD_SATELLITE2_ZOOM, preset),
    frameName: {
      region: scaleLodZoom(
        TERRAFORM_LOD_PIPELINE_FRAME_NAME_ZOOM.region,
        preset,
      ),
      vpc: scaleLodZoom(TERRAFORM_LOD_PIPELINE_FRAME_NAME_ZOOM.vpc, preset),
      subnetZone: scaleLodZoom(
        TERRAFORM_LOD_PIPELINE_FRAME_NAME_ZOOM.subnetZone,
        preset,
      ),
      primaryCluster: scaleLodZoom(
        TERRAFORM_LOD_PIPELINE_FRAME_NAME_ZOOM.primaryCluster,
        preset,
      ),
    },
  };
}

export type TerraformLodClass =
  | "topologyFrame"
  | "primary"
  | "satellite1"
  | "satellite2"
  | "label"
  | "icon"
  | "satelliteFrame"
  | "edge"
  | "groupFrame";

const TOPOLOGY_FRAME_ROLES = new Set([
  "account",
  "region",
  "vpc",
  "subnetZone",
  "primaryCluster",
  "provider",
]);

const getCustomData = (element: ExcalidrawElement) => element.customData ?? {};

export const isTerraformLodScene = (
  elements: readonly ExcalidrawElement[],
): boolean =>
  elements.some((el) => el.customData?.terraformVisibilityRole === "resource");

const getSatelliteTier = (element: ExcalidrawElement): 0 | 1 | 2 => {
  const cd = getCustomData(element);
  const stored = cd.terraformSatelliteTier;
  if (stored === 0 || stored === 1 || stored === 2) {
    return stored;
  }
  if (cd.terraformInitiallyVisible === true) {
    return 0;
  }
  if (cd.terraformInitiallyVisible === false) {
    return 1;
  }
  return 0;
};

export function classifyTerraformLodElement(
  element: ExcalidrawElement,
): TerraformLodClass | null {
  const cd = getCustomData(element);
  if (!cd.terraform && !getTerraformEdgeLayer(element) && !cd.relationship) {
    return null;
  }

  if (getTerraformEdgeLayer(element) || cd.relationship) {
    return "edge";
  }

  if (cd.terraformAwsIconGlyph === true) {
    return "icon";
  }

  if (element.type === "text" && cd.terraformVisibilityRole === "resource") {
    return "label";
  }

  if (isFrameLikeElement(element)) {
    if (cd.terraformTopologyRole === "satelliteCluster") {
      return "satelliteFrame";
    }
    if (
      typeof cd.terraformTopologyRole === "string" &&
      TOPOLOGY_FRAME_ROLES.has(cd.terraformTopologyRole)
    ) {
      return "topologyFrame";
    }
    if (
      cd.terraformVisibilityRole === "group" ||
      TERRAFORM_GROUP_FLAGS.some((flag) => Boolean(cd[flag]))
    ) {
      return "groupFrame";
    }
    if (cd.terraform === true) {
      return "topologyFrame";
    }
    return null;
  }

  if (
    element.type === "rectangle" &&
    cd.terraformVisibilityRole === "resource"
  ) {
    const tier = getSatelliteTier(element);
    if (tier === 2) {
      return "satellite2";
    }
    if (tier === 1) {
      return "satellite1";
    }
    return "primary";
  }

  return null;
}

export type TerraformLodContext = {
  enabled: boolean;
  zoom: number;
  preset: TerraformLodPreset;
  thresholds: TerraformLodThresholds;
  selectedElementIds: Readonly<Record<string, true>>;
  hoverPeekKey: string | null;
  elements: readonly ExcalidrawElement[];
  expandAllActive: boolean;
};

const getElementGraphKey = (element: ExcalidrawElement): string | null =>
  getTerraformVisibilityKey(element) ??
  (typeof getCustomData(element).nodePath === "string"
    ? getCustomData(element).nodePath
    : null);

const buildExpandedPrimaryAddresses = (
  elements: readonly ExcalidrawElement[],
): Set<string> => {
  const expanded = new Set<string>();
  for (const element of elements) {
    const cd = getCustomData(element);
    if (cd.terraformPipelineExpanded !== true) {
      continue;
    }
    const key = getElementGraphKey(element);
    if (key) {
      expanded.add(key);
    }
  }
  return expanded;
};

const buildExplodedParentKeys = (
  elements: readonly ExcalidrawElement[],
): Set<string> => {
  const exploded = new Set<string>();
  for (const element of elements) {
    const cd = getCustomData(element);
    if (cd.terraformExploded !== true) {
      continue;
    }
    const key = getElementGraphKey(element);
    if (key) {
      exploded.add(key);
    }
  }
  return exploded;
};

const buildSelectedGroupIds = (
  elements: readonly ExcalidrawElement[],
  selectedElementIds: Readonly<Record<string, true>>,
): Set<string> => {
  const groups = new Set<string>();
  for (const element of elements) {
    if (!selectedElementIds[element.id]) {
      continue;
    }
    for (const groupId of element.groupIds ?? []) {
      groups.add(groupId);
    }
  }
  return groups;
};

const elementMatchesHoverPeek = (
  element: ExcalidrawElement,
  hoverPeekKey: string,
): boolean => {
  const key = getElementGraphKey(element);
  return key === hoverPeekKey;
};

const elementHasExplodedAncestor = (
  element: ExcalidrawElement,
  explodedParentKeys: Set<string>,
): boolean => {
  const cd = getCustomData(element);
  if (typeof cd.terraformExplodeParent === "string") {
    if (explodedParentKeys.has(cd.terraformExplodeParent)) {
      return true;
    }
  }
  if (Array.isArray(cd.terraformExplodeParentKeys)) {
    for (const parentKey of cd.terraformExplodeParentKeys) {
      if (typeof parentKey === "string" && explodedParentKeys.has(parentKey)) {
        return true;
      }
    }
  }
  return false;
};

const elementInExpandedPipelineCluster = (
  element: ExcalidrawElement,
  expandedPrimaryAddresses: Set<string>,
): boolean => {
  const key = getElementGraphKey(element);
  if (key && expandedPrimaryAddresses.has(key)) {
    return true;
  }
  const cd = getCustomData(element);
  if (
    typeof cd.terraformExplodeParent === "string" &&
    expandedPrimaryAddresses.has(cd.terraformExplodeParent)
  ) {
    return true;
  }
  if (Array.isArray(cd.terraformExplodeParentKeys)) {
    for (const parentKey of cd.terraformExplodeParentKeys) {
      if (
        typeof parentKey === "string" &&
        expandedPrimaryAddresses.has(parentKey)
      ) {
        return true;
      }
    }
  }
  if (
    typeof cd.terraformPrimaryAddress === "string" &&
    expandedPrimaryAddresses.has(cd.terraformPrimaryAddress)
  ) {
    return true;
  }
  return false;
};

const isLodBypassed = (
  element: ExcalidrawElement,
  ctx: TerraformLodContext,
  expandedPrimaryAddresses: Set<string>,
  explodedParentKeys: Set<string>,
  selectedGroupIds: Set<string>,
): boolean => {
  if (ctx.selectedElementIds[element.id]) {
    return true;
  }
  if (
    selectedGroupIds.size > 0 &&
    (element.groupIds ?? []).some((groupId) => selectedGroupIds.has(groupId))
  ) {
    return true;
  }
  if (ctx.expandAllActive) {
    return true;
  }
  if (getCustomData(element).terraformExpandAllView === true) {
    return true;
  }
  if (ctx.hoverPeekKey && elementMatchesHoverPeek(element, ctx.hoverPeekKey)) {
    return true;
  }
  if (elementInExpandedPipelineCluster(element, expandedPrimaryAddresses)) {
    return true;
  }
  if (elementHasExplodedAncestor(element, explodedParentKeys)) {
    return true;
  }
  return false;
};

const minZoomForLodClass = (
  lodClass: TerraformLodClass,
  thresholds: TerraformLodThresholds,
): number | null => {
  switch (lodClass) {
    case "label":
      return thresholds.label;
    case "icon":
      return thresholds.icon;
    case "satellite1":
    case "satelliteFrame":
      return thresholds.satellite1;
    case "satellite2":
      return thresholds.satellite2;
    default:
      return null;
  }
};

export function shouldRenderTerraformElementAtZoom(
  element: ExcalidrawElement,
  ctx: TerraformLodContext,
  bypassContext: {
    expandedPrimaryAddresses: Set<string>;
    explodedParentKeys: Set<string>;
    selectedGroupIds: Set<string>;
  },
): boolean {
  if (!ctx.enabled) {
    return true;
  }

  const lodClass = classifyTerraformLodElement(element);
  if (!lodClass) {
    return true;
  }

  if (
    isLodBypassed(
      element,
      ctx,
      bypassContext.expandedPrimaryAddresses,
      bypassContext.explodedParentKeys,
      bypassContext.selectedGroupIds,
    )
  ) {
    return true;
  }

  const minZoom = minZoomForLodClass(lodClass, ctx.thresholds);
  if (minZoom == null) {
    return true;
  }

  return ctx.zoom >= minZoom;
}

const getEdgeEndpointKeys = (
  element: ExcalidrawElement,
): [string, string] | null => {
  const cd = getCustomData(element);
  const relationship = cd.relationship as
    | { source?: string; target?: string }
    | undefined;
  if (
    typeof relationship?.source === "string" &&
    typeof relationship?.target === "string"
  ) {
    return [relationship.source, relationship.target];
  }
  return null;
};

export function buildTerraformLodContext(
  enabled: boolean,
  zoom: number,
  selectedElementIds: Readonly<Record<string, true>>,
  hoverPeekKey: string | null,
  elements: readonly ExcalidrawElement[],
  preset: TerraformLodPreset = TERRAFORM_LOD_DEFAULT_PRESET,
): TerraformLodContext {
  return {
    enabled,
    zoom,
    preset,
    thresholds: getTerraformLodThresholds(preset),
    selectedElementIds,
    hoverPeekKey,
    elements,
    expandAllActive: isTerraformExpandAllActive(elements),
  };
}

export function filterTerraformLodVisibleElements(
  visibleElements: readonly NonDeletedExcalidrawElement[],
  ctx: TerraformLodContext,
  _elementsMap: NonDeletedElementsMap,
): readonly NonDeletedExcalidrawElement[] {
  if (!ctx.enabled || !isTerraformLodScene(ctx.elements)) {
    return visibleElements;
  }

  const expandedPrimaryAddresses = buildExpandedPrimaryAddresses(ctx.elements);
  const explodedParentKeys = buildExplodedParentKeys(ctx.elements);
  const selectedGroupIds = buildSelectedGroupIds(
    ctx.elements,
    ctx.selectedElementIds,
  );
  const bypassContext = {
    expandedPrimaryAddresses,
    explodedParentKeys,
    selectedGroupIds,
  };

  const elementVisible = new Map<string, boolean>();
  for (const element of visibleElements) {
    elementVisible.set(
      element.id,
      shouldRenderTerraformElementAtZoom(element, ctx, bypassContext),
    );
  }

  const addressVisible = new Map<string, boolean>();
  for (const element of visibleElements) {
    const key = getElementGraphKey(element);
    if (!key) {
      continue;
    }
    const visible = elementVisible.get(element.id) ?? true;
    addressVisible.set(key, (addressVisible.get(key) ?? false) || visible);
  }

  return visibleElements.filter((element) => {
    const lodClass = classifyTerraformLodElement(element);
    if (lodClass === "edge") {
      const endpoints = getEdgeEndpointKeys(element);
      if (endpoints) {
        const [source, target] = endpoints;
        if (
          addressVisible.get(source) === false ||
          addressVisible.get(target) === false
        ) {
          return false;
        }
      }
    }
    return elementVisible.get(element.id) ?? true;
  });
}

export function shouldShowTerraformPipelineFrameName(
  customData: Record<string, unknown> | undefined,
  zoom: number,
  preset: TerraformLodPreset = TERRAFORM_LOD_DEFAULT_PRESET,
): boolean {
  if (customData?.terraformPipelineView !== true) {
    return true;
  }
  const frameName = getTerraformLodThresholds(preset).frameName;
  switch (customData.terraformTopologyRole) {
    case "provider":
    case "account":
      return true;
    case "region":
      return zoom >= frameName.region;
    case "vpc":
      return zoom >= frameName.vpc;
    case "subnetZone":
      return zoom >= frameName.subnetZone;
    case "primaryCluster":
      return zoom >= frameName.primaryCluster;
    default:
      return true;
  }
}
