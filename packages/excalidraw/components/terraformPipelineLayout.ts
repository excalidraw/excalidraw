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
import { buildPipelineAtomGraph } from "./terraformPipelineAtoms";
import {
  buildPipelineLayoutPlan,
  type PipelineColumn,
} from "./terraformPipelineContainers";
import { buildPipelineDeclaredDataFlowLineSkeletons } from "./terraformPipelineEdges";
import {
  buildPipelineAtomGeoMap,
  pipelineGeoTierLabel,
  type PipelineGeoPath,
} from "./terraformPipelineGeo";
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
const MIN_FRAME_W = px(200);
const MIN_FRAME_H = px(160);

export type TerraformPipelineSceneMeta = {
  layoutEngine: "pipeline";
  atomCount: number;
  columnCount: number;
  geoInstanceCount: number;
  declaredEdgeCount: number;
  skippedLayout?: boolean;
  skipReason?: string;
};

type ClusterBuild = {
  primaryAddress: string;
  skeleton: ExcalidrawElementSkeleton[];
  width: number;
  height: number;
  clusterFrameId: string;
};

type Bounds = { x: number; y: number; width: number; height: number };

type ZoneFrameSpec = {
  id: string;
  label: string;
  role: string;
  path: string[];
  bounds: Bounds;
  clusterFrameIds: string[];
  vpcKey: string | null;
  regionalBandKey: string | null;
};

type PipelineRowGeometry = {
  maxLaneCount: number;
  rowHeights: number[];
  rowTops: number[];
  sharedColumnHeight: number;
};

function computePipelineRowGeometry(
  layoutPlan: { columns: PipelineColumn[] },
  clusterBuilds: Map<string, ClusterBuild>,
  contentTop: number,
): PipelineRowGeometry {
  const maxLaneCount = Math.max(
    1,
    ...layoutPlan.columns.map((c) => c.laneCount),
  );
  const rowHeights = Array.from({ length: maxLaneCount }, () => px(88));

  for (const col of layoutPlan.columns) {
    for (let lane = 0; lane < col.atoms.length; lane++) {
      const addr = col.atoms[lane];
      const build = addr ? clusterBuilds.get(addr) : undefined;
      if (build) {
        rowHeights[lane] = Math.max(
          rowHeights[lane]!,
          minRowHeightForPrimaryCenteredCluster(build),
        );
      }
    }
  }

  const rowTops: number[] = [];
  let y = contentTop + INNER_PAD;
  for (let i = 0; i < maxLaneCount; i++) {
    rowTops[i] = y;
    y += rowHeights[i]! + LANE_GAP;
  }

  return {
    maxLaneCount,
    rowHeights,
    rowTops,
    sharedColumnHeight: y - contentTop + INNER_PAD,
  };
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

function firstMultiLaneColumnIndex(columns: readonly PipelineColumn[]): number {
  return columns.findIndex((c) => c.laneCount > 1);
}

function fanoutSpanCenterY(rowGeo: PipelineRowGeometry): number {
  const { rowHeights, rowTops, maxLaneCount } = rowGeo;
  const spanTop = rowTops[0]!;
  const spanBottom = rowTops[maxLaneCount - 1]! + rowHeights[maxLaneCount - 1]!;
  return (spanTop + spanBottom) / 2;
}

function clusterYForPlacement(
  col: PipelineColumn,
  colIdx: number,
  lane: number,
  build: ClusterBuild,
  rowGeo: PipelineRowGeometry,
  columns: readonly PipelineColumn[],
): number {
  const { rowHeights, rowTops, maxLaneCount } = rowGeo;
  const primaryCy = primaryResourceCenterYInCluster(build);
  const firstFanoutCol = firstMultiLaneColumnIndex(columns);

  let rowCenterY: number;
  if (col.laneCount === 1 && firstFanoutCol >= 0 && colIdx < firstFanoutCol) {
    rowCenterY = fanoutSpanCenterY(rowGeo);
  } else if (col.laneCount === maxLaneCount) {
    rowCenterY = rowTops[lane]! + rowHeights[lane]! / 2;
  } else {
    rowCenterY = rowTops[0]! + rowHeights[0]! / 2;
  }

  return rowCenterY - primaryCy;
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

function frameSkeleton(
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  children: readonly string[],
  role: string,
  path: string[],
): ExcalidrawElementSkeleton {
  return {
    type: "frame",
    id,
    name: name.slice(0, 48),
    x,
    y,
    width: Math.max(width, MIN_FRAME_W),
    height: Math.max(height, MIN_FRAME_H),
    children,
    customData: {
      terraform: true,
      terraformPipelineOverview: true,
      terraformTopologyRole: role,
      terraformTopologyPath: path,
    },
  };
}

function unionBounds(items: readonly Bounds[], pad: number): Bounds {
  if (items.length === 0) {
    return { x: 0, y: 0, width: MIN_FRAME_W, height: MIN_FRAME_H };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of items) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + 2 * pad,
    height: maxY - minY + 2 * pad,
  };
}

function zoneLabelForGeo(geo: PipelineGeoPath): string {
  return geo.tier === "regional"
    ? "Regional"
    : `${geo.vpcId ? "VPC" : "Zone"} · ${pipelineGeoTierLabel(geo.tier)}`;
}

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
): Promise<{
  elements: ExcalidrawElement[];
  meta: TerraformPipelineSceneMeta;
  files?: BinaryFiles;
}> {
  const atomGraph = buildPipelineAtomGraph(nodes, plan, tfdTexts);
  if (!atomGraph || atomGraph.atoms.size === 0) {
    return {
      elements: [],
      meta: {
        layoutEngine: "pipeline",
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
  const layoutPlan = buildPipelineLayoutPlan(atomGraph, geoMap);

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
      const b = clusterBuilds.get(addr);
      if (b) {
        maxW = Math.max(maxW, b.width);
      }
    }
    return maxW + 2 * INNER_PAD;
  });

  const contentTop = AWS_FRAME_PAD;
  const rowGeo = computePipelineRowGeometry(
    layoutPlan,
    clusterBuilds,
    contentTop,
  );
  const sharedColumnHeight = rowGeo.sharedColumnHeight;

  const skeleton: ExcalidrawElementSkeleton[] = [];
  const zoneSpecs = new Map<string, ZoneFrameSpec>();

  let columnX = AWS_FRAME_PAD;

  // Pass 1: place primaryCluster skeletons; accumulate zone frame specs.
  for (const col of layoutPlan.columns) {
    const colW = columnWidths[col.columnIndex] ?? MIN_FRAME_W;
    const colH = sharedColumnHeight;

    const columnPlacement = layoutPlan.placements.find(
      (p) => p.columnIndex === col.columnIndex,
    );
    const zoneKey =
      columnPlacement != null
        ? `${columnPlacement.geoInstanceKey}|col${col.columnIndex}`
        : `col${col.columnIndex}`;
    const zoneFrameId = `tf-pipe-zone:${zoneKey}`;

    for (let lane = 0; lane < col.atoms.length; lane++) {
      const addr = col.atoms[lane]!;
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

      const clusterX = columnX + INNER_PAD;
      const clusterY = clusterYForPlacement(
        col,
        col.columnIndex,
        lane,
        build,
        rowGeo,
        layoutPlan.columns,
      );

      skeleton.push(...translateSkeleton(build.skeleton, clusterX, clusterY));

      const vpcKey = placement.geo.vpcId
        ? `${placement.geo.accountId}|${placement.geo.region}|${placement.geo.vpcId}|${placement.geoInstanceId}`
        : null;
      const regionalBandKey =
        placement.geo.tier === "regional"
          ? `${placement.geo.accountId}|${placement.geo.region}|regional|${placement.geoInstanceId}`
          : null;

      let spec = zoneSpecs.get(zoneKey);
      if (!spec) {
        spec = {
          id: zoneFrameId,
          label: zoneLabelForGeo(placement.geo),
          role:
            placement.geo.tier === "regional" ? "regionalBand" : "subnetZone",
          path: [
            placement.geo.accountId,
            placement.geo.region,
            placement.geo.vpcId ?? "regional",
            String(placement.geoInstanceId),
            String(col.columnIndex),
          ],
          bounds: {
            x: columnX,
            y: contentTop,
            width: colW,
            height: colH,
          },
          clusterFrameIds: [],
          vpcKey,
          regionalBandKey,
        };
        zoneSpecs.set(zoneKey, spec);
      }

      if (!spec.clusterFrameIds.includes(build.clusterFrameId)) {
        spec.clusterFrameIds.push(build.clusterFrameId);
      }
    }

    columnX += colW + COLUMN_GAP;
  }

  // Pass 2: emit zone → vpc/regional → region → account frames (one id each).
  const zoneFrames: ExcalidrawElementSkeleton[] = [];
  for (const spec of zoneSpecs.values()) {
    zoneFrames.push(
      frameSkeleton(
        spec.id,
        spec.label,
        spec.bounds.x,
        spec.bounds.y,
        spec.bounds.width,
        spec.bounds.height,
        spec.clusterFrameIds,
        spec.role,
        spec.path,
      ),
    );
  }

  const vpcZoneGroups = new Map<string, ZoneFrameSpec[]>();
  const regionalZoneGroups = new Map<string, ZoneFrameSpec[]>();
  for (const spec of zoneSpecs.values()) {
    if (spec.vpcKey && spec.role !== "regionalBand") {
      const list = vpcZoneGroups.get(spec.vpcKey) ?? [];
      list.push(spec);
      vpcZoneGroups.set(spec.vpcKey, list);
    } else if (spec.regionalBandKey) {
      const list = regionalZoneGroups.get(spec.regionalBandKey) ?? [];
      list.push(spec);
      regionalZoneGroups.set(spec.regionalBandKey, list);
    }
  }

  const vpcFrames: ExcalidrawElementSkeleton[] = [];
  const vpcFrameIdByKey = new Map<string, string>();
  for (const [vpcKey, zones] of vpcZoneGroups) {
    const vpcFrameId = `tf-pipe-vpc:${vpcKey}`;
    vpcFrameIdByKey.set(vpcKey, vpcFrameId);
    const bounds = unionBounds(
      zones.map((z) => z.bounds),
      FRAME_PAD,
    );
    const parts = vpcKey.split("|");
    const vpcId = parts[2] ?? "vpc";
    vpcFrames.push(
      frameSkeleton(
        vpcFrameId,
        `VPC ${vpcId.slice(0, 16)}`,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        zones.map((z) => z.id),
        "vpc",
        [parts[0] ?? "", parts[1] ?? "", vpcId, parts[3] ?? "0"],
      ),
    );
  }

  const regionalBandFrames: ExcalidrawElementSkeleton[] = [];
  const regionalBandIdByKey = new Map<string, string>();
  for (const [regKey, zones] of regionalZoneGroups) {
    const bandId = `tf-pipe-regional:${regKey}`;
    regionalBandIdByKey.set(regKey, bandId);
    const bounds = unionBounds(
      zones.map((z) => z.bounds),
      FRAME_PAD,
    );
    const parts = regKey.split("|");
    regionalBandFrames.push(
      frameSkeleton(
        bandId,
        "Regional",
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        zones.map((z) => z.id),
        "regionalBand",
        [parts[0] ?? "", parts[1] ?? "", "regional", parts[3] ?? "0"],
      ),
    );
  }

  const accountId =
    layoutPlan.placements[0]?.geo.accountId ?? "unknown-account";
  const region = layoutPlan.placements[0]?.geo.region ?? "unknown-region";

  const regionChildIds = [
    ...vpcFrames.map((f) => f.id!),
    ...regionalBandFrames.map((f) => f.id!),
  ];
  const regionBounds = unionBounds(
    [...vpcFrames, ...regionalBandFrames].map((f) => ({
      x: f.x ?? 0,
      y: f.y ?? 0,
      width: f.width ?? MIN_FRAME_W,
      height: f.height ?? MIN_FRAME_H,
    })),
    AWS_FRAME_PAD / 2,
  );

  const regionFrameId = `tf-pipe-region:${accountId}/${region}`;
  const accountFrameId = `tf-pipe-account:${accountId}`;

  const regionFrame = frameSkeleton(
    regionFrameId,
    region,
    regionBounds.x,
    regionBounds.y,
    regionBounds.width,
    regionBounds.height,
    regionChildIds,
    "region",
    [accountId, region],
  );

  const accountBounds = unionBounds([regionBounds], AWS_FRAME_PAD / 2);
  const accountFrame = frameSkeleton(
    accountFrameId,
    `Account ${accountId}`,
    accountBounds.x,
    accountBounds.y,
    accountBounds.width,
    accountBounds.height,
    [regionFrameId],
    "account",
    [accountId],
  );

  skeleton.unshift(
    accountFrame,
    regionFrame,
    ...vpcFrames,
    ...regionalBandFrames,
    ...zoneFrames,
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
      atomCount: atomGraph.atoms.size,
      columnCount: layoutPlan.columns.length,
      geoInstanceCount: layoutPlan.geoInstanceCount,
      declaredEdgeCount: declaredEdges.length,
    },
  };
}
