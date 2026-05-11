/**
 * Deterministic nested **frame** layout for AWS topology (`extractTerraformTopologyFromPlan`).
 * Primary resources live in **subnet zones** (one frame per distinct subnet multiset).
 */

import { convertToExcalidrawElements } from "@excalidraw/element";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  applyTerraformResourceRectangleSoftDelete,
  buildTerraformResourcePanelDetails,
  getTerraformActionStyle,
  getTerraformPlanNodeAction,
  mirrorAndDetachTerraformResourceLabels,
  shortTerraformResourceLabel,
  TERRAFORM_RESOURCE_LABEL_STROKE,
} from "./terraformElkLayout";
import {
  getTerraformResourceTypeFromNodePath,
  isInitiallyVisibleTerraformResource,
} from "./terraformPrimaryVisibility";
import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";
import type {
  TopologyPlacementZone,
  TopologyRegionalPrimaryBucket,
} from "./terraformTopologyPlacement";
import type { TerraformTopologyModel } from "./terraformTopologyExtract";
import {
  buildLambdaCloudWatchCluster,
  cloudWatchSatelliteStackHeightPx,
} from "./terraformTopologyCloudWatchLinks";
import {
  buildArnIndexForTopology,
  buildLambdaIamCluster,
  iamSatelliteStackHeightPx,
  type TopologyIamEdge,
} from "./terraformTopologyIamLinks";
import {
  buildLambdaSgCluster,
  sgSatelliteStackHeightPx,
  TOPOLOGY_SG_BETWEEN_GROUPS_GAP_PX,
} from "./terraformTopologySgLinks";
import {
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
} from "./terraformVisibility";

export type TerraformTopologySceneMeta = {
  layoutEngine: "topology";
  accountCount: number;
  regionCount: number;
  vpcCount: number;
  subnetCount: number;
  primaryResourceCount: number;
  regionalPrimaryCount: number;
  skippedLayout?: boolean;
  skipReason?: string;
};

const MARGIN = 50;
const ACCOUNT_GAP = 48;
const REGION_GAP = 32;
const VPC_GAP = 28;
const VPC_TOP_PAD = 44;
const INNER_PAD = 28;
const FRAME_CONTENT_SLACK_X = 24;
const FRAME_CONTENT_SLACK_Y = 28;
const MIN_VPC_W = 480;
const MIN_VPC_H = 360;
const CANVAS_EDGE_PAD = MARGIN;

/** Match ELK module resource leaf size. */
const RESOURCE_RECT_W = 200;
const RESOURCE_RECT_H = 88;
const RESOURCE_GAP = 16;
/** IAM role / policy tiles under a Lambda in semantic topology (left column). */
const IAM_SATELLITE_W = 176;
const IAM_SATELLITE_H = 52;
const IAM_SATELLITE_GAP = 8;
const IAM_SATELLITE_X_PAD = 6;
const IAM_DATAFLOW_STROKE = "#0ca678";
/** Security group + rule tiles (right column). */
const SG_SATELLITE_W = 176;
const SG_SATELLITE_H = 52;
const SG_RULE_TILE_H = 52;
const SG_RIGHT_PAD = 6;
const SG_DATAFLOW_STROKE = "#228be6";
/** CloudWatch alarm / log group tiles above a Lambda. */
const CLOUDWATCH_SATELLITE_W = 176;
const CLOUDWATCH_SATELLITE_H = 52;
const CLOUDWATCH_SATELLITE_GAP = 8;
const CLOUDWATCH_LEFT_PAD = 6;
const CLOUDWATCH_RIGHT_PAD = 6;
const CLOUDWATCH_DATAFLOW_STROKE = "#f08c00";
/** When both IAM and SG satellites exist, split tile width so columns do not overlap (cell is {@link RESOURCE_RECT_W}). */
const IAM_SG_COLUMN_GAP_PX = 8;
const CLOUDWATCH_COLUMN_GAP_PX = 8;
const MIN_SPLIT_SATELLITE_W = 86;
/** Gap between subnet-zone frames inside one VPC. */
const ZONE_CELL_GAP = 20;
/** Gap between regional-services column and VPC grid inside one region frame. */
const REGIONAL_TO_VPC_GAP = 28;

export type TerraformTopologyRole =
  | "account"
  | "region"
  | "vpc"
  | "subnetZone"
  | "regionalServices";

function skeletonId(
  role: Exclude<TerraformTopologyRole, "subnetZone" | "regionalServices">,
  accountId: string,
  region: string,
  vpcId: string | null,
): string {
  if (role === "account") {
    return `tf-topo:a=${encodeURIComponent(accountId)}`;
  }
  const base = `tf-topo:a=${encodeURIComponent(accountId)}:r=${encodeURIComponent(region)}`;
  if (role === "region") {
    return base;
  }
  if (role === "vpc" && vpcId) {
    return `${base}:vpc=${encodeURIComponent(vpcId)}`;
  }
  return base;
}

function zoneSkeletonId(
  accountId: string,
  region: string,
  vpcId: string,
  subnetSignature: string,
): string {
  const sig = subnetSignature || "__vpc_only__";
  return `${skeletonId("vpc", accountId, region, vpcId)}:zone=${encodeURIComponent(sig)}`;
}

function regionalServicesSkeletonId(accountId: string, region: string): string {
  return `${skeletonId("region", accountId, region, null)}:regional`;
}

function topologyPathFrame(
  role: TerraformTopologyRole,
  accountId: string,
  region: string,
  vpcId: string | null,
): string[] {
  if (role === "account") {
    return [accountId];
  }
  if (role === "region") {
    return [accountId, region];
  }
  if (role === "regionalServices") {
    return [accountId, region];
  }
  if (role === "subnetZone" && vpcId) {
    return [accountId, region, vpcId];
  }
  if (role === "vpc" && vpcId) {
    return [accountId, region, vpcId];
  }
  return [accountId, region];
}

function frameCustomData(
  role: TerraformTopologyRole,
  accountId: string,
  region: string,
  vpcId: string | null,
  key: string,
  extras?: { terraformSubnetIds?: string[] },
) {
  return {
    terraform: true as const,
    terraformTopologyRole: role,
    terraformTopologyKey: key,
    terraformTopologyPath: topologyPathFrame(role, accountId, region, vpcId),
    ...(extras?.terraformSubnetIds
      ? { terraformSubnetIds: extras.terraformSubnetIds }
      : {}),
  };
}

function satelliteColumnWidths(
  hasIamCluster: boolean,
  hasSgCluster: boolean,
): { iamW: number; sgW: number } {
  if (hasIamCluster && hasSgCluster) {
    const inner =
      RESOURCE_RECT_W -
      IAM_SATELLITE_X_PAD -
      SG_RIGHT_PAD -
      IAM_SG_COLUMN_GAP_PX;
    const w = Math.max(MIN_SPLIT_SATELLITE_W, Math.floor(inner / 2));
    return { iamW: w, sgW: w };
  }
  return { iamW: IAM_SATELLITE_W, sgW: SG_SATELLITE_W };
}

function cloudWatchColumnWidths(
  hasAlarms: boolean,
  hasLogGroups: boolean,
): { alarmW: number; logGroupW: number } {
  if (hasAlarms && hasLogGroups) {
    const inner =
      RESOURCE_RECT_W -
      CLOUDWATCH_LEFT_PAD -
      CLOUDWATCH_RIGHT_PAD -
      CLOUDWATCH_COLUMN_GAP_PX;
    const w = Math.max(MIN_SPLIT_SATELLITE_W, Math.floor(inner / 2));
    return { alarmW: w, logGroupW: w };
  }
  return {
    alarmW: CLOUDWATCH_SATELLITE_W,
    logGroupW: CLOUDWATCH_SATELLITE_W,
  };
}

function gridColsRows(count: number): { cols: number; rows: number } {
  if (count <= 0) {
    return { cols: 1, rows: 1 };
  }
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

/** Empty VPC shell when no placement zones. */
function vpcEmptyShellSize(): { w: number; h: number } {
  return {
    w: MIN_VPC_W + FRAME_CONTENT_SLACK_X,
    h: MIN_VPC_H + FRAME_CONTENT_SLACK_Y,
  };
}

/** Bounding box for one subnet-zone or regional frame from primary addresses + IAM stacks. */
function zoneFrameSizeForTopologyAddresses(
  sortedAddresses: readonly string[],
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  plan?: unknown,
): { w: number; h: number } {
  const n = sortedAddresses.length;
  if (n <= 0) {
    return {
      w: MIN_VPC_W + FRAME_CONTENT_SLACK_X,
      h: 180 + FRAME_CONTENT_SLACK_Y,
    };
  }
  const { cols, rows } = gridColsRows(n);
  const rowTopBase: number[] = new Array(rows).fill(0);
  const rowBottomBase: number[] = new Array(rows).fill(0);
  for (let i = 0; i < sortedAddresses.length; i++) {
    const addr = sortedAddresses[i]!;
    const r = Math.floor(i / cols);
    const cloudWatchExtra = cloudWatchSatelliteStackHeightPx(
      nodes,
      addr,
      CLOUDWATCH_SATELLITE_H,
      CLOUDWATCH_SATELLITE_GAP,
    );
    const iamExtra = iamSatelliteStackHeightPx(
      nodes,
      addr,
      arnIndex,
      IAM_SATELLITE_H,
      IAM_SATELLITE_GAP,
    );
    const sgExtra = sgSatelliteStackHeightPx(
      nodes,
      addr,
      arnIndex,
      SG_SATELLITE_H,
      SG_RULE_TILE_H,
      IAM_SATELLITE_GAP,
      plan,
    );
    rowTopBase[r] = Math.max(rowTopBase[r]!, cloudWatchExtra);
    rowBottomBase[r] = Math.max(rowBottomBase[r]!, iamExtra, sgExtra);
  }
  let innerBodyH = 0;
  for (let r = 0; r < rows; r++) {
    innerBodyH +=
      rowTopBase[r]! +
      RESOURCE_RECT_H +
      rowBottomBase[r]! +
      (r < rows - 1 ? RESOURCE_GAP : 0);
  }
  const w =
    2 * INNER_PAD +
    cols * (RESOURCE_RECT_W + RESOURCE_GAP) -
    RESOURCE_GAP +
    FRAME_CONTENT_SLACK_X;
  const h =
    VPC_TOP_PAD +
    2 * INNER_PAD +
    innerBodyH +
    FRAME_CONTENT_SLACK_Y;
  return {
    w: Math.max(MIN_VPC_W * 0.55 + FRAME_CONTENT_SLACK_X, w),
    h: Math.max(RESOURCE_RECT_H + VPC_TOP_PAD + 2 * INNER_PAD + FRAME_CONTENT_SLACK_Y, h),
  };
}

function zonesForVpc(
  zones: readonly TopologyPlacementZone[],
  accountId: string,
  region: string,
  vpcId: string,
): TopologyPlacementZone[] {
  return zones.filter(
    (z) =>
      z.accountId === accountId && z.region === region && z.vpcId === vpcId,
  );
}

/** VPC frame size that fits all subnet-zone cells for this VPC. */
function vpcFrameDimensionsForZones(
  vpcZs: readonly TopologyPlacementZone[],
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  plan?: unknown,
): { w: number; h: number; perZoneW: number; perZoneH: number; znCols: number; znRows: number } {
  if (vpcZs.length === 0) {
    const e = vpcEmptyShellSize();
    return {
      w: e.w,
      h: e.h,
      perZoneW: 0,
      perZoneH: 0,
      znCols: 0,
      znRows: 0,
    };
  }
  const { cols: znCols, rows: znRows } = gridColsRows(vpcZs.length);
  let perZoneW = 0;
  let perZoneH = 0;
  for (const z of vpcZs) {
    const sortedZ = [...z.addresses].sort();
    const d = zoneFrameSizeForTopologyAddresses(sortedZ, nodes, arnIndex, plan);
    perZoneW = Math.max(perZoneW, d.w);
    perZoneH = Math.max(perZoneH, d.h);
  }
  const innerW =
    znCols * perZoneW + (znCols > 0 ? znCols - 1 : 0) * ZONE_CELL_GAP;
  const innerH =
    znRows * perZoneH + (znRows > 0 ? znRows - 1 : 0) * ZONE_CELL_GAP;
  const w = Math.max(
    MIN_VPC_W + FRAME_CONTENT_SLACK_X,
    2 * INNER_PAD + innerW + FRAME_CONTENT_SLACK_X,
  );
  const h = Math.max(
    MIN_VPC_H + FRAME_CONTENT_SLACK_Y,
    VPC_TOP_PAD + 2 * INNER_PAD + innerH + FRAME_CONTENT_SLACK_Y,
  );
  return { w, h, perZoneW, perZoneH, znCols, znRows };
}

function countTopology(model: TerraformTopologyModel): {
  accounts: number;
  regions: number;
  vpcs: number;
  subnets: number;
} {
  let regions = 0;
  let vpcs = 0;
  let subnets = 0;
  for (const acc of model.accounts.values()) {
    regions += acc.regions.size;
    for (const reg of acc.regions.values()) {
      vpcs += reg.vpcs.size;
      for (const vpc of reg.vpcs.values()) {
        subnets += vpc.subnets.size;
      }
    }
  }
  return { accounts: model.accounts.size, regions, vpcs, subnets };
}

function shortLabel(kind: string, value: string): string {
  if (!value) {
    return kind;
  }
  const max = 52;
  return value.length > max ? `${kind}: ${value.slice(0, max - 3)}…` : `${kind}: ${value}`;
}

function zoneDisplayName(z: TopologyPlacementZone): string {
  if (z.subnetIds.length === 0) {
    return "VPC-only placement";
  }
  if (z.subnetIds.length <= 2) {
    return `Subnets: ${z.subnetIds.join(", ")}`;
  }
  return `Subnets (${z.subnetIds.length})`;
}

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

function regionalAddressesFor(
  buckets: readonly TopologyRegionalPrimaryBucket[],
  accountId: string,
  regionName: string,
): readonly string[] {
  const b = buckets.find(
    (x) => x.accountId === accountId && x.region === regionName,
  );
  return b?.addresses ?? [];
}

function pushResourceRectangleSkeleton(
  skeleton: ExcalidrawElementSkeleton[],
  addr: string,
  x: number,
  y: number,
  width: number,
  height: number,
  nodes: TerraformPlanNodesMap,
  options: {
    initiallyVisible: boolean;
    explodeParentKeys: string[];
  },
): void {
  const node = nodes[addr] as TerraformPlanGraphNode | undefined;
  const resource = getPrimaryResource(node);
  const resourceType = getTerraformResourceTypeFromNodePath(addr);
  const action = getTerraformPlanNodeAction(node);
  const actionStyle = getTerraformActionStyle(action);
  const explodeKeys = [...options.explodeParentKeys].sort();
  const explodeParent = explodeKeys[0] ?? null;

  skeleton.push({
    type: "rectangle",
    id: addr,
    x,
    y,
    width,
    height,
    strokeWidth: 1.5,
    strokeColor: actionStyle.strokeColor,
    backgroundColor: actionStyle.backgroundColor,
    roundness: { type: 3, value: 10 },
    label: {
      text: shortTerraformResourceLabel(addr),
      fontSize: 12,
      strokeColor: TERRAFORM_RESOURCE_LABEL_STROKE,
    },
    customData: {
      terraform: true,
      terraformVisibilityRole: "resource",
      terraformVisibilityKey: addr,
      terraformNodeKind: "resource",
      terraformInitiallyVisible: options.initiallyVisible,
      terraformExplodeParentKeys: explodeKeys,
      terraformExplodeParent: explodeParent,
      resourceType,
      nodePath: addr,
      action,
      terraformResources:
        resource &&
        buildTerraformResourcePanelDetails(
          addr,
          resource as Record<string, unknown>,
        ),
    },
  });
}

type TopologySatelliteLineSpec = {
  edge: TopologyIamEdge;
  origin: "topology_iam" | "topology_sg" | "topology_cloudwatch";
  strokeColor: string;
};

function buildTopologySatelliteLineSkeletons(
  specs: readonly TopologySatelliteLineSpec[],
): ExcalidrawElementSkeleton[] {
  const seen = new Set<string>();
  const out: ExcalidrawElementSkeleton[] = [];
  let edgeSeq = 0;
  for (const { edge: e, origin, strokeColor } of specs) {
    const dedupe = `${e.source}|||${e.target}|||${e.type}`;
    if (seen.has(dedupe)) {
      continue;
    }
    seen.add(dedupe);
    out.push({
      type: "line",
      id: `tf-topo-sat-edge-${edgeSeq}`,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(1, 1),
      ],
      strokeWidth: 3,
      strokeColor,
      strokeStyle: "solid",
      roundness: { type: 2 },
      endArrowhead: "arrow",
      customData: {
        terraform: true,
        terraformEdgeLayer: "dataFlow",
        relationship: {
          source: e.source,
          target: e.target,
          type: e.type,
          label: e.label,
          origin,
          detail: null,
          directed: true,
          bidirectional: false,
          directions: [],
        },
      },
    });
    edgeSeq += 1;
  }
  return out;
}

/** Primary grid + IAM (left) / SG (right) satellites and data-flow edges. */
function appendTopologyResourceRectangles(
  skeleton: ExcalidrawElementSkeleton[],
  addrs: readonly string[],
  contentOriginX: number,
  contentOriginY: number,
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  globalPlacedIamSatellites: Set<string>,
  globalPlacedSgSatellites: Set<string>,
  globalPlacedCloudWatchSatellites: Set<string>,
  satelliteLineSpecs: TopologySatelliteLineSpec[],
  plan?: unknown,
): string[] {
  const rectIds: string[] = [];
  const sorted = [...addrs].sort();
  const { cols: rcCols, rows: rcRows } = gridColsRows(sorted.length);

  const rowTopBase: number[] = new Array(rcRows).fill(0);
  const rowBottomBase: number[] = new Array(rcRows).fill(0);
  for (let ri = 0; ri < sorted.length; ri++) {
    const addr = sorted[ri]!;
    const rr = Math.floor(ri / rcCols);
    const cloudWatchExtra = cloudWatchSatelliteStackHeightPx(
      nodes,
      addr,
      CLOUDWATCH_SATELLITE_H,
      CLOUDWATCH_SATELLITE_GAP,
    );
    const iamExtra = iamSatelliteStackHeightPx(
      nodes,
      addr,
      arnIndex,
      IAM_SATELLITE_H,
      IAM_SATELLITE_GAP,
    );
    const sgExtra = sgSatelliteStackHeightPx(
      nodes,
      addr,
      arnIndex,
      SG_SATELLITE_H,
      SG_RULE_TILE_H,
      IAM_SATELLITE_GAP,
      plan,
    );
    rowTopBase[rr] = Math.max(rowTopBase[rr]!, cloudWatchExtra);
    rowBottomBase[rr] = Math.max(rowBottomBase[rr]!, iamExtra, sgExtra);
  }

  const rowOriginY: number[] = [];
  let yAcc = contentOriginY;
  for (let r = 0; r < rcRows; r++) {
    rowOriginY.push(yAcc);
    yAcc +=
      rowTopBase[r]! +
      RESOURCE_RECT_H +
      rowBottomBase[r]! +
      (r < rcRows - 1 ? RESOURCE_GAP : 0);
  }

  for (let ri = 0; ri < sorted.length; ri++) {
    const addr = sorted[ri]!;
    const rc = ri % rcCols;
    const rr = Math.floor(ri / rcCols);
    const rx = contentOriginX + rc * (RESOURCE_RECT_W + RESOURCE_GAP);
    const ry = rowOriginY[rr]! + rowTopBase[rr]!;

    const node = nodes[addr] as TerraformPlanGraphNode | undefined;
    const resourceType = getTerraformResourceTypeFromNodePath(addr);
    const action = getTerraformPlanNodeAction(node);
    const initiallyVisible = isInitiallyVisibleTerraformResource(
      resourceType,
      action,
    );

    rectIds.push(addr);
    pushResourceRectangleSkeleton(
      skeleton,
      addr,
      rx,
      ry,
      RESOURCE_RECT_W,
      RESOURCE_RECT_H,
      nodes,
      { initiallyVisible, explodeParentKeys: [] },
    );

    const { cluster, edges } = buildLambdaIamCluster(nodes, addr, arnIndex);
    const sgBuild = buildLambdaSgCluster(nodes, addr, arnIndex, plan);
    const cloudWatchBuild = buildLambdaCloudWatchCluster(nodes, addr);
    const { iamW, sgW } = satelliteColumnWidths(Boolean(cluster), Boolean(sgBuild.cluster));
    const { alarmW, logGroupW } = cloudWatchColumnWidths(
      Boolean(cloudWatchBuild.cluster?.alarms.length),
      Boolean(cloudWatchBuild.cluster?.logGroups.length),
    );

    for (const e of edges) {
      satelliteLineSpecs.push({
        edge: e,
        origin: "topology_iam",
        strokeColor: IAM_DATAFLOW_STROKE,
      });
    }
    for (const e of sgBuild.edges) {
      satelliteLineSpecs.push({
        edge: e,
        origin: "topology_sg",
        strokeColor: SG_DATAFLOW_STROKE,
      });
    }
    for (const e of cloudWatchBuild.edges) {
      satelliteLineSpecs.push({
        edge: e,
        origin: "topology_cloudwatch",
        strokeColor: CLOUDWATCH_DATAFLOW_STROKE,
      });
    }

    if (cloudWatchBuild.cluster) {
      const cloudWatchTop =
        ry -
        cloudWatchSatelliteStackHeightPx(
          nodes,
          addr,
          CLOUDWATCH_SATELLITE_H,
          CLOUDWATCH_SATELLITE_GAP,
        ) +
        CLOUDWATCH_SATELLITE_GAP;

      let yAlarm = cloudWatchTop;
      const alarmX = rx + CLOUDWATCH_LEFT_PAD;
      for (const alarmPath of cloudWatchBuild.cluster.alarms) {
        if (!globalPlacedCloudWatchSatellites.has(alarmPath)) {
          globalPlacedCloudWatchSatellites.add(alarmPath);
          rectIds.push(alarmPath);
          pushResourceRectangleSkeleton(
            skeleton,
            alarmPath,
            alarmX,
            yAlarm,
            alarmW,
            CLOUDWATCH_SATELLITE_H,
            nodes,
            {
              initiallyVisible: false,
              explodeParentKeys: [addr],
            },
          );
        }
        yAlarm += CLOUDWATCH_SATELLITE_H + CLOUDWATCH_SATELLITE_GAP;
      }

      let yLogGroup = cloudWatchTop;
      const logGroupX = rx + RESOURCE_RECT_W - logGroupW - CLOUDWATCH_RIGHT_PAD;
      for (const logGroupPath of cloudWatchBuild.cluster.logGroups) {
        if (!globalPlacedCloudWatchSatellites.has(logGroupPath)) {
          globalPlacedCloudWatchSatellites.add(logGroupPath);
          rectIds.push(logGroupPath);
          pushResourceRectangleSkeleton(
            skeleton,
            logGroupPath,
            logGroupX,
            yLogGroup,
            logGroupW,
            CLOUDWATCH_SATELLITE_H,
            nodes,
            {
              initiallyVisible: false,
              explodeParentKeys: [addr],
            },
          );
        }
        yLogGroup += CLOUDWATCH_SATELLITE_H + CLOUDWATCH_SATELLITE_GAP;
      }
    }

    if (cluster) {
      let ySat = ry + RESOURCE_RECT_H + IAM_SATELLITE_GAP;
      const satXIam = rx + IAM_SATELLITE_X_PAD;
      for (const satAddr of cluster.stack) {
        if (globalPlacedIamSatellites.has(satAddr)) {
          ySat += IAM_SATELLITE_H + IAM_SATELLITE_GAP;
          continue;
        }
        globalPlacedIamSatellites.add(satAddr);
        rectIds.push(satAddr);
        pushResourceRectangleSkeleton(
          skeleton,
          satAddr,
          satXIam,
          ySat,
          iamW,
          IAM_SATELLITE_H,
          nodes,
          {
            initiallyVisible: false,
            explodeParentKeys: [addr],
          },
        );
        ySat += IAM_SATELLITE_H + IAM_SATELLITE_GAP;
      }
    }

    if (sgBuild.cluster) {
      const satXSg = rx + RESOURCE_RECT_W - sgW - SG_RIGHT_PAD;
      let ySg = ry + RESOURCE_RECT_H + IAM_SATELLITE_GAP;
      for (let gi = 0; gi < sgBuild.cluster.groups.length; gi++) {
        const group = sgBuild.cluster.groups[gi]!;

        if (!globalPlacedSgSatellites.has(group.sgPath)) {
          globalPlacedSgSatellites.add(group.sgPath);
          rectIds.push(group.sgPath);
          pushResourceRectangleSkeleton(
            skeleton,
            group.sgPath,
            satXSg,
            ySg,
            sgW,
            SG_SATELLITE_H,
            nodes,
            {
              initiallyVisible: false,
              explodeParentKeys: [addr],
            },
          );
        }
        ySg += SG_SATELLITE_H + IAM_SATELLITE_GAP;

        for (const rulePath of group.rules) {
          if (!globalPlacedSgSatellites.has(rulePath)) {
            globalPlacedSgSatellites.add(rulePath);
            rectIds.push(rulePath);
            pushResourceRectangleSkeleton(
              skeleton,
              rulePath,
              satXSg,
              ySg,
              sgW,
              SG_RULE_TILE_H,
              nodes,
              {
                initiallyVisible: false,
                explodeParentKeys: [addr],
              },
            );
          }
          ySg += SG_RULE_TILE_H + IAM_SATELLITE_GAP;
        }

        if (gi < sgBuild.cluster.groups.length - 1) {
          ySg += TOPOLOGY_SG_BETWEEN_GROUPS_GAP_PX;
        }
      }
    }
  }

  return rectIds;
}

function normalizeTopologyOrigin(elements: readonly ExcalidrawElement[]) {
  let minX = Infinity;
  let minY = Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return;
  }
  const dx = CANVAS_EDGE_PAD - minX;
  const dy = CANVAS_EDGE_PAD - minY;
  if (dx === 0 && dy === 0) {
    return;
  }
  for (const el of elements) {
    (el as { x: number; y: number }).x = el.x + dx;
    (el as { x: number; y: number }).y = el.y + dy;
  }
}

/**
 * Nested AWS topology: account → region → VPC → subnet **zones** (multi-subnet capable) → primary rectangles.
 */
export async function buildTerraformTopologyExcalidrawScene(
  model: TerraformTopologyModel,
  zones: readonly TopologyPlacementZone[],
  regionalBuckets: readonly TopologyRegionalPrimaryBucket[],
  nodes: TerraformPlanNodesMap,
  plan?: unknown,
): Promise<{
  elements: ExcalidrawElement[];
  meta: TerraformTopologySceneMeta;
}> {
  const counts = countTopology(model);
  const regionalPrimaryCount = regionalBuckets.reduce(
    (n, b) => n + b.addresses.length,
    0,
  );
  const primaryResourceCount =
    zones.reduce((n, z) => n + z.addresses.length, 0) + regionalPrimaryCount;

  if (model.accounts.size === 0) {
    return {
      elements: [],
      meta: {
        layoutEngine: "topology",
        accountCount: 0,
        regionCount: 0,
        vpcCount: 0,
        subnetCount: 0,
        primaryResourceCount: 0,
        regionalPrimaryCount: 0,
        skippedLayout: true,
        skipReason: "empty_topology",
      },
    };
  }

  const skeleton: ExcalidrawElementSkeleton[] = [];
  const arnIndex = buildArnIndexForTopology(nodes);
  const satelliteLineSpecs: TopologySatelliteLineSpec[] = [];
  const globalPlacedIamSatellites = new Set<string>();
  const globalPlacedSgSatellites = new Set<string>();
  const globalPlacedCloudWatchSatellites = new Set<string>();

  let accountCursorX = MARGIN;
  const accountCursorY = MARGIN;

  const sortedAccounts = [...model.accounts.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [accountId, account] of sortedAccounts) {
    const accountSkId = skeletonId("account", accountId, "", null);
    const regionEntries = [...account.regions.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );

    let regionRowX = accountCursorX + INNER_PAD;
    const regionRowY = accountCursorY + VPC_TOP_PAD;
    let maxRegionBottom = regionRowY;
    let maxRegionRight = accountCursorX;

    const regionFrameIds: string[] = [];

    for (const [regionName, region] of regionEntries) {
      const vpcEntries = [...region.vpcs.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      );

      const regionalAddrs = regionalAddressesFor(
        regionalBuckets,
        accountId,
        regionName,
      );
      const hasVpc = vpcEntries.length > 0;
      const hasReg = regionalAddrs.length > 0;
      if (!hasVpc && !hasReg) {
        continue;
      }

      const regionSkId = skeletonId("region", accountId, regionName, null);
      regionFrameIds.push(regionSkId);

      let vpcCellW = MIN_VPC_W + FRAME_CONTENT_SLACK_X;
      let vpcCellH = MIN_VPC_H + FRAME_CONTENT_SLACK_Y;
      if (hasVpc) {
        for (const [vpcId] of vpcEntries) {
          const vpcZs = zonesForVpc(zones, accountId, regionName, vpcId);
          const vd = vpcFrameDimensionsForZones(vpcZs, nodes, arnIndex, plan);
          vpcCellW = Math.max(vpcCellW, vd.w);
          vpcCellH = Math.max(vpcCellH, vd.h);
        }
      }

      const { cols: vpcCols, rows: vpcRows } = hasVpc
        ? gridColsRows(vpcEntries.length)
        : { cols: 0, rows: 0 };

      const regDims = hasReg
        ? zoneFrameSizeForTopologyAddresses(
            [...regionalAddrs].sort(),
            nodes,
            arnIndex,
            plan,
          )
        : { w: 0, h: 0 };

      let vpcGridW = 0;
      let vpcGridH = 0;
      if (hasVpc && vpcCols > 0 && vpcRows > 0) {
        vpcGridW = vpcCols * (vpcCellW + VPC_GAP) - VPC_GAP;
        vpcGridH = vpcRows * (vpcCellH + VPC_GAP) - VPC_GAP;
      }

      const innerTop = regionRowY + VPC_TOP_PAD;
      const contentInnerX = regionRowX + INNER_PAD;

      let vpcGridOriginX = contentInnerX;
      const vpcGridOriginY = innerTop;

      const regionChildIds: string[] = [];

      if (hasReg) {
        const regionalSkId = regionalServicesSkeletonId(accountId, regionName);
        regionChildIds.push(regionalSkId);
        const regX = contentInnerX;
        const regY = innerTop;
        vpcGridOriginX =
          regX + regDims.w + (hasVpc ? REGIONAL_TO_VPC_GAP : 0);

        const regionalRectIds = appendTopologyResourceRectangles(
          skeleton,
          regionalAddrs,
          regX + INNER_PAD,
          regY + VPC_TOP_PAD,
          nodes,
          arnIndex,
          globalPlacedIamSatellites,
          globalPlacedSgSatellites,
          globalPlacedCloudWatchSatellites,
          satelliteLineSpecs,
          plan,
        );

        skeleton.push({
          type: "frame",
          id: regionalSkId,
          name: "Regional services",
          x: regX,
          y: regY,
          width: regDims.w,
          height: regDims.h,
          children: regionalRectIds as readonly string[],
          customData: frameCustomData(
            "regionalServices",
            accountId,
            regionName,
            null,
            regionalSkId,
          ),
        });
      }

      const vpcFrameIds: string[] = [];
      const emptyVpcShell = vpcEmptyShellSize();

      for (let vi = 0; hasVpc && vi < vpcEntries.length; vi++) {
        const [vpcId] = vpcEntries[vi]!;
        const col = vi % vpcCols;
        const row = Math.floor(vi / vpcCols);
        const vpcX = vpcGridOriginX + col * (vpcCellW + VPC_GAP);
        const vpcY = vpcGridOriginY + row * (vpcCellH + VPC_GAP);
        const vpcSkId = skeletonId("vpc", accountId, regionName, vpcId);
        vpcFrameIds.push(vpcSkId);

        const vpcZs = zonesForVpc(zones, accountId, regionName, vpcId).sort(
          (a, b) => a.subnetSignature.localeCompare(b.subnetSignature),
        );

        if (vpcZs.length === 0) {
          skeleton.push({
            type: "frame",
            id: vpcSkId,
            name: shortLabel("VPC", vpcId),
            x: vpcX,
            y: vpcY,
            width: emptyVpcShell.w,
            height: emptyVpcShell.h,
            children: [],
            customData: frameCustomData(
              "vpc",
              accountId,
              regionName,
              vpcId,
              vpcSkId,
            ),
          });
          continue;
        }

        const vd = vpcFrameDimensionsForZones(vpcZs, nodes, arnIndex, plan);
        const zoneGridOriginX = vpcX + INNER_PAD;
        const zoneGridOriginY = vpcY + VPC_TOP_PAD;
        const zoneFrameIds: string[] = [];

        for (let zi = 0; zi < vpcZs.length; zi++) {
          const z = vpcZs[zi]!;
          const zcol = zi % vd.znCols;
          const zrow = Math.floor(zi / vd.znCols);
          const zoneX =
            zoneGridOriginX + zcol * (vd.perZoneW + ZONE_CELL_GAP);
          const zoneY =
            zoneGridOriginY + zrow * (vd.perZoneH + ZONE_CELL_GAP);

          const zoneSkId = zoneSkeletonId(
            accountId,
            regionName,
            vpcId,
            z.subnetSignature,
          );
          zoneFrameIds.push(zoneSkId);

          const addrs = [...z.addresses].sort();
          const rectIds = appendTopologyResourceRectangles(
            skeleton,
            addrs,
            zoneX + INNER_PAD,
            zoneY + VPC_TOP_PAD,
            nodes,
            arnIndex,
            globalPlacedIamSatellites,
            globalPlacedSgSatellites,
            globalPlacedCloudWatchSatellites,
            satelliteLineSpecs,
            plan,
          );

          skeleton.push({
            type: "frame",
            id: zoneSkId,
            name: zoneDisplayName(z),
            x: zoneX,
            y: zoneY,
            width: vd.perZoneW,
            height: vd.perZoneH,
            children: rectIds as readonly string[],
            customData: frameCustomData(
              "subnetZone",
              accountId,
              regionName,
              vpcId,
              zoneSkId,
              { terraformSubnetIds: z.subnetIds },
            ),
          });
        }

        skeleton.push({
          type: "frame",
          id: vpcSkId,
          name: shortLabel("VPC", vpcId),
          x: vpcX,
          y: vpcY,
          width: vpcCellW,
          height: vpcCellH,
          children: zoneFrameIds as readonly string[],
          customData: frameCustomData(
            "vpc",
            accountId,
            regionName,
            vpcId,
            vpcSkId,
          ),
        });
      }

      regionChildIds.push(...vpcFrameIds);

      const innerContentW =
        (hasReg ? regDims.w : 0) +
        (hasReg && hasVpc ? REGIONAL_TO_VPC_GAP : 0) +
        vpcGridW;
      const innerContentH = Math.max(
        hasReg ? regDims.h : 0,
        vpcGridH,
      );

      const regionWidth =
        innerContentW + 2 * INNER_PAD + FRAME_CONTENT_SLACK_X;
      const regionHeight =
        VPC_TOP_PAD +
        innerContentH +
        2 * INNER_PAD +
        FRAME_CONTENT_SLACK_Y;

      skeleton.push({
        type: "frame",
        id: regionSkId,
        name: shortLabel("Region", regionName),
        x: regionRowX,
        y: regionRowY,
        width: regionWidth,
        height: regionHeight,
        children: regionChildIds as readonly string[],
        customData: frameCustomData(
          "region",
          accountId,
          regionName,
          null,
          regionSkId,
        ),
      });

      maxRegionRight = Math.max(
        maxRegionRight,
        regionRowX + regionWidth + INNER_PAD,
      );
      maxRegionBottom = Math.max(
        maxRegionBottom,
        regionRowY + regionHeight + INNER_PAD,
      );
      regionRowX += regionWidth + REGION_GAP;
    }

    if (regionFrameIds.length === 0) {
      continue;
    }

    const accountWidth = Math.max(
      maxRegionRight - accountCursorX + INNER_PAD + FRAME_CONTENT_SLACK_X,
      MIN_VPC_W + 2 * INNER_PAD,
    );
    const accountHeight = Math.max(
      maxRegionBottom - accountCursorY + INNER_PAD + FRAME_CONTENT_SLACK_Y,
      MIN_VPC_H + 2 * INNER_PAD,
    );

    skeleton.push({
      type: "frame",
      id: accountSkId,
      name: shortLabel("Account", accountId),
      x: accountCursorX,
      y: accountCursorY,
      width: accountWidth,
      height: accountHeight,
      children: regionFrameIds as readonly string[],
      customData: frameCustomData(
        "account",
        accountId,
        "",
        null,
        accountSkId,
      ),
    });

    accountCursorX += accountWidth + ACCOUNT_GAP;
  }

  skeleton.unshift(...buildTopologySatelliteLineSkeletons(satelliteLineSpecs));

  let elements = convertToExcalidrawElements(skeleton, {
    regenerateIds: true,
  }) as ExcalidrawElement[];

  elements = applyTerraformResourceRectangleSoftDelete(elements);
  elements = mirrorAndDetachTerraformResourceLabels(elements);
  elements = repairTerraformEdgeBindings(reconcileTerraformVisibility(elements));

  normalizeTopologyOrigin(elements);

  return {
    elements,
    meta: {
      layoutEngine: "topology",
      accountCount: counts.accounts,
      regionCount: counts.regions,
      vpcCount: counts.vpcs,
      subnetCount: counts.subnets,
      primaryResourceCount,
      regionalPrimaryCount,
    },
  };
}
