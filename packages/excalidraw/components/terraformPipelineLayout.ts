/**
 * TFD pipeline layout: geographic frames + primaryCluster atoms left-to-right.
 */

import { convertToExcalidrawElements } from "@excalidraw/element";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { injectTerraformAwsIconsIntoElements } from "./terraformAwsIcons";
import {
  buildTerraformDeclaredDataFlowLineSkeletons,
  mirrorAndDetachTerraformResourceLabels,
  type TerraformDependencyLayoutBox,
} from "./terraformElkLayout";
import { tfComfortPx } from "./terraformLayoutComfort";
import { DECLARED_DATAFLOW_ORDERED_KEY } from "./terraformDeclaredDataFlow";
import { buildPipelineAtomGraph } from "./terraformPipelineAtoms";
import { buildPipelineLayoutPlan } from "./terraformPipelineContainers";
import { buildPipelineAtomGeoMap, pipelineGeoTierLabel } from "./terraformPipelineGeo";
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
import type {
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

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

  const columnHeights: number[] = layoutPlan.columns.map((col) => {
    let totalH = INNER_PAD;
    for (let lane = 0; lane < col.laneCount; lane++) {
      const addr = col.atoms[lane];
      const b = addr ? clusterBuilds.get(addr) : undefined;
      totalH += (b?.height ?? px(88)) + LANE_GAP;
    }
    return totalH + INNER_PAD;
  });

  const skeleton: ExcalidrawElementSkeleton[] = [];
  const zoneFrameIds = new Map<string, string>();
  const vpcFrameIds = new Map<string, string>();
  const regionalFrameIds = new Map<string, string>();

  let columnX = AWS_FRAME_PAD;
  const contentTop = AWS_FRAME_PAD;

  for (const col of layoutPlan.columns) {
    const colW = columnWidths[col.columnIndex] ?? MIN_FRAME_W;
    const colH = columnHeights[col.columnIndex] ?? MIN_FRAME_H;
    let laneY = contentTop + INNER_PAD;

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
      const clusterY = laneY;

      const zoneKey = `${placement.geoInstanceKey}|col${col.columnIndex}`;
      let zoneFrameId = zoneFrameIds.get(zoneKey);
      if (!zoneFrameId) {
        zoneFrameId = `tf-pipe-zone:${zoneKey}`;
        zoneFrameIds.set(zoneKey, zoneFrameId);
      }

      const translated = translateSkeleton(build.skeleton, clusterX, clusterY);
      skeleton.push(...translated);

      const zoneLabel =
        placement.geo.tier === "regional"
          ? "Regional"
          : `${placement.geo.vpcId ? "VPC" : "Zone"} · ${pipelineGeoTierLabel(placement.geo.tier)}`;

      const zoneChildren = translated
        .filter((el) => el.type === "frame" && el.id === build.clusterFrameId)
        .map((el) => el.id!)
        .concat(
          translated
            .filter(
              (el) =>
                el.type === "rectangle" &&
                typeof el.id === "string" &&
                el.id !== build.clusterFrameId,
            )
            .map((el) => el.id!),
        );

      skeleton.push(
        frameSkeleton(
          zoneFrameId,
          zoneLabel,
          columnX,
          clusterY - FRAME_PAD,
          colW,
          build.height + 2 * FRAME_PAD,
          [build.clusterFrameId],
          placement.geo.tier === "regional" ? "regionalBand" : "subnetZone",
          [
            placement.geo.accountId,
            placement.geo.region,
            placement.geo.vpcId ?? "regional",
            String(placement.geoInstanceId),
            String(col.columnIndex),
          ],
        ),
      );

      if (placement.geo.vpcId) {
        const vpcKey = `${placement.geo.accountId}|${placement.geo.region}|${placement.geo.vpcId}|${placement.geoInstanceId}`;
        if (!vpcFrameIds.has(vpcKey)) {
          vpcFrameIds.set(vpcKey, `tf-pipe-vpc:${vpcKey}`);
        }
      } else {
        const regKey = `${placement.geo.accountId}|${placement.geo.region}|regional|${placement.geoInstanceId}`;
        if (!regionalFrameIds.has(regKey)) {
          regionalFrameIds.set(regKey, `tf-pipe-regional:${regKey}`);
        }
      }

      laneY += build.height + LANE_GAP;
    }

    columnX += colW + COLUMN_GAP;
  }

  const accountId =
    layoutPlan.placements[0]?.geo.accountId ?? "unknown-account";
  const region = layoutPlan.placements[0]?.geo.region ?? "unknown-region";

  const regionFrameId = `tf-pipe-region:${accountId}/${region}`;
  const accountFrameId = `tf-pipe-account:${accountId}`;

  const allZoneIds = [...zoneFrameIds.values()];
  const contentWidth = columnX - COLUMN_GAP + AWS_FRAME_PAD;
  const contentHeight =
    Math.max(...columnHeights, MIN_FRAME_H) + 2 * AWS_FRAME_PAD;

  skeleton.push(
    frameSkeleton(
      regionFrameId,
      region,
      MARGIN,
      MARGIN,
      contentWidth,
      contentHeight,
      allZoneIds,
      "region",
      [accountId, region],
    ),
  );

  skeleton.push(
    frameSkeleton(
      accountFrameId,
      `Account ${accountId}`,
      MARGIN - AWS_FRAME_PAD / 2,
      MARGIN - AWS_FRAME_PAD / 2,
      contentWidth + AWS_FRAME_PAD,
      contentHeight + AWS_FRAME_PAD,
      [regionFrameId],
      "account",
      [accountId],
    ),
  );

  const layoutBoxes = collectLayoutBoxesFromSkeleton(skeleton);
  const declaredEdges = nodes[DECLARED_DATAFLOW_ORDERED_KEY] ?? [];

  const declaredEdgeRecords = declaredEdges.map((e) => ({
    source: e.source,
    target: e.target,
    type: "declared_dataflow",
    label: "declared",
    origin: "tfd",
    detail: String(e.sequence),
  }));

  skeleton.push(
    ...buildTerraformDeclaredDataFlowLineSkeletons(
      nodes,
      layoutBoxes,
      declaredEdgeRecords,
      new Set(),
      { terraformSemanticOverview: true },
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
  elements = reconcileTerraformVisibility(repairTerraformEdgeBindings(elements), {
    pins: {
      ...TERRAFORM_IMPORT_EDGE_LAYER_PINS,
      declaredDataFlow: true,
    },
    hoverPeekKey: null,
  });
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
