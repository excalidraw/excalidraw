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

/**
 * Minimum on-screen footprint (px, smaller frame dimension × zoom) for a
 * topology frame to render its name.
 *
 * This is the navigational decluttering rule (Phase 2b / Design hierarchy): a
 * frame name only appears once the frame itself is at least this big on screen.
 * It supersedes the per-role zoom thresholds for topology frames when the
 * footprint is known, and does the job of both Phase-2b goals at once:
 * - a large enclosing frame (region/vpc) shows its name *farther out* than the
 *   old fixed zoom floors ("keep names alive longer"), because its footprint is
 *   large even at low zoom;
 * - a small child frame stays suppressed until you've zoomed in enough that it
 *   no longer collides with its parent's name (kills the region+vpc+subnet
 *   name-stacking that naive threshold-lowering reintroduces at ~0.2 zoom).
 *
 * Tunable; ~56px is roughly the smallest box that can host a legible Assistant
 * name label without overlapping an enclosing frame's title band.
 */
export const TERRAFORM_FRAME_NAME_MIN_FOOTPRINT_PX = 56;

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

/**
 * The minimum zoom at which a matched element's salient content actually
 * renders under `preset`. This is the "zoom in far enough to render it" floor
 * for search-to-fit: jumping to a matched element that is still LOD-culled
 * lands the user on blank space (Design review, ★critical). Returns `null` for
 * elements that always render their key content (primary boxes, group frames,
 * provider/account frame names, edges, non-Terraform elements).
 *
 * For a topology frame the navigational unit is its *name*, so we return the
 * frame-name threshold (not `null`) — otherwise a region/VPC match would frame
 * a box whose label is still hidden.
 */
export function terraformLodFloorForElement(
  element: ExcalidrawElement,
  preset: TerraformLodPreset = TERRAFORM_LOD_DEFAULT_PRESET,
): number | null {
  const lodClass = classifyTerraformLodElement(element);
  if (!lodClass) {
    return null;
  }
  const thresholds = getTerraformLodThresholds(preset);
  if (lodClass === "topologyFrame") {
    const role = getCustomData(element).terraformTopologyRole;
    switch (role) {
      case "region":
        return thresholds.frameName.region;
      case "vpc":
        return thresholds.frameName.vpc;
      case "subnetZone":
        return thresholds.frameName.subnetZone;
      case "primaryCluster":
        return thresholds.frameName.primaryCluster;
      default:
        return null;
    }
  }
  return minZoomForLodClass(lodClass, thresholds);
}

/**
 * Target zoom for search-to-fit, with the LOD floor winning the clamp.
 *
 * A naive `min(fitZoom, maxZoom)` inverts when `lodFloor > maxZoom`: the result
 * drops below the floor and the jump lands on a culled (blank) element. So we
 * floor first (`max(fitZoom, lodFloor)`), then clamp to `[minZoom, maxZoom]`
 * but raise the ceiling to the floor when they conflict — the floor always
 * wins (Eng review #12). With `lodFloor == null` this reduces to a normal
 * `clamp(fitZoom, minZoom, maxZoom)`.
 */
export function terraformSearchTargetZoom({
  fitZoom,
  lodFloor,
  minZoom,
  maxZoom,
}: {
  fitZoom: number;
  lodFloor: number | null;
  minZoom: number;
  maxZoom: number;
}): number {
  // Guard degenerate fit inputs (e.g. getCommonBounds([]) → Infinity).
  const safeFit = Number.isFinite(fitZoom) ? fitZoom : minZoom;
  if (lodFloor == null || !Number.isFinite(lodFloor)) {
    return Math.min(Math.max(safeFit, minZoom), maxZoom);
  }
  const floored = Math.max(safeFit, lodFloor);
  const ceiling = Math.max(maxZoom, lodFloor); // floor wins over maxZoom
  return Math.min(Math.max(floored, minZoom), ceiling);
}

/**
 * Resolve a search/nav match to the canonical element worth fitting + selecting.
 *
 * A Terraform resource is many elements (detached label, AWS icon glyph, primary
 * rectangle, satellites) that share a visibility key. Search matches the label or
 * frame name, but to un-cull and center the resource we want its **primary box**;
 * selecting that box is what bypasses LOD (`isLodBypassed` → `selectedElementIds`).
 *
 * Frames (topology/group/satellite) and primaries are fit directly. A label/icon
 * resolves to the primary sharing its key. A satellite *is* its own resource's
 * box (no separate primary), and an edge has no key — both return themselves, so
 * the caller still selects a real, LOD-bypassing element.
 */
export function resolveCanonicalTerraformElement(
  matched: ExcalidrawElement,
  elements: readonly ExcalidrawElement[],
): ExcalidrawElement {
  const lodClass = classifyTerraformLodElement(matched);
  if (
    lodClass === null ||
    lodClass === "primary" ||
    lodClass === "topologyFrame" ||
    lodClass === "groupFrame" ||
    lodClass === "satelliteFrame"
  ) {
    return matched;
  }
  const key = getElementGraphKey(matched);
  if (!key) {
    return matched;
  }
  const primary = elements.find(
    (element) =>
      getElementGraphKey(element) === key &&
      classifyTerraformLodElement(element) === "primary",
  );
  return primary ?? matched;
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
  /**
   * The frame's on-screen footprint in px (smaller scene dimension × zoom).
   * When supplied, topology-frame names use the footprint decluttering rule
   * ({@link TERRAFORM_FRAME_NAME_MIN_FOOTPRINT_PX}) instead of the per-role zoom
   * floors. Omit it to fall back to the legacy fixed zoom thresholds.
   */
  footprintPx?: number,
): boolean {
  if (customData?.terraformPipelineView !== true) {
    return true;
  }
  const role = customData.terraformTopologyRole;
  // provider/account are the top-level anchors — always named.
  if (role === "provider" || role === "account") {
    return true;
  }
  if (
    role === "region" ||
    role === "vpc" ||
    role === "subnetZone" ||
    role === "primaryCluster"
  ) {
    if (footprintPx != null) {
      return footprintPx >= TERRAFORM_FRAME_NAME_MIN_FOOTPRINT_PX;
    }
    // Legacy fixed-zoom fallback (no footprint available).
    const frameName = getTerraformLodThresholds(preset).frameName;
    return zoom >= frameName[role];
  }
  return true;
}
