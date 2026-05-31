/**
 * TFD pipeline layout: geographic frames + primaryCluster atoms left-to-right.
 */

import { convertToExcalidrawElements } from "@excalidraw/element";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { injectTerraformAwsIconsIntoElements } from "./terraformAwsIcons";
import {
  mirrorAndDetachTerraformResourceLabels,
  type TerraformDependencyLayoutBox,
} from "./terraformElkLayout";
import { tfComfortPx } from "./terraformLayoutComfort";
import { DECLARED_DATAFLOW_ORDERED_KEY } from "./terraformDeclaredDataFlow";
import { buildPipelineAtomGraph, isTfdHopAtom } from "./terraformPipelineAtoms";
import {
  assignPipelineColumnPackedY,
  buildColumnPackInputs,
} from "./terraformPipelineColumnPack";
import {
  buildPipelineAccountLaneBands,
  buildPipelineLayoutPlan,
  type PipelineAccountLaneBand,
  type PipelineAtomPlacement,
  type PipelineColumn,
} from "./terraformPipelineContainers";
import { buildPipelineDeclaredDataFlowLineSkeletons } from "./terraformPipelineEdges";
import {
  buildPipelineAtomGeoMap,
  pipelineGeoTierLabel,
  type PipelineGeoPath,
} from "./terraformPipelineGeo";
import {
  DEFAULT_TERRAFORM_PIPELINE_LAYOUT_MODE,
  DEFAULT_TERRAFORM_PIPELINE_VERTICAL_SOLVER_MODE,
  type TerraformPipelineLayoutMode,
  type TerraformPipelineVerticalSolverMode,
} from "./terraformPipelineLayoutMode";
import { applyPipelineVerticalSolver } from "./terraformPipelineVerticalSolver";
import {
  buildTopologyPrimaryClusterSkeletonForPipeline,
  reorderTopologyElementsZStack,
} from "./terraformTopologyLayout";
import {
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
  TERRAFORM_IMPORT_EDGE_LAYER_PINS,
} from "./terraformVisibility";

import type { BinaryFiles } from "../types";
import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

const px = tfComfortPx;

const MARGIN = px(50);
const COLUMN_GAP = px(48);
const LANE_GAP = px(24);
const INNER_PAD = px(28);
const FRAME_PAD = px(20);
const AWS_FRAME_PAD = px(32);
/** Extra vertical gap between multi-account lane bands (region padding on both sides). */
const ACCOUNT_BAND_GAP = LANE_GAP + 2 * INNER_PAD;
const MIN_FRAME_W = px(200);
const MIN_FRAME_H = px(160);

export type TerraformPipelineSceneMeta = {
  layoutEngine: "pipeline";
  pipelineLayoutMode: TerraformPipelineLayoutMode;
  pipelineVerticalSolverMode: TerraformPipelineVerticalSolverMode;
  atomCount: number;
  columnCount: number;
  geoInstanceCount: number;
  declaredEdgeCount: number;
  skippedLayout?: boolean;
  skipReason?: string;
  warnings?: string[];
};

type ClusterBuild = {
  primaryAddress: string;
  skeleton: ExcalidrawElementSkeleton[];
  width: number;
  height: number;
  clusterFrameId: string;
};

type Bounds = { x: number; y: number; width: number; height: number };

export type PipelineZoneFrameSpec = {
  id: string;
  label: string;
  role: string;
  path: string[];
  bounds: Bounds;
  clusterFrameIds: string[];
  vpcKey: string | null;
  regionalBandKey: string | null;
  accountId: string;
  region: string;
  columnIndex: number;
  laneIndex: number;
};

type ZoneFrameSpec = PipelineZoneFrameSpec;

type ClusterPlacementDraft = {
  col: PipelineColumn;
  lane: number;
  placement: PipelineAtomPlacement;
  build: ClusterBuild;
  columnX: number;
  clusterX: number;
  clusterY: number;
  bounds: Bounds;
  vpcKey: string | null;
  regionalBandKey: string | null;
  zoneKey: string;
  zoneFrameId: string;
  preFanoutColumn: boolean;
};

type PipelineRowGeometry = {
  maxLaneCount: number;
  rowHeights: number[];
  rowTops: number[];
  sharedColumnHeight: number;
};

function computeRowTops(
  rowHeights: readonly number[],
  contentTop: number,
  accountBands?: readonly PipelineAccountLaneBand[],
  multiAccountBandLayout = false,
): { rowTops: number[]; sharedColumnHeight: number } {
  if (!multiAccountBandLayout || !accountBands || accountBands.length <= 1) {
    const rowTops: number[] = [];
    let y = contentTop + INNER_PAD;
    for (let i = 0; i < rowHeights.length; i++) {
      rowTops[i] = y;
      y += rowHeights[i]! + LANE_GAP;
    }
    return { rowTops, sharedColumnHeight: y - contentTop + INNER_PAD };
  }

  const rowTops: number[] = [];
  const sortedBands = [...accountBands].sort((a, b) => a.minLane - b.minLane);
  let y = contentTop + INNER_PAD;

  for (let bi = 0; bi < sortedBands.length; bi++) {
    const band = sortedBands[bi]!;
    const lanes = [...band.laneIndices].sort((a, b) => a - b);
    if (bi > 0) {
      const prevBand = sortedBands[bi - 1]!;
      const prevMaxLane = Math.max(...prevBand.laneIndices);
      y = rowTops[prevMaxLane]! + rowHeights[prevMaxLane]! + ACCOUNT_BAND_GAP;
    }
    for (const lane of lanes) {
      rowTops[lane] = y;
      y += rowHeights[lane]! + LANE_GAP;
    }
  }

  for (let i = 0; i < rowHeights.length; i++) {
    if (rowTops[i] == null) {
      rowTops[i] = y;
      y += rowHeights[i]! + LANE_GAP;
    }
  }

  return { rowTops, sharedColumnHeight: y - contentTop + INNER_PAD };
}

function computePipelineRowGeometry(
  layoutPlan: {
    columns: PipelineColumn[];
    placements: readonly PipelineAtomPlacement[];
  },
  clusterBuilds: Map<string, ClusterBuild>,
  contentTop: number,
  rowHeightsOverride?: readonly number[],
  accountBands?: readonly PipelineAccountLaneBand[],
  multiAccountBandLayout = false,
): PipelineRowGeometry {
  const maxLaneCount = Math.max(
    1,
    ...layoutPlan.placements.map((p) => p.laneIndex + 1),
  );
  const rowHeights =
    rowHeightsOverride != null
      ? [...rowHeightsOverride]
      : Array.from({ length: maxLaneCount }, () => px(88));

  if (rowHeightsOverride == null) {
    const placementByAddr = new Map(
      layoutPlan.placements.map((p) => [p.primaryAddress, p]),
    );
    for (const col of layoutPlan.columns) {
      for (const addr of col.atoms) {
        if (!addr) {
          continue;
        }
        const build = clusterBuilds.get(addr);
        if (!build) {
          continue;
        }
        const lane =
          placementByAddr.get(addr)?.laneIndex ?? col.atoms.indexOf(addr);
        rowHeights[lane] = Math.max(
          rowHeights[lane]!,
          rowHeightForClusterSlot(build),
        );
      }
    }
  }

  const { rowTops, sharedColumnHeight } = computeRowTops(
    rowHeights,
    contentTop,
    accountBands,
    multiAccountBandLayout,
  );

  return {
    maxLaneCount,
    rowHeights,
    rowTops,
    sharedColumnHeight,
  };
}

function inflateRowHeightsFromZoneBounds(
  rowHeights: number[],
  drafts: readonly ClusterPlacementDraft[],
  contentTop: number,
  accountLaneIndicesByAccount: ReadonlyMap<string, readonly number[]>,
  multiAccountBandLayout: boolean,
  accountBands?: readonly PipelineAccountLaneBand[],
): boolean {
  let changed = false;
  for (const draft of drafts) {
    const needed = draft.bounds.height + 2 * FRAME_PAD + INNER_PAD;
    const accountLanes = accountLaneIndicesByAccount.get(
      draft.placement.geo.accountId,
    );
    const maxBandLane =
      multiAccountBandLayout && accountLanes?.length
        ? Math.max(...accountLanes)
        : rowHeights.length - 1;

    if (draft.preFanoutColumn && multiAccountBandLayout) {
      const targetBottom = draft.bounds.y + draft.bounds.height + FRAME_PAD;
      const tops = computeRowTops(
        rowHeights,
        contentTop,
        accountBands,
        multiAccountBandLayout,
      ).rowTops;
      let startLane = draft.lane;
      for (let i = 0; i <= maxBandLane; i++) {
        const laneBottom = tops[i]! + rowHeights[i]!;
        if (draft.bounds.y < laneBottom + LANE_GAP) {
          startLane = i;
          break;
        }
      }
      for (let lane = startLane; lane <= maxBandLane; lane++) {
        const laneTops = computeRowTops(
          rowHeights,
          contentTop,
          accountBands,
          multiAccountBandLayout,
        ).rowTops;
        const laneBottom = laneTops[lane]! + rowHeights[lane]!;
        if (targetBottom <= laneBottom + 0.5) {
          break;
        }
        const laneNeeded = targetBottom - laneTops[lane]! + FRAME_PAD;
        if (laneNeeded > rowHeights[lane]!) {
          rowHeights[lane] = laneNeeded;
          changed = true;
        }
      }
      continue;
    }

    if (needed > rowHeights[draft.lane]!) {
      rowHeights[draft.lane] = needed;
      changed = true;
    }
  }
  return changed;
}

function inflateRowHeightsFromZoneSpecBounds(
  rowHeights: number[],
  zoneSpecs: ReadonlyMap<string, ZoneFrameSpec>,
  contentTop: number,
  accountBands?: readonly PipelineAccountLaneBand[],
  multiAccountBandLayout = false,
): boolean {
  let changed = false;
  const tops = computeRowTops(
    rowHeights,
    contentTop,
    accountBands,
    multiAccountBandLayout,
  ).rowTops;
  for (const spec of zoneSpecs.values()) {
    const targetBottom =
      spec.bounds.y + spec.bounds.height + FRAME_PAD + INNER_PAD;
    const specTop = spec.bounds.y - FRAME_PAD;

    for (let lane = 0; lane < rowHeights.length; lane++) {
      const laneTop = tops[lane]!;
      const laneBottom = laneTop + rowHeights[lane]!;
      if (laneBottom < specTop - 0.5 || laneTop > targetBottom + 0.5) {
        continue;
      }
      if (targetBottom > laneBottom + 0.5) {
        rowHeights[lane] = targetBottom - laneTop + FRAME_PAD;
        changed = true;
      }
    }
  }
  return changed;
}

function populateSkeletonFromDrafts(
  drafts: readonly ClusterPlacementDraft[],
  skeleton: ExcalidrawElementSkeleton[],
  zoneSpecs: Map<string, ZoneFrameSpec>,
): void {
  for (const draft of drafts) {
    const { placement, build, clusterX, clusterY } = draft;
    skeleton.push(...translateSkeleton(build.skeleton, clusterX, clusterY));
    zoneSpecs.set(draft.zoneKey, {
      id: draft.zoneFrameId,
      label: zoneLabelForGeo(placement.geo),
      role: "subnetZone",
      path: [
        placement.geo.accountId,
        placement.geo.region,
        placement.geo.vpcId ?? "regional",
        String(placement.geoInstanceId),
        String(draft.col.columnIndex),
        placement.trackId ?? "other",
        String(draft.lane),
      ],
      bounds: clusterBoundsForZone(clusterX, clusterY, build),
      clusterFrameIds: [build.clusterFrameId],
      vpcKey: draft.vpcKey,
      regionalBandKey: draft.regionalBandKey,
      accountId: placement.geo.accountId,
      region: placement.geo.region,
      columnIndex: draft.col.columnIndex,
      laneIndex: draft.lane,
    });
  }
}

function primaryResourceCenterYInCluster(build: ClusterBuild): number {
  for (const el of build.skeleton) {
    if (el.type !== "rectangle") {
      continue;
    }
    const cd = el.customData as Record<string, unknown> | undefined;
    if (
      cd?.terraformVisibilityRole === "resource" &&
      cd.nodePath === build.primaryAddress
    ) {
      return (el.y ?? 0) + (el.height ?? 0) / 2;
    }
  }
  return build.height / 2;
}

function minRowHeightForPrimaryCenteredCluster(build: ClusterBuild): number {
  const primaryCy = primaryResourceCenterYInCluster(build);
  return 2 * Math.max(primaryCy, build.height - primaryCy);
}

/** Full primaryCluster height plus padding so top-aligned lanes do not overlap. */
function rowHeightForClusterSlot(build: ClusterBuild): number {
  return (
    Math.max(build.height, minRowHeightForPrimaryCenteredCluster(build)) +
    2 * FRAME_PAD +
    INNER_PAD
  );
}

function firstMultiLaneColumnIndex(columns: readonly PipelineColumn[]): number {
  return columns.findIndex((c) => c.laneCount > 1);
}

function fanoutSpanCenterY(rowGeo: PipelineRowGeometry): number {
  const { rowHeights, rowTops, maxLaneCount } = rowGeo;
  const spanTop = rowTops[0]!;
  const spanBottom = rowTops[maxLaneCount - 1]! + rowHeights[maxLaneCount - 1]!;
  return (spanTop + spanBottom) / 2;
}

function packedSpanCenterY(
  placements: readonly PipelineAtomPlacement[],
  contentTop: number,
): number | null {
  let min = Infinity;
  let max = -Infinity;
  for (const p of placements) {
    if (p.packedOffsetY == null) {
      continue;
    }
    min = Math.min(min, p.packedOffsetY);
    max = Math.max(max, p.packedOffsetY);
  }
  if (min === Infinity) {
    return null;
  }
  return contentTop + INNER_PAD + (min + max) / 2;
}

function clusterYForPlacement(
  col: PipelineColumn,
  colIdx: number,
  lane: number,
  build: ClusterBuild,
  rowGeo: PipelineRowGeometry,
  columns: readonly PipelineColumn[],
  contentTop: number,
  placement: PipelineAtomPlacement | undefined,
  packedSpanCenter: number | null,
  accountLaneIndices?: readonly number[],
  multiAccountBandLayout = false,
): number {
  const { rowTops } = rowGeo;
  const primaryCy = primaryResourceCenterYInCluster(build);
  const firstFanoutCol = firstMultiLaneColumnIndex(columns);

  if (placement?.packedOffsetY != null) {
    return contentTop + INNER_PAD + placement.packedOffsetY - primaryCy;
  }

  if (col.laneCount > 1) {
    return rowTops[lane]! + FRAME_PAD;
  }

  if (col.laneCount === 1 && firstFanoutCol >= 0 && colIdx < firstFanoutCol) {
    let rowCenterY: number;
    if (multiAccountBandLayout && accountLaneIndices?.length) {
      const minLane = Math.min(...accountLaneIndices);
      rowCenterY = rowTops[minLane]! + primaryCy;
    } else if (packedSpanCenter != null) {
      rowCenterY = packedSpanCenter;
    } else {
      rowCenterY = fanoutSpanCenterY(rowGeo);
    }
    return rowCenterY - primaryCy;
  }

  return rowTops[lane]! + FRAME_PAD;
}

function translateSkeleton(
  skeleton: readonly ExcalidrawElementSkeleton[],
  dx: number,
  dy: number,
): ExcalidrawElementSkeleton[] {
  return skeleton.map((el) => ({
    ...el,
    x: (el.x ?? 0) + dx,
    y: (el.y ?? 0) + dy,
  }));
}

function leafZoneFrameSkeleton(
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  children: readonly string[],
  path: string[],
): ExcalidrawElementSkeleton {
  return {
    type: "frame",
    id,
    name: name.slice(0, 48),
    x,
    y,
    width,
    height,
    children,
    customData: {
      terraform: true,
      terraformPipelineOverview: true,
      terraformTopologyRole: "subnetZone",
      terraformTopologyPath: path,
    },
  };
}

/** Container frames: omit x/y/width/height so convert sizes from children (inner → outer order). */
function containerFrameSkeleton(
  id: string,
  name: string,
  children: readonly string[],
  role: string,
  path: string[],
  customDataExtras?: Record<string, unknown>,
): ExcalidrawElementSkeleton {
  return {
    type: "frame",
    id,
    name: name.slice(0, 48),
    children,
    customData: {
      terraform: true,
      terraformPipelineOverview: true,
      terraformTopologyRole: role,
      terraformTopologyPath: path,
      ...customDataExtras,
    },
  };
}

function pipelineContainerPad(role: string): number {
  switch (role) {
    case "vpc":
      return FRAME_PAD;
    case "region":
      return INNER_PAD;
    case "account":
      return AWS_FRAME_PAD / 2;
    case "provider":
      return AWS_FRAME_PAD;
    default:
      return FRAME_PAD;
  }
}

function setFrameBounds(
  frame: ExcalidrawElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const mutable = frame as ExcalidrawElement & {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  mutable.x = x;
  mutable.y = y;
  mutable.width = width;
  mutable.height = height;
}

function resizePipelineContainerFrames(elements: ExcalidrawElement[]): void {
  const roles = ["vpc", "region", "account", "provider"] as const;
  for (const role of roles) {
    const pad = pipelineContainerPad(role);
    for (const frame of elements) {
      if (frame.type !== "frame" || frame.isDeleted) {
        continue;
      }
      const cd = frame.customData as Record<string, unknown> | undefined;
      if (cd?.terraformTopologyRole !== role) {
        continue;
      }
      const children = elements.filter(
        (el) => !el.isDeleted && el.frameId === frame.id,
      );
      if (children.length === 0) {
        continue;
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const child of children) {
        minX = Math.min(minX, child.x);
        minY = Math.min(minY, child.y);
        maxX = Math.max(maxX, child.x + child.width);
        maxY = Math.max(maxY, child.y + child.height);
      }
      setFrameBounds(
        frame,
        minX - pad,
        minY - pad,
        maxX - minX + 2 * pad,
        maxY - minY + 2 * pad,
      );
    }
  }
}

function childBounds(
  elements: ExcalidrawElement[],
  frameId: string,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const child of elements) {
    if (child.isDeleted || child.frameId !== frameId) {
      continue;
    }
    minX = Math.min(minX, child.x);
    minY = Math.min(minY, child.y);
    maxX = Math.max(maxX, child.x + child.width);
    maxY = Math.max(maxY, child.y + child.height);
  }
  if (!Number.isFinite(minX)) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

function translateElementsForAccount(
  elements: ExcalidrawElement[],
  accountId: string,
  dx: number,
  dy: number,
): void {
  if (dx === 0 && dy === 0) {
    return;
  }
  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }
    const path = (el.customData as Record<string, unknown> | undefined)
      ?.terraformTopologyPath;
    if (!Array.isArray(path) || path[0] !== accountId) {
      continue;
    }
    (el as { x: number; y: number }).x += dx;
    (el as { y: number }).y += dy;
  }
}

function alignMultiAccountPipelineFrames(
  elements: ExcalidrawElement[],
  accountBands: readonly PipelineAccountLaneBand[],
): void {
  const frameRole = (el: ExcalidrawElement) =>
    String(
      (el.customData as Record<string, unknown> | undefined)
        ?.terraformTopologyRole ?? "",
    );

  const sortedBands = [...accountBands].sort(
    (a, b) => a.minLane - b.minLane || a.accountId.localeCompare(b.accountId),
  );

  let prevAccountBottom = -Infinity;
  for (const band of sortedBands) {
    const accountFrame = elements.find((e) => {
      if (e.isDeleted || e.type !== "frame" || frameRole(e) !== "account") {
        return false;
      }
      const path = (e.customData as Record<string, unknown> | undefined)
        ?.terraformTopologyPath as string[] | undefined;
      return path?.[0] === band.accountId;
    });
    if (!accountFrame) {
      continue;
    }

    const bounds = childBounds(elements, accountFrame.id);
    if (!bounds) {
      continue;
    }

    const pad = pipelineContainerPad("account");
    const targetTop = Math.max(bounds.minY - pad, prevAccountBottom + LANE_GAP);
    const dy = targetTop - (bounds.minY - pad);
    if (dy > 0.5) {
      translateElementsForAccount(elements, band.accountId, 0, dy);
      bounds.minY += dy;
      bounds.maxY += dy;
    }

    setFrameBounds(
      accountFrame,
      bounds.minX - pad,
      bounds.minY - pad,
      bounds.maxX - bounds.minX + 2 * pad,
      bounds.maxY - bounds.minY + 2 * pad,
    );
    prevAccountBottom = accountFrame.y + accountFrame.height;
  }

  const awsFrame = elements.find(
    (e) => !e.isDeleted && e.type === "frame" && frameRole(e) === "provider",
  );
  if (awsFrame) {
    const bounds = childBounds(elements, awsFrame.id);
    if (bounds) {
      const pad = pipelineContainerPad("provider");
      setFrameBounds(
        awsFrame,
        bounds.minX - pad,
        bounds.minY - pad,
        bounds.maxX - bounds.minX + 2 * pad,
        bounds.maxY - bounds.minY + 2 * pad,
      );
    }
  }
}

function specInAccountBand(
  spec: ZoneFrameSpec,
  accountBands: readonly {
    accountId: string;
    laneIndices: ReadonlySet<number>;
  }[],
  multiAccountBandLayout: boolean,
): boolean {
  if (!multiAccountBandLayout) {
    return true;
  }
  const band = accountBands.find((b) => b.accountId === spec.accountId);
  return band ? band.laneIndices.has(spec.laneIndex) : true;
}

function skeletonUnionBounds(
  skeleton: readonly ExcalidrawElementSkeleton[],
  pad: number,
): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of skeleton) {
    const x = el.x ?? 0;
    const y = el.y ?? 0;
    const w = el.width ?? 0;
    const h = el.height ?? 0;
    if (w <= 0 && h <= 0) {
      continue;
    }
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: MIN_FRAME_W, height: MIN_FRAME_H };
  }
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + 2 * pad,
    height: maxY - minY + 2 * pad,
  };
}

function clusterBoundsForZone(
  clusterX: number,
  clusterY: number,
  build: ClusterBuild,
): Bounds {
  return skeletonUnionBounds(
    translateSkeleton(build.skeleton, clusterX, clusterY),
    FRAME_PAD,
  );
}

function regionGroupKey(accountId: string, region: string): string {
  return `${accountId}|${region}`;
}

export type PipelineGeoColumnRun = {
  accountId: string;
  region: string;
  minColumn: number;
  maxColumn: number;
  specs: PipelineZoneFrameSpec[];
};

/** Group key for per-column VPC/regional leaf specs before run-scoped VPC merge. */
export function pipelineContainerGroupKey(
  spec: PipelineZoneFrameSpec,
  multiAccountBandLayout: boolean,
): string | null {
  const parentBucket = spec.vpcKey ?? spec.regionalBandKey;
  if (!parentBucket) {
    return null;
  }
  if (multiAccountBandLayout) {
    const track =
      spec.path.length >= 7 ? spec.path[5]! : String(spec.laneIndex);
    return `${parentBucket}|track${track}|col${spec.columnIndex}`;
  }
  return `${parentBucket}|col${spec.columnIndex}`;
}

/** Split zone specs into contiguous pipeline-column runs per account and region. */
export function buildPipelineGeoColumnRuns(
  specs: readonly PipelineZoneFrameSpec[],
  allSpecs?: readonly PipelineZoneFrameSpec[],
): PipelineGeoColumnRun[] {
  const universe = allSpecs ?? specs;
  const multiRegionColumns = new Set<number>();

  const regionsByAccountColumn = new Map<string, Map<number, Set<string>>>();
  for (const spec of universe) {
    let colMap = regionsByAccountColumn.get(spec.accountId);
    if (!colMap) {
      colMap = new Map();
      regionsByAccountColumn.set(spec.accountId, colMap);
    }
    const regions = colMap.get(spec.columnIndex) ?? new Set<string>();
    regions.add(spec.region);
    colMap.set(spec.columnIndex, regions);
    if (regions.size > 1) {
      multiRegionColumns.add(spec.columnIndex);
    }
  }

  const byAccountRegion = new Map<
    string,
    Map<number, PipelineZoneFrameSpec[]>
  >();

  for (const spec of specs) {
    const arKey = regionGroupKey(spec.accountId, spec.region);
    let colMap = byAccountRegion.get(arKey);
    if (!colMap) {
      colMap = new Map();
      byAccountRegion.set(arKey, colMap);
    }
    const list = colMap.get(spec.columnIndex) ?? [];
    list.push(spec);
    colMap.set(spec.columnIndex, list);
  }

  const runs: PipelineGeoColumnRun[] = [];

  for (const [arKey, colMap] of byAccountRegion) {
    const sep = arKey.indexOf("|");
    const accountId = sep >= 0 ? arKey.slice(0, sep) : arKey;
    const region = sep >= 0 ? arKey.slice(sep + 1) : "unknown-region";
    const columns = [...colMap.keys()].sort((a, b) => a - b);

    for (let i = 0; i < columns.length; ) {
      const col = columns[i]!;
      if (multiRegionColumns.has(col)) {
        runs.push({
          accountId,
          region,
          minColumn: col,
          maxColumn: col,
          specs: [...(colMap.get(col) ?? [])],
        });
        i += 1;
        continue;
      }

      const runCols: number[] = [col];
      while (i + 1 < columns.length) {
        const nextCol = columns[i + 1]!;
        if (
          nextCol !== runCols[runCols.length - 1]! + 1 ||
          multiRegionColumns.has(nextCol)
        ) {
          break;
        }
        i += 1;
        runCols.push(nextCol);
      }

      const minColumn = runCols[0]!;
      const maxColumn = runCols[runCols.length - 1]!;
      const runSpecs: PipelineZoneFrameSpec[] = [];
      for (const runCol of runCols) {
        runSpecs.push(...(colMap.get(runCol) ?? []));
      }
      runs.push({ accountId, region, minColumn, maxColumn, specs: runSpecs });
      i += 1;
    }
  }

  return runs.sort(
    (a, b) =>
      a.accountId.localeCompare(b.accountId) ||
      a.region.localeCompare(b.region) ||
      a.minColumn - b.minColumn,
  );
}

function pipelineVpcFrameIdForRun(
  vpcKey: string,
  run: PipelineGeoColumnRun,
): string {
  return `tf-pipe-vpc:${vpcKey}|c${run.minColumn}-${run.maxColumn}`;
}

function pipelineRegionFrameIdForRun(run: PipelineGeoColumnRun): string {
  return `tf-pipe-region:${run.accountId}/${run.region}/c${run.minColumn}-${run.maxColumn}`;
}

function zoneLabelForGeo(geo: PipelineGeoPath): string {
  return geo.tier === "regional"
    ? "Regional"
    : `${geo.vpcId ? "VPC" : "Zone"} · ${pipelineGeoTierLabel(geo.tier)}`;
}

function unionZoneBounds(a: Bounds, b: Bounds): Bounds {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/** Coalesce key when fanout lanes share the same geo parent bucket, tier label, and column. */
export function pipelineZoneCoalesceKey(
  spec: PipelineZoneFrameSpec,
): string | null {
  const parentBucket = spec.vpcKey ?? spec.regionalBandKey;
  if (!parentBucket) {
    return null;
  }
  return `${parentBucket}|${spec.label}|col${spec.columnIndex}`;
}

function pipelineZoneFrameIdFromCoalesceKey(coalesceKey: string): string {
  return `tf-pipe-zone:${coalesceKey.replace(/\|/g, ":")}`;
}

function mergedZonePath(first: ZoneFrameSpec): string[] {
  if (first.vpcKey) {
    const parts = first.vpcKey.split("|");
    return [
      parts[0] ?? first.accountId,
      parts[1] ?? first.region,
      parts[2] ?? "vpc",
      parts[3] ?? "0",
      String(first.columnIndex),
    ];
  }
  const bandParts = first.regionalBandKey?.split("|");
  const geoInstanceId = bandParts?.[3] ?? "0";
  return [
    first.accountId,
    first.region,
    "regional",
    geoInstanceId,
    String(first.columnIndex),
  ];
}

/** Merge leaf subnetZone specs that share the same geographic parent and pipeline column. */
export function coalescePipelineZoneSpecs(
  zoneSpecs: Map<string, ZoneFrameSpec>,
): Map<string, ZoneFrameSpec> {
  const groups = new Map<string, ZoneFrameSpec[]>();

  for (const spec of zoneSpecs.values()) {
    const coalesceKey = pipelineZoneCoalesceKey(spec);
    if (!coalesceKey) {
      continue;
    }
    const group = groups.get(coalesceKey) ?? [];
    group.push(spec);
    groups.set(coalesceKey, group);
  }

  const out = new Map<string, ZoneFrameSpec>();

  for (const [coalesceKey, group] of groups) {
    if (group.length === 1) {
      const only = group[0]!;
      out.set(only.id, only);
      continue;
    }

    const sorted = [...group].sort((a, b) => a.laneIndex - b.laneIndex);
    const first = sorted[0]!;
    let bounds = first.bounds;
    const clusterFrameIds: string[] = [...first.clusterFrameIds];
    let minLane = first.laneIndex;

    for (let i = 1; i < sorted.length; i++) {
      const spec = sorted[i]!;
      bounds = unionZoneBounds(bounds, spec.bounds);
      clusterFrameIds.push(...spec.clusterFrameIds);
      minLane = Math.min(minLane, spec.laneIndex);
    }

    const id = pipelineZoneFrameIdFromCoalesceKey(coalesceKey);
    out.set(id, {
      id,
      label: first.label,
      role: "subnetZone",
      path: mergedZonePath(first),
      bounds,
      clusterFrameIds,
      vpcKey: first.vpcKey,
      regionalBandKey: first.regionalBandKey,
      accountId: first.accountId,
      region: first.region,
      columnIndex: first.columnIndex,
      laneIndex: minLane,
    });
  }

  return out;
}

/** @deprecated Use {@link pipelineZoneCoalesceKey}. */
export const regionalZoneCoalesceKey = pipelineZoneCoalesceKey;

/** @deprecated Use {@link coalescePipelineZoneSpecs}. */
export const coalesceRegionalZoneSpecs = coalescePipelineZoneSpecs;

function collectLayoutBoxesFromSkeleton(
  skeleton: readonly ExcalidrawElementSkeleton[],
): Record<string, TerraformDependencyLayoutBox> {
  const boxes: Record<string, TerraformDependencyLayoutBox> = {};
  for (const el of skeleton) {
    if (el.type !== "rectangle" || typeof el.id !== "string") {
      continue;
    }
    const cd = el.customData as Record<string, unknown> | undefined;
    if (cd?.terraformVisibilityRole !== "resource") {
      continue;
    }
    boxes[el.id] = {
      x: el.x ?? 0,
      y: el.y ?? 0,
      width: el.width ?? 0,
      height: el.height ?? 0,
    };
  }
  return boxes;
}

function normalizeOrigin(elements: ExcalidrawElement[]) {
  let minX = Infinity;
  let minY = Infinity;
  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return;
  }
  const dx = MARGIN - minX;
  const dy = MARGIN - minY;
  if (dx === 0 && dy === 0) {
    return;
  }
  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }
    (el as { x: number; y: number }).x += dx;
    (el as { y: number }).y += dy;
  }
}

export async function buildTerraformPipelineExcalidrawScene(
  nodes: TerraformPlanNodesMap,
  plan: unknown,
  tfdTexts: readonly string[],
  options: {
    pipelineLayoutMode?: TerraformPipelineLayoutMode;
    pipelineVerticalSolverMode?: TerraformPipelineVerticalSolverMode;
  } = {},
): Promise<{
  elements: ExcalidrawElement[];
  meta: TerraformPipelineSceneMeta;
  files?: BinaryFiles;
}> {
  const atomGraph = buildPipelineAtomGraph(nodes, plan, tfdTexts);
  const pipelineLayoutMode =
    options.pipelineLayoutMode ?? DEFAULT_TERRAFORM_PIPELINE_LAYOUT_MODE;
  const pipelineVerticalSolverMode =
    options.pipelineVerticalSolverMode ??
    DEFAULT_TERRAFORM_PIPELINE_VERTICAL_SOLVER_MODE;
  if (!atomGraph || atomGraph.atoms.size === 0) {
    return {
      elements: [],
      meta: {
        layoutEngine: "pipeline",
        pipelineLayoutMode,
        pipelineVerticalSolverMode,
        atomCount: 0,
        columnCount: 0,
        geoInstanceCount: 0,
        declaredEdgeCount: 0,
        skippedLayout: true,
        skipReason: "empty_pipeline",
      },
    };
  }

  const geoMap = buildPipelineAtomGeoMap(atomGraph, nodes, plan);
  const layoutPlan = buildPipelineLayoutPlan(
    atomGraph,
    geoMap,
    pipelineLayoutMode,
  );

  const clusterBuilds = new Map<string, ClusterBuild>();
  for (const placement of layoutPlan.placements) {
    const { primaryAddress, geo } = placement;
    if (clusterBuilds.has(primaryAddress)) {
      continue;
    }
    const built = buildTopologyPrimaryClusterSkeletonForPipeline(
      primaryAddress,
      nodes,
      plan,
      {
        accountId: geo.accountId,
        region: geo.region,
        vpcId: geo.vpcId,
      },
    );
    clusterBuilds.set(primaryAddress, {
      primaryAddress,
      ...built,
    });
  }

  const columnWidths: number[] = layoutPlan.columns.map((col) => {
    let maxW = 0;
    for (const addr of col.atoms) {
      if (isTfdHopAtom(atomGraph, addr)) {
        continue;
      }
      const b = clusterBuilds.get(addr);
      if (b) {
        maxW = Math.max(maxW, b.width);
      }
    }
    return maxW + 2 * INNER_PAD + COLUMN_GAP / 2;
  });

  const contentTop = AWS_FRAME_PAD;

  const slotHeight = new Map<string, number>();
  for (const [addr, build] of clusterBuilds) {
    slotHeight.set(addr, rowHeightForClusterSlot(build));
  }
  const { colByAtom } = buildColumnPackInputs(layoutPlan, slotHeight);
  assignPipelineColumnPackedY(
    layoutPlan.placements,
    layoutPlan.columns,
    atomGraph.edges,
    slotHeight,
    colByAtom,
  );
  const verticalSolverResult = await applyPipelineVerticalSolver(
    layoutPlan.placements,
    layoutPlan.columns,
    atomGraph.edges,
    slotHeight,
    colByAtom,
    { mode: pipelineVerticalSolverMode },
  );

  const packedSpanCenter = packedSpanCenterY(layoutPlan.placements, contentTop);
  const accountBands = buildPipelineAccountLaneBands(layoutPlan.placements);
  const multiAccountBandLayout = accountBands.length > 1;
  let rowGeo = computePipelineRowGeometry(
    layoutPlan,
    clusterBuilds,
    contentTop,
    undefined,
    accountBands,
    multiAccountBandLayout,
  );

  const columnXByIndex = new Map<number, number>();
  let columnX = AWS_FRAME_PAD;
  for (const col of layoutPlan.columns) {
    columnXByIndex.set(col.columnIndex, columnX);
    columnX += (columnWidths[col.columnIndex] ?? MIN_FRAME_W) + COLUMN_GAP;
  }

  const accountLaneIndicesByAccount = new Map(
    accountBands.map((band) => [
      band.accountId,
      [...band.laneIndices].sort((a, b) => a - b),
    ]),
  );
  const firstFanoutCol = firstMultiLaneColumnIndex(layoutPlan.columns);

  const buildDrafts = (geo: PipelineRowGeometry): ClusterPlacementDraft[] => {
    const drafts: ClusterPlacementDraft[] = [];
    for (const col of layoutPlan.columns) {
      const colX = columnXByIndex.get(col.columnIndex) ?? AWS_FRAME_PAD;
      const preFanoutColumn =
        col.laneCount === 1 &&
        firstFanoutCol >= 0 &&
        col.columnIndex < firstFanoutCol;
      for (let lane = 0; lane < col.atoms.length; lane++) {
        const addr = col.atoms[lane]!;
        if (isTfdHopAtom(atomGraph, addr)) {
          continue;
        }
        const placement = layoutPlan.placements.find(
          (p) => p.primaryAddress === addr && p.columnIndex === col.columnIndex,
        );
        if (!placement) {
          continue;
        }
        const build = clusterBuilds.get(addr);
        if (!build) {
          continue;
        }
        const clusterX = colX + INNER_PAD;
        const clusterY = clusterYForPlacement(
          col,
          col.columnIndex,
          placement.laneIndex,
          build,
          geo,
          layoutPlan.columns,
          contentTop,
          placement,
          packedSpanCenter,
          accountLaneIndicesByAccount.get(placement.geo.accountId),
          multiAccountBandLayout,
        );
        const vpcKey = placement.geo.vpcId
          ? `${placement.geo.accountId}|${placement.geo.region}|${placement.geo.vpcId}|${placement.geoInstanceId}`
          : null;
        const regionalBandKey =
          placement.geo.tier === "regional"
            ? `${placement.geo.accountId}|${placement.geo.region}|regional|${placement.geoInstanceId}`
            : null;
        const trackKey = placement.trackId ?? "other";
        const zoneKey = `${placement.geoInstanceKey}|col${col.columnIndex}|track${trackKey}`;
        drafts.push({
          col,
          lane: placement.laneIndex,
          placement,
          build,
          columnX: colX,
          clusterX,
          clusterY,
          bounds: clusterBoundsForZone(clusterX, clusterY, build),
          vpcKey,
          regionalBandKey,
          zoneKey,
          zoneFrameId: `tf-pipe-zone:${zoneKey}`,
          preFanoutColumn,
        });
      }
    }
    return drafts;
  };

  let drafts = buildDrafts(rowGeo);
  if (
    inflateRowHeightsFromZoneBounds(
      rowGeo.rowHeights,
      drafts,
      contentTop,
      accountLaneIndicesByAccount,
      multiAccountBandLayout,
      accountBands,
    )
  ) {
    rowGeo = computePipelineRowGeometry(
      layoutPlan,
      clusterBuilds,
      contentTop,
      rowGeo.rowHeights,
      accountBands,
      multiAccountBandLayout,
    );
    drafts = buildDrafts(rowGeo);
  }

  const skeleton: ExcalidrawElementSkeleton[] = [];
  const zoneSpecs = new Map<string, ZoneFrameSpec>();

  populateSkeletonFromDrafts(drafts, skeleton, zoneSpecs);
  if (
    inflateRowHeightsFromZoneSpecBounds(
      rowGeo.rowHeights,
      zoneSpecs,
      contentTop,
      accountBands,
      multiAccountBandLayout,
    )
  ) {
    rowGeo = computePipelineRowGeometry(
      layoutPlan,
      clusterBuilds,
      contentTop,
      rowGeo.rowHeights,
      accountBands,
      multiAccountBandLayout,
    );
    skeleton.length = 0;
    zoneSpecs.clear();
    drafts = buildDrafts(rowGeo);
    populateSkeletonFromDrafts(drafts, skeleton, zoneSpecs);
  }

  // Pass 2: AWS → account → region → vpc → subnetZone (container bounds from children post-convert).
  const coalescedZoneSpecs = coalescePipelineZoneSpecs(zoneSpecs);
  const zoneFrames: ExcalidrawElementSkeleton[] = [];
  for (const spec of coalescedZoneSpecs.values()) {
    zoneFrames.push(
      leafZoneFrameSkeleton(
        spec.id,
        spec.label,
        spec.bounds.x,
        spec.bounds.y,
        spec.bounds.width,
        spec.bounds.height,
        spec.clusterFrameIds,
        spec.path,
      ),
    );
  }

  const bandFilteredSpecs = [...coalescedZoneSpecs.values()].filter((spec) =>
    specInAccountBand(spec, accountBands, multiAccountBandLayout),
  );
  const columnRuns = buildPipelineGeoColumnRuns(
    bandFilteredSpecs,
    bandFilteredSpecs,
  );

  const vpcFrames: ExcalidrawElementSkeleton[] = [];
  const regionFrames: ExcalidrawElementSkeleton[] = [];
  const accountRegionIds = new Map<string, string[]>();
  const regionRunByFrameId = new Map<string, PipelineGeoColumnRun>();

  for (const run of columnRuns) {
    const vpcByKey = new Map<string, ZoneFrameSpec[]>();
    const regionalZoneIds: string[] = [];

    for (const spec of run.specs) {
      if (spec.vpcKey) {
        const list = vpcByKey.get(spec.vpcKey) ?? [];
        list.push(spec);
        vpcByKey.set(spec.vpcKey, list);
      } else {
        regionalZoneIds.push(spec.id);
      }
    }

    const vpcFrameIds: string[] = [];
    for (const [vpcKey, zones] of vpcByKey) {
      const parts = vpcKey.split("|");
      const vpcId = parts[2] ?? "vpc";
      const vpcFrameId = pipelineVpcFrameIdForRun(vpcKey, run);
      vpcFrameIds.push(vpcFrameId);
      vpcFrames.push(
        containerFrameSkeleton(
          vpcFrameId,
          `VPC ${vpcId.slice(0, 16)}`,
          zones.map((z) => z.id),
          "vpc",
          [
            run.accountId,
            run.region,
            vpcId,
            parts[3] ?? "0",
            String(run.minColumn),
          ],
        ),
      );
    }

    const regionChildIds = [...vpcFrameIds, ...regionalZoneIds];
    if (regionChildIds.length === 0) {
      continue;
    }

    const regionFrameId = pipelineRegionFrameIdForRun(run);
    regionRunByFrameId.set(regionFrameId, run);
    regionFrames.push(
      containerFrameSkeleton(
        regionFrameId,
        run.region,
        regionChildIds,
        "region",
        [
          run.accountId,
          run.region,
          String(run.minColumn),
          String(run.maxColumn),
        ],
      ),
    );
    const regionIds = accountRegionIds.get(run.accountId) ?? [];
    regionIds.push(regionFrameId);
    accountRegionIds.set(run.accountId, regionIds);
  }

  const accountFrames: ExcalidrawElementSkeleton[] = [];
  for (const band of accountBands) {
    const regionIds = (accountRegionIds.get(band.accountId) ?? []).filter(
      (regionFrameId) => {
        if (!multiAccountBandLayout) {
          return true;
        }
        const run = regionRunByFrameId.get(regionFrameId);
        return (
          run?.specs.some((z) => band.laneIndices.has(z.laneIndex)) ?? false
        );
      },
    );
    if (regionIds.length === 0) {
      continue;
    }
    accountFrames.push(
      containerFrameSkeleton(
        `tf-pipe-account:${band.accountId}`,
        `Account ${band.accountId}`,
        regionIds,
        "account",
        [band.accountId],
      ),
    );
  }

  const awsFrames: ExcalidrawElementSkeleton[] = [];
  if (accountFrames.length > 0) {
    awsFrames.push(
      containerFrameSkeleton(
        "tf-pipe-provider:aws",
        "AWS",
        accountFrames.map((f) => f.id!),
        "provider",
        ["aws"],
        { terraformProviderFamily: "aws" },
      ),
    );
  }

  // Inner → outer so convertToExcalidrawElements sizes parents from sized children.
  skeleton.push(
    ...zoneFrames,
    ...vpcFrames,
    ...regionFrames,
    ...accountFrames,
    ...awsFrames,
  );

  const layoutBoxes = collectLayoutBoxesFromSkeleton(skeleton);
  const declaredEdges = nodes[DECLARED_DATAFLOW_ORDERED_KEY] ?? [];

  const declaredEdgeRecords = declaredEdges.map((e) => ({
    source: e.source,
    target: e.target,
    type: "declared_dataflow",
    label: "declared",
    origin: "tfd" as const,
    detail: String(e.sequence),
  }));

  skeleton.push(
    ...buildPipelineDeclaredDataFlowLineSkeletons(
      nodes,
      layoutBoxes,
      declaredEdgeRecords,
      { pipelineVerticalSolverMode: verticalSolverResult.appliedMode },
    ),
  );

  for (const el of skeleton) {
    if (el.customData && typeof el.customData === "object") {
      (el as { customData: Record<string, unknown> }).customData = {
        ...(el.customData as Record<string, unknown>),
        terraformPipelineOverview: true,
      };
    }
  }

  let elements = convertToExcalidrawElements(skeleton, {
    regenerateIds: true,
  }) as ExcalidrawElement[];

  resizePipelineContainerFrames(elements);
  if (multiAccountBandLayout) {
    alignMultiAccountPipelineFrames(elements, accountBands);
  }

  elements = mirrorAndDetachTerraformResourceLabels(elements);
  elements = await injectTerraformAwsIconsIntoElements(elements);
  elements = reconcileTerraformVisibility(
    repairTerraformEdgeBindings(elements),
    {
      pins: {
        ...TERRAFORM_IMPORT_EDGE_LAYER_PINS,
        declaredDataFlow: true,
      },
      hoverPeekKey: null,
    },
  );
  elements = reorderTopologyElementsZStack(elements);
  normalizeOrigin(elements);

  return {
    elements,
    meta: {
      layoutEngine: "pipeline",
      pipelineLayoutMode,
      pipelineVerticalSolverMode: verticalSolverResult.appliedMode,
      atomCount: atomGraph.atoms.size,
      columnCount: layoutPlan.columns.length,
      geoInstanceCount: layoutPlan.geoInstanceCount,
      declaredEdgeCount: declaredEdges.length,
      ...(verticalSolverResult.warnings.length > 0
        ? {
            warnings: verticalSolverResult.warnings.map(
              (w) => `Pipeline vertical ${w.mode}: ${w.message}`,
            ),
          }
        : {}),
    },
  };
}
