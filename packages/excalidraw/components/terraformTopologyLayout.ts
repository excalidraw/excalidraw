/**
 * Deterministic nested **frame** layout for AWS topology (`extractTerraformTopologyFromPlan`).
 * Primary resources live in **subnet zones** (one frame per distinct subnet multiset).
 */

import { convertToExcalidrawElements } from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import type { LocalPoint } from "@excalidraw/math";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { injectTerraformAwsIconsIntoElements } from "./terraformAwsIcons";
import {
  applyTerraformResourceRectangleSoftDelete,
  buildTerraformDataFlowLineSkeletons,
  buildTerraformDependencyLineSkeletons,
  buildTerraformNetworkingDependencyLineSkeletons,
  buildTerraformNetworkingRecordLineSkeletons,
  TERRAFORM_DATAFLOW_EDGE_STROKE,
  buildTerraformResourcePanelDetails,
  collectDirectedEdges,
  getTerraformActionStyle,
  getTerraformPlanNodeAction,
  mirrorAndDetachTerraformResourceLabels,
  resolveTerraformPlanVertexId,
  shortTerraformResourceLabel,
  TERRAFORM_RESOURCE_LABEL_STROKE,
  type TerraformDependencyLayoutBox,
} from "./terraformElkLayout";
import {
  terraformResourceCardLabel,
  getTerraformCardResourceType,
} from "./terraformResourceCardLabel";
import {
  collectDataFlowEdges,
  collectNetworkingEdges,
} from "./terraformExplodeGraph";
import { partitionDirectedEdgesByNetworking } from "./terraformNetworkingVertex";
import { isInitiallyVisibleTerraformTopologyTile } from "./terraformPrimaryVisibility";
import {
  TERRAFORM_MODULE_TREE_KEY,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";

import {
  buildRouteTableZoneSizingMapForVpc,
  computeVpcRouteTableFanOutAddressesForVpc,
  routeTableCompositeHeightPx,
  routeTableCompositeSlotWidthPx,
  routeTableMaxCompositeHeightForRowPx,
  subnetSetForRouteTableAddress,
  vpcBottomRouteTablesRowSizing,
  type RouteTableBottomVpcPlacement,
  type RouteTableBottomZonePlacement,
  type RouteTableZoneBottomSizing,
} from "./terraformTopologyPlacement";

import {
  buildResourceCloudWatchCluster,
  cloudWatchSatelliteStackHeightPx,
} from "./terraformTopologyCloudWatchLinks";
import {
  buildArnIndexForTopology,
  buildLambdaIamCluster,
  iamSatelliteStackHeightPx,
  type TopologyIamEdge,
} from "./terraformTopologyIamLinks";
import {
  buildKmsKeyPolicyCluster,
  kmsPolicySatelliteStackHeightPx,
} from "./terraformTopologyKmsLinks";
import {
  buildLambdaSgCluster,
  sgSatelliteStackHeightPx,
  TOPOLOGY_SG_BETWEEN_GROUPS_GAP_PX,
} from "./terraformTopologySgLinks";
import {
  buildS3CompanionCluster,
  s3SatelliteStackHeightPx,
} from "./terraformTopologyS3Links";
import {
  buildSqsCompanionCluster,
  sqsSatelliteStackHeightPx,
} from "./terraformTopologySqsLinks";
import {
  getTerraformEdgeLayer,
  reconcileTerraformVisibility,
  repairTerraformEdgeBindings,
  TERRAFORM_IMPORT_EDGE_LAYER_PINS,
} from "./terraformVisibility";
import { tfComfortFontSize, tfComfortPx } from "./terraformLayoutComfort";

import type { TerraformTopologyModel } from "./terraformTopologyExtract";
import type {
  TopologyEndpointSecurityGroupBucket,
  TopologyPlacementZone,
  TopologyRegionalPrimaryBucket,
  TopologyRouteTableBottomPlacements,
  TopologyVpcDefaultPlumbingBucket,
  TopologyVpcEndpointBucket,
  TopologyVpcFlowLogBucket,
} from "./terraformTopologyPlacement";

const px = tfComfortPx;

export type TerraformTopologyZoneRouteAnchorDebugRow = {
  accountId: string;
  region: string;
  vpcId: string;
  subnetSignature: string;
  tier: string;
  /** `zoneFrameSizeForTopologyAddresses` height for this zone’s primaries (often < cell body). */
  zoneContentBodyHPx: number;
  /** Uniform subnet-zone cell body height; route-table tier-0 anchor uses this (bottom pin). */
  routeAnchorBodyHPx: number;
};

export type TerraformTopologySceneMeta = {
  layoutEngine: "topology";
  accountCount: number;
  regionCount: number;
  vpcCount: number;
  subnetCount: number;
  primaryResourceCount: number;
  regionalPrimaryCount: number;
  vpcEndpointCount: number;
  routeTableCount: number;
  /** Count of merged `edges_new` / `edges_existing` dependency lines placed between on-canvas resources. */
  dependencyEdgeCount: number;
  skippedLayout?: boolean;
  skipReason?: string;
  /**
   * When non-empty: subnet zones that host a bottom `aws_route_table` row — compare
   * `zoneContentBodyHPx` vs `routeAnchorBodyHPx` to see short zones vs uniform cell bottom pin.
   * Capped during layout.
   */
  zoneRouteAnchorDebug?: readonly TerraformTopologyZoneRouteAnchorDebugRow[];
};

const MARGIN = px(50);
const ACCOUNT_GAP = px(48);
const REGION_GAP = px(32);
const VPC_GAP = px(28);
const VPC_TOP_PAD = px(44);
const INNER_PAD = px(28);
const FRAME_CONTENT_SLACK_X = px(24);
const FRAME_CONTENT_SLACK_Y = px(28);
const MIN_VPC_W = px(480);
const MIN_VPC_H = px(360);
const CANVAS_EDGE_PAD = MARGIN;

/** Tier 0: primary resources (matches ELK module resource leaf). */
const TOPOLOGY_TIER0_W = px(200);
const TOPOLOGY_TIER0_H = px(88);
/** Tier 1: direct satellites of a primary (role, SG body, CW tiles, KMS policies). */
const TOPOLOGY_TIER1_W = px(176);
const TOPOLOGY_TIER1_H = px(52);
/** Tier 2: satellites of a satellite (IAM policies, SG rules). */
const TOPOLOGY_TIER2_W = px(154);
const TOPOLOGY_TIER2_H = px(44);
const TOPOLOGY_SATELLITE_GAP_PX = px(8);

/** Match ELK module resource leaf size (tier 0). */
const RESOURCE_RECT_W = TOPOLOGY_TIER0_W;
const RESOURCE_RECT_H = TOPOLOGY_TIER0_H;
const RESOURCE_GAP = px(16);
const TOPOLOGY_DATAFLOW_STROKE = TERRAFORM_DATAFLOW_EDGE_STROKE;
const SG_RIGHT_PAD = px(6);
const CLOUDWATCH_LEFT_PAD = px(6);
const CLOUDWATCH_RIGHT_PAD = px(6);
/** Horizontal gap between IAM/KMS-left column and SG column (tier-1 widths). */
const IAM_SG_COLUMN_GAP_PX = px(8);
const CLOUDWATCH_COLUMN_GAP_PX = px(8);
/** Gap between subnet-zone frames inside one VPC. */
const ZONE_CELL_GAP = px(20);
/** Gap between regional-primary column and VPC grid inside one region frame. */
const REGIONAL_TO_VPC_GAP = px(28);
/** Compact tiles for `aws_vpc_endpoint` egress on the VPC bottom edge. */
const VPC_ENDPOINT_TILE_W = px(160);
const VPC_ENDPOINT_TILE_H = px(56);
const VPC_ENDPOINT_TILE_GAP = px(10);
/** Route table tiles on subnet zone / VPC bottom edge (same footprint as endpoint tiles). */
const ROUTE_TABLE_TILE_W = VPC_ENDPOINT_TILE_W;
const ROUTE_TABLE_TILE_H = VPC_ENDPOINT_TILE_H;
const ROUTE_TABLE_TILE_GAP = VPC_ENDPOINT_TILE_GAP;
const VPC_INTERNET_EDGE_TILE_W = TOPOLOGY_TIER2_W;
const VPC_INTERNET_EDGE_TILE_H = TOPOLOGY_TIER2_H;
const VPC_INTERNET_EDGE_TILE_GAP = TOPOLOGY_SATELLITE_GAP_PX;
const VPC_INTERNET_EDGE_GUTTER = VPC_INTERNET_EDGE_TILE_W + px(12);

/** Extra frame height for VPC bottom strip (endpoints + route-table composites). */
function vpcBottomStripInsetPx(
  epCount: number,
  vpcBottomRouteTableMaxExtentBelowAnchor: number,
): number {
  const epHalf = epCount > 0 ? Math.ceil(VPC_ENDPOINT_TILE_H / 2) : 0;
  const rtExtent = vpcBottomRouteTableMaxExtentBelowAnchor;
  if (epCount > 0 && rtExtent > 0) {
    return epHalf + rtExtent + 8;
  }
  return Math.max(epHalf, rtExtent);
}

export type TerraformTopologyRole =
  | "account"
  | "region"
  | "vpc"
  | "subnetZone"
  | "primaryCluster";

function skeletonId(
  role: Exclude<TerraformTopologyRole, "subnetZone" | "primaryCluster">,
  accountId: string,
  region: string,
  vpcId: string | null,
): string {
  if (role === "account") {
    return `tf-topo:a=${encodeURIComponent(accountId)}`;
  }
  const base = `tf-topo:a=${encodeURIComponent(
    accountId,
  )}:r=${encodeURIComponent(region)}`;
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
  return `${skeletonId(
    "vpc",
    accountId,
    region,
    vpcId,
  )}:zone=${encodeURIComponent(sig)}`;
}

/** Stable id for nested “primary + satellites” drag frame (must not equal a resource address). */
function primaryClusterSkeletonId(primaryAddress: string): string {
  return `tf-topo:primary-cluster:${encodeURIComponent(primaryAddress)}`;
}

const TOPOLOGY_PRIMARY_CLUSTER_FRAME_PAD_PX = 10;

function topologyPathFrame(
  role: TerraformTopologyRole,
  accountId: string,
  region: string,
  vpcId: string | null,
  primaryAddress?: string | null,
): string[] {
  if (role === "primaryCluster") {
    const p = primaryAddress || "";
    return vpcId ? [accountId, region, vpcId, p] : [accountId, region, p];
  }
  if (role === "account") {
    return [accountId];
  }
  if (role === "region") {
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
  extras?: {
    terraformSubnetIds?: string[];
    terraformPrimaryAddress?: string;
  },
) {
  return {
    terraform: true as const,
    terraformSemanticOverview: true as const,
    terraformTopologyRole: role,
    terraformTopologyKey: key,
    terraformTopologyPath: topologyPathFrame(
      role,
      accountId,
      region,
      vpcId,
      extras?.terraformPrimaryAddress,
    ),
    ...(extras?.terraformSubnetIds
      ? { terraformSubnetIds: extras.terraformSubnetIds }
      : {}),
  };
}

function satelliteColumnWidths(): { iamW: number; sgW: number } {
  return { iamW: TOPOLOGY_TIER1_W, sgW: TOPOLOGY_TIER1_W };
}

function cloudWatchColumnWidths(): { alarmW: number; logGroupW: number } {
  return { alarmW: TOPOLOGY_TIER1_W, logGroupW: TOPOLOGY_TIER1_W };
}

/**
 * Sum vertical space for satellite stacks drawn one after another below a primary, without
 * double-counting the gap between stacks (each stack’s height already includes a leading gap).
 */
function stackSequentialSatelliteHeightsPx(
  satelliteGap: number,
  heights: readonly number[],
): number {
  const positive = heights.filter((h) => h > 0);
  if (positive.length === 0) {
    return 0;
  }
  let sum = positive[0]!;
  for (let i = 1; i < positive.length; i++) {
    sum += positive[i]! - satelliteGap;
  }
  return sum;
}

/** Minimum horizontal span for one primary cell so satellites are not clipped. */
function topologyPrimaryCellFootprintPx(
  nodes: TerraformPlanNodesMap,
  address: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
): number {
  const { cluster: iamCluster } = buildLambdaIamCluster(
    nodes,
    address,
    arnIndex,
  );
  const kmsBuild = buildKmsKeyPolicyCluster(nodes, address, arnIndex);
  const sgBuild = buildLambdaSgCluster(nodes, address, arnIndex, plan);
  const cwBuild = buildResourceCloudWatchCluster(nodes, address);

  const hasLeft = Boolean(iamCluster) || Boolean(kmsBuild.cluster);
  const hasSg = Boolean(sgBuild.cluster);
  let w = TOPOLOGY_TIER0_W;
  if (hasLeft && hasSg) {
    w = Math.max(w, TOPOLOGY_TIER1_W * 2 + IAM_SG_COLUMN_GAP_PX);
  }

  const hasAlarm = Boolean(cwBuild.cluster?.alarms.length);
  const hasLog = Boolean(cwBuild.cluster?.logGroups.length);
  if (hasAlarm && hasLog) {
    const cwSpan =
      CLOUDWATCH_LEFT_PAD +
      TOPOLOGY_TIER1_W +
      CLOUDWATCH_COLUMN_GAP_PX +
      TOPOLOGY_TIER1_W +
      CLOUDWATCH_RIGHT_PAD;
    w = Math.max(w, cwSpan);
  }
  return w;
}

function maxTopologyCellFootprintPx(
  sortedAddresses: readonly string[],
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  plan?: unknown,
): number {
  let maxW = TOPOLOGY_TIER0_W;
  for (const addr of sortedAddresses) {
    maxW = Math.max(
      maxW,
      topologyPrimaryCellFootprintPx(nodes, addr, arnIndex, plan),
    );
  }
  return maxW;
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

/** Bounding box for one subnet-zone or regional-primary column from primary addresses + IAM stacks. */
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
  const cellW = maxTopologyCellFootprintPx(
    sortedAddresses,
    nodes,
    arnIndex,
    plan,
  );
  const rowTopBase: number[] = new Array(rows).fill(0);
  const rowBottomBase: number[] = new Array(rows).fill(0);
  for (let i = 0; i < sortedAddresses.length; i++) {
    const addr = sortedAddresses[i]!;
    const r = Math.floor(i / cols);
    const cloudWatchExtra = cloudWatchSatelliteStackHeightPx(
      nodes,
      addr,
      TOPOLOGY_TIER1_H,
      TOPOLOGY_SATELLITE_GAP_PX,
    );
    const iamExtra = iamSatelliteStackHeightPx(
      nodes,
      addr,
      arnIndex,
      TOPOLOGY_TIER1_H,
      TOPOLOGY_TIER2_H,
      TOPOLOGY_SATELLITE_GAP_PX,
    );
    const kmsPolicyExtra = kmsPolicySatelliteStackHeightPx(
      nodes,
      addr,
      arnIndex,
      TOPOLOGY_TIER1_H,
      TOPOLOGY_SATELLITE_GAP_PX,
    );
    const sgExtra = sgSatelliteStackHeightPx(
      nodes,
      addr,
      arnIndex,
      TOPOLOGY_TIER1_H,
      TOPOLOGY_TIER2_H,
      TOPOLOGY_SATELLITE_GAP_PX,
      plan,
    );
    const s3Extra = s3SatelliteStackHeightPx(
      nodes,
      addr,
      arnIndex,
      TOPOLOGY_TIER1_H,
      TOPOLOGY_TIER2_H,
      TOPOLOGY_SATELLITE_GAP_PX,
    );
    const sqsExtra = sqsSatelliteStackHeightPx(
      nodes,
      addr,
      arnIndex,
      TOPOLOGY_TIER1_H,
      TOPOLOGY_TIER2_H,
      TOPOLOGY_SATELLITE_GAP_PX,
    );
    const leftColumnBottom = stackSequentialSatelliteHeightsPx(
      TOPOLOGY_SATELLITE_GAP_PX,
      [iamExtra, kmsPolicyExtra, s3Extra],
    );
    const rightColumnBottom = stackSequentialSatelliteHeightsPx(
      TOPOLOGY_SATELLITE_GAP_PX,
      [sgExtra, sqsExtra],
    );
    rowTopBase[r] = Math.max(rowTopBase[r]!, cloudWatchExtra);
    rowBottomBase[r] = Math.max(
      rowBottomBase[r]!,
      leftColumnBottom,
      rightColumnBottom,
    );
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
    cols * (cellW + RESOURCE_GAP) -
    RESOURCE_GAP +
    FRAME_CONTENT_SLACK_X;
  const h = VPC_TOP_PAD + 2 * INNER_PAD + innerBodyH + FRAME_CONTENT_SLACK_Y;
  return {
    w: Math.max(MIN_VPC_W * 0.55 + FRAME_CONTENT_SLACK_X, w),
    h: Math.max(
      RESOURCE_RECT_H + VPC_TOP_PAD + 2 * INNER_PAD + FRAME_CONTENT_SLACK_Y,
      h,
    ),
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

type TopologySubnetTier = "vpcOnly" | "public" | "intra" | "private" | "other";

const SUBNET_TIER_ORDER: Record<TopologySubnetTier, number> = {
  vpcOnly: 0,
  public: 1,
  intra: 2,
  private: 3,
  other: 4,
};

function topologySubnetTierFromZone(
  z: TopologyPlacementZone,
  subnetNameById: ReadonlyMap<string, string>,
): TopologySubnetTier {
  if (z.subnetIds.length === 0) {
    return "vpcOnly";
  }
  const labels = z.subnetIds
    .map((sid) => `${subnetNameById.get(sid) ?? ""} ${sid}`.toLowerCase())
    .join(" ");
  if (/\bpublic\b/.test(labels) || labels.includes("-public-")) {
    return "public";
  }
  if (/\bintra\b/.test(labels) || labels.includes("-intra-")) {
    return "intra";
  }
  if (/\bprivate\b/.test(labels) || labels.includes("-private-")) {
    return "private";
  }
  return "other";
}

function compareTopologyZonesByTier(
  subnetNameById: ReadonlyMap<string, string>,
): (a: TopologyPlacementZone, b: TopologyPlacementZone) => number {
  return (a, b) => {
    const at = topologySubnetTierFromZone(a, subnetNameById);
    const bt = topologySubnetTierFromZone(b, subnetNameById);
    if (at !== bt) {
      return SUBNET_TIER_ORDER[at] - SUBNET_TIER_ORDER[bt];
    }
    const an = zoneDisplayName(a, subnetNameById);
    const bn = zoneDisplayName(b, subnetNameById);
    const c = an.localeCompare(bn);
    return c !== 0 ? c : a.subnetSignature.localeCompare(b.subnetSignature);
  };
}

function topologyZoneColumns(
  vpcZs: readonly TopologyPlacementZone[],
  subnetNameById: ReadonlyMap<string, string>,
): TopologyPlacementZone[][] {
  const byTier = new Map<TopologySubnetTier, TopologyPlacementZone[]>();
  for (const z of vpcZs) {
    const tier = topologySubnetTierFromZone(z, subnetNameById);
    if (!byTier.has(tier)) {
      byTier.set(tier, []);
    }
    byTier.get(tier)!.push(z);
  }
  const columns: TopologyPlacementZone[][] = [];
  for (const tier of Object.keys(SUBNET_TIER_ORDER) as TopologySubnetTier[]) {
    const zs = byTier.get(tier);
    if (!zs || zs.length === 0) {
      continue;
    }
    columns.push([...zs].sort(compareTopologyZonesByTier(subnetNameById)));
  }
  return columns;
}

/** VPC frame size that fits all subnet-zone cells for this VPC. */
function vpcFrameDimensionsForZones(
  vpcZs: readonly TopologyPlacementZone[],
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  plan?: unknown,
  routeTableZoneSizing?: ReadonlyMap<string, RouteTableZoneBottomSizing>,
  vpcInfrastructureTopPadPx = 0,
  subnetNameById: ReadonlyMap<string, string> = new Map(),
  sideGutterPx = 0,
): {
  w: number;
  h: number;
  perZoneW: number;
  perZoneH: number;
  perZoneBodyH: number;
  znCols: number;
  znRows: number;
} {
  if (vpcZs.length === 0) {
    const e = vpcEmptyShellSize();
    return {
      w: e.w,
      h: e.h + vpcInfrastructureTopPadPx,
      perZoneW: 0,
      perZoneH: 0,
      perZoneBodyH: 0,
      znCols: 0,
      znRows: 0,
    };
  }
  const zoneColumns = topologyZoneColumns(vpcZs, subnetNameById);
  const znCols = Math.max(1, zoneColumns.length);
  const znRows = Math.max(1, ...zoneColumns.map((col) => col.length));
  let perZoneW = 0;
  let perZoneBodyH = 0;
  let maxZoneRouteTableInset = 0;
  for (const z of vpcZs) {
    const sortedZ = [...z.addresses].sort();
    const d = zoneFrameSizeForTopologyAddresses(sortedZ, nodes, arnIndex, plan);
    const sizing = routeTableZoneSizing?.get(z.subnetSignature);
    const rtMinW =
      sizing && sizing.tableCount > 0
        ? 2 * INNER_PAD + FRAME_CONTENT_SLACK_X + sizing.minInnerWidthPx
        : 0;
    perZoneW = Math.max(perZoneW, d.w, rtMinW);
    perZoneBodyH = Math.max(perZoneBodyH, d.h);
    if (sizing && sizing.tableCount > 0) {
      maxZoneRouteTableInset = Math.max(
        maxZoneRouteTableInset,
        sizing.maxExtentBelowAnchorPx,
      );
    }
  }
  const zoneRtInset = maxZoneRouteTableInset;
  const perZoneH = perZoneBodyH + zoneRtInset;
  const innerW =
    znCols * perZoneW + (znCols > 0 ? znCols - 1 : 0) * ZONE_CELL_GAP;
  const innerH =
    znRows * perZoneH + (znRows > 0 ? znRows - 1 : 0) * ZONE_CELL_GAP;
  const w = Math.max(
    MIN_VPC_W + FRAME_CONTENT_SLACK_X,
    2 * INNER_PAD + 2 * sideGutterPx + innerW + FRAME_CONTENT_SLACK_X,
  );
  const h = Math.max(
    MIN_VPC_H + FRAME_CONTENT_SLACK_Y,
    VPC_TOP_PAD +
      vpcInfrastructureTopPadPx +
      2 * INNER_PAD +
      innerH +
      FRAME_CONTENT_SLACK_Y,
  );
  return { w, h, perZoneW, perZoneH, perZoneBodyH, znCols, znRows };
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
  return value.length > max
    ? `${kind}: ${value.slice(0, max - 3)}…`
    : `${kind}: ${value}`;
}

type TopologyPlanResourceChange = {
  type?: string;
  change?: { before?: unknown; after?: unknown };
};

function topologyPlanValues(
  rc: TopologyPlanResourceChange,
): Record<string, unknown> | null {
  const after = rc.change?.after;
  if (after && typeof after === "object" && !Array.isArray(after)) {
    return after as Record<string, unknown>;
  }
  const before = rc.change?.before;
  if (before && typeof before === "object" && !Array.isArray(before)) {
    return before as Record<string, unknown>;
  }
  return null;
}

function resourceNameFromValues(
  values: Record<string, unknown>,
): string | null {
  const tags = values.tags;
  if (tags && typeof tags === "object" && !Array.isArray(tags)) {
    const name = (tags as Record<string, unknown>).Name;
    if (typeof name === "string" && name.trim()) {
      return name.trim();
    }
  }
  const name = values.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function buildTopologyVpcNameMap(plan?: unknown): Map<string, string> {
  const out = new Map<string, string>();
  const changes = (
    plan as { resource_changes?: TopologyPlanResourceChange[] } | undefined
  )?.resource_changes;
  if (!Array.isArray(changes)) {
    return out;
  }
  for (const rc of changes) {
    if (rc.type !== "aws_vpc") {
      continue;
    }
    const values = topologyPlanValues(rc);
    if (!values) {
      continue;
    }
    const id = typeof values.id === "string" ? values.id : null;
    const name = resourceNameFromValues(values);
    if (id && name) {
      out.set(id, name);
    }
  }
  return out;
}

export function buildTopologySubnetNameMap(
  plan?: unknown,
): Map<string, string> {
  const out = new Map<string, string>();
  const changes = (
    plan as { resource_changes?: TopologyPlanResourceChange[] } | undefined
  )?.resource_changes;
  if (!Array.isArray(changes)) {
    return out;
  }
  for (const rc of changes) {
    if (rc.type !== "aws_subnet") {
      continue;
    }
    const values = topologyPlanValues(rc);
    if (!values) {
      continue;
    }
    const id = typeof values.id === "string" ? values.id : null;
    const name = resourceNameFromValues(values);
    if (id && name) {
      out.set(id, name);
    }
  }
  return out;
}

function zoneDisplayName(
  z: TopologyPlacementZone,
  subnetNameById: ReadonlyMap<string, string>,
): string {
  if (z.subnetIds.length === 0) {
    return "VPC-only placement";
  }
  const labels = z.subnetIds.map((sid) => subnetNameById.get(sid) ?? sid);
  if (z.subnetIds.length <= 2) {
    return `Subnets: ${labels.join(", ")}`;
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

function endpointsForVpc(
  buckets: readonly TopologyVpcEndpointBucket[],
  accountId: string,
  regionName: string,
  vpcId: string,
): readonly string[] {
  const b = buckets.find(
    (x) =>
      x.accountId === accountId && x.region === regionName && x.vpcId === vpcId,
  );
  return b?.addresses ?? [];
}

function routeTablesVpcBottomRow(
  placements: TopologyRouteTableBottomPlacements,
  accountId: string,
  regionName: string,
  vpcId: string,
): RouteTableBottomVpcPlacement | null {
  const row = placements.vpcBottom.find(
    (x) =>
      x.accountId === accountId && x.region === regionName && x.vpcId === vpcId,
  );
  return row ?? null;
}

function routeTablesZoneBottomRow(
  placements: TopologyRouteTableBottomPlacements,
  accountId: string,
  regionName: string,
  vpcId: string,
  subnetSignature: string,
): RouteTableBottomZonePlacement | null {
  const row = placements.zoneBottom.find(
    (x) =>
      x.accountId === accountId &&
      x.region === regionName &&
      x.vpcId === vpcId &&
      x.subnetSignature === subnetSignature,
  );
  return row ?? null;
}

/**
 * One `primaryCluster` frame per `aws_route_table` — same box pattern as Lambda/S3/SQS in
 * `appendTopologyResourceRectangles` (tier-0 primary + tier-2 `aws_route` stack below).
 *
 * @param routeTableRowCenterBandW — When set (subnet zones), center the route row in this width
 *   from `boxX + INNER_PAD` so it lines up with the primary grid; otherwise use full inner width
 *   (VPC bottom strip).
 */
function appendRouteTableBottomEdgeRectangles(
  skeleton: ExcalidrawElementSkeleton[],
  accountId: string,
  regionName: string,
  vpcId: string,
  tableAddrs: readonly string[],
  routeChildrenByTable: Record<string, string[]>,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  nodes: TerraformPlanNodesMap,
  zoneSubnetSignature: string | undefined,
  stackAboveBottomPx: number,
  routeTableRowCenterBandW?: number,
  routeTablePlacementOptions?: {
    placementIdSuffix?: string;
    semanticRouteTableDuplicate?: boolean;
  },
): string[] {
  if (tableAddrs.length === 0) {
    return [];
  }
  const sorted = [...tableAddrs].sort();
  const innerLeft = boxX + INNER_PAD;
  const innerW = Math.max(0, boxW - 2 * INNER_PAD);
  const centerBandW =
    routeTableRowCenterBandW != null &&
    routeTableRowCenterBandW > 0 &&
    Number.isFinite(routeTableRowCenterBandW)
      ? Math.min(innerW, routeTableRowCenterBandW)
      : innerW;
  const slotW = routeTableCompositeSlotWidthPx(0);
  const rowW =
    sorted.length * slotW +
    (sorted.length > 0 ? sorted.length - 1 : 0) * ROUTE_TABLE_TILE_GAP;
  const startX = innerLeft + Math.max(0, (centerBandW - rowW) / 2);

  const clusterFrameIds: string[] = [];
  let cursorX = startX;
  const pad = TOPOLOGY_PRIMARY_CLUSTER_FRAME_PAD_PX;
  const placementSuffix = routeTablePlacementOptions?.placementIdSuffix ?? "";
  const semanticDup = Boolean(
    routeTablePlacementOptions?.semanticRouteTableDuplicate,
  );

  for (const addr of sorted) {
    const routes = routeChildrenByTable[addr] ?? [];
    /** Same midline as `appendVpcEndpointEgressRectangles`: tile center on inner body bottom − stack. */
    const anchorMidY = boxY + boxH - stackAboveBottomPx;
    const ry = anchorMidY - Math.round(RESOURCE_RECT_H / 2);

    const clusterChildIds: string[] = [];
    let clusterBounds: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    } | null = null;
    const addClusterMember = (
      id: string,
      bx: number,
      by: number,
      bw: number,
      bh: number,
    ) => {
      clusterChildIds.push(id);
      clusterBounds = growClusterBounds(clusterBounds, bx, by, bw, bh);
    };

    const rx = cursorX + pad;

    const node = nodes[addr] as TerraformPlanGraphNode | undefined;
    const resourceType = getTerraformCardResourceType(
      addr,
      getPrimaryResource(node) as Record<string, unknown> | null,
    );
    const action = getTerraformPlanNodeAction(node);
    const initiallyVisible = isInitiallyVisibleTerraformTopologyTile(
      resourceType,
      action,
    );

    const idStem = placementSuffix ? `${addr}${placementSuffix}` : addr;
    const explodeParentForRoutes = semanticDup ? idStem : addr;

    addClusterMember(idStem, rx, ry, RESOURCE_RECT_W, RESOURCE_RECT_H);
    pushResourceRectangleSkeleton(
      skeleton,
      addr,
      rx,
      ry,
      RESOURCE_RECT_W,
      RESOURCE_RECT_H,
      nodes,
      {
        initiallyVisible,
        explodeParentKeys: [],
        elementId: idStem,
        terraformSemanticRouteTableDuplicate: semanticDup,
        vpcRouteTable: {
          accountId,
          region: regionName,
          vpcId,
          ...(zoneSubnetSignature != null && zoneSubnetSignature !== ""
            ? { zoneSubnetSignature }
            : {}),
        },
      },
    );

    const ruleTileX = rx + Math.floor((RESOURCE_RECT_W - TOPOLOGY_TIER2_W) / 2);
    let ySat = ry + RESOURCE_RECT_H + TOPOLOGY_SATELLITE_GAP_PX;
    for (const rAddr of routes) {
      const rNode = nodes[rAddr] as TerraformPlanGraphNode | undefined;
      const rResource = getPrimaryResource(rNode) as Record<
        string,
        unknown
      > | null;
      const rType = getTerraformCardResourceType(rAddr, rResource);
      const rAction = getTerraformPlanNodeAction(rNode);
      const rVisible = isInitiallyVisibleTerraformTopologyTile(rType, rAction);
      addClusterMember(
        rAddr,
        ruleTileX,
        ySat,
        TOPOLOGY_TIER2_W,
        TOPOLOGY_TIER2_H,
      );
      pushResourceRectangleSkeleton(
        skeleton,
        rAddr,
        ruleTileX,
        ySat,
        TOPOLOGY_TIER2_W,
        TOPOLOGY_TIER2_H,
        nodes,
        {
          initiallyVisible: rVisible,
          explodeParentKeys: [explodeParentForRoutes],
          satelliteTier: 2,
        },
      );
      ySat += TOPOLOGY_TIER2_H + TOPOLOGY_SATELLITE_GAP_PX;
    }

    const b = clusterBounds!;
    const clusterSkId = primaryClusterSkeletonId(idStem);
    skeleton.push({
      type: "frame",
      id: clusterSkId,
      name: shortTerraformResourceLabel(addr).slice(0, 48),
      x: b.minX - pad,
      y: b.minY - pad,
      width: b.maxX - b.minX + 2 * pad,
      height: b.maxY - b.minY + 2 * pad,
      children: clusterChildIds as readonly string[],
      customData: frameCustomData(
        "primaryCluster",
        accountId,
        regionName,
        vpcId,
        clusterSkId,
        { terraformPrimaryAddress: addr },
      ),
    });
    clusterFrameIds.push(clusterSkId);

    cursorX += slotW + ROUTE_TABLE_TILE_GAP;
  }

  return clusterFrameIds;
}

/**
 * Minimum inner width (between VPC side padding) to place all endpoints on **one row**
 * (widen the VPC frame rather than wrapping to a second row).
 */
function vpcEndpointSingleRowMinInnerWidth(addrCount: number): number {
  if (addrCount <= 0) {
    return 0;
  }
  return (
    addrCount * VPC_ENDPOINT_TILE_W + (addrCount - 1) * VPC_ENDPOINT_TILE_GAP
  );
}

/**
 * `aws_vpc_endpoint` rectangles along the VPC frame bottom (tile mid on the VPC body bottom line).
 */
function appendVpcEndpointEgressRectangles(
  skeleton: ExcalidrawElementSkeleton[],
  accountId: string,
  regionName: string,
  vpcId: string,
  addrs: readonly string[],
  vpcX: number,
  vpcY: number,
  vpcCellW: number,
  vpcCellH: number,
  nodes: TerraformPlanNodesMap,
): string[] {
  if (addrs.length === 0) {
    return [];
  }
  const sorted = [...addrs].sort();
  const innerLeft = vpcX + INNER_PAD;
  const innerW = Math.max(0, vpcCellW - 2 * INNER_PAD);
  const cols = sorted.length;
  const rowW = vpcEndpointSingleRowMinInnerWidth(cols);
  const startX = innerLeft + Math.max(0, (innerW - rowW) / 2);

  const bottomRowTop = vpcY + vpcCellH - Math.round(VPC_ENDPOINT_TILE_H / 2);
  const rectIds: string[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const addr = sorted[i]!;
    const col = i;
    const rx = startX + col * (VPC_ENDPOINT_TILE_W + VPC_ENDPOINT_TILE_GAP);
    const ry = bottomRowTop;
    const node = nodes[addr] as TerraformPlanGraphNode | undefined;
    const resourceType = getTerraformCardResourceType(
      addr,
      getPrimaryResource(node) as Record<string, unknown> | null,
    );
    const action = getTerraformPlanNodeAction(node);
    const initiallyVisible = isInitiallyVisibleTerraformTopologyTile(
      resourceType,
      action,
    );
    rectIds.push(addr);
    pushResourceRectangleSkeleton(
      skeleton,
      addr,
      rx,
      ry,
      VPC_ENDPOINT_TILE_W,
      VPC_ENDPOINT_TILE_H,
      nodes,
      {
        initiallyVisible,
        explodeParentKeys: [],
        egress: {
          accountId,
          region: regionName,
          vpcId,
        },
      },
    );
  }

  return rectIds;
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
    /** Semantic topology: smaller typography for satellite tiers. */
    satelliteTier?: 1 | 2;
    egress?: { accountId: string; region: string; vpcId: string };
    vpcRouteTable?: {
      accountId: string;
      region: string;
      vpcId: string;
      /** When set, tile is scoped to this subnet zone’s bottom edge. */
      zoneSubnetSignature?: string;
    };
    /** When set, skeleton element id (not equal to Terraform `addr` for semantic duplicates). */
    elementId?: string;
    terraformSemanticRouteTableDuplicate?: boolean;
    labelTextOverride?: string;
  },
): void {
  const node = nodes[addr] as TerraformPlanGraphNode | undefined;
  const resource = getPrimaryResource(node);
  const resourceType = getTerraformCardResourceType(
    addr,
    resource as Record<string, unknown> | null,
  );
  const action = getTerraformPlanNodeAction(node);
  const actionStyle = getTerraformActionStyle(action);
  const explodeKeys = [...options.explodeParentKeys].sort();
  const explodeParent = explodeKeys[0] ?? null;
  const egress = options.egress;
  const vpcRouteTable = options.vpcRouteTable;
  const rtZoneSig = vpcRouteTable?.zoneSubnetSignature;
  const labelFontSize =
    options.satelliteTier === 2
      ? tfComfortFontSize(10)
      : options.satelliteTier === 1
      ? tfComfortFontSize(11)
      : tfComfortFontSize(12);

  const elementId = options.elementId ?? addr;
  const visibilityKey = elementId;

  skeleton.push({
    type: "rectangle",
    id: elementId,
    x,
    y,
    width,
    height,
    strokeWidth: 1.5,
    strokeColor: actionStyle.strokeColor,
    backgroundColor: actionStyle.backgroundColor,
    strokeStyle: egress ? "dashed" : "solid",
    roundness: { type: 3, value: px(10) },
    label: {
      text:
        options.labelTextOverride ??
        terraformResourceCardLabel(
          addr,
          resource as Record<string, unknown> | null,
        ),
      fontSize: labelFontSize,
      strokeColor: TERRAFORM_RESOURCE_LABEL_STROKE,
    },
    customData: {
      terraform: true,
      terraformSemanticOverview: true,
      terraformVisibilityRole: "resource",
      terraformVisibilityKey: visibilityKey,
      terraformNodeKind: "resource",
      terraformInitiallyVisible: options.initiallyVisible,
      terraformExplodeParentKeys: explodeKeys,
      terraformExplodeParent: explodeParent,
      terraformExpandAllView: false,
      resourceType,
      nodePath: addr,
      action,
      ...(options.terraformSemanticRouteTableDuplicate
        ? { terraformSemanticRouteTableDuplicate: true }
        : {}),
      ...(egress
        ? {
            terraformTopologyRole: "vpcEgressEndpoint" as const,
            terraformTopologyPath: [
              egress.accountId,
              egress.region,
              egress.vpcId,
            ],
          }
        : vpcRouteTable
        ? rtZoneSig != null && rtZoneSig !== ""
          ? {
              terraformTopologyRole: "subnetZoneRouteTable" as const,
              terraformTopologyPath: [
                vpcRouteTable.accountId,
                vpcRouteTable.region,
                vpcRouteTable.vpcId,
                rtZoneSig,
              ],
            }
          : {
              terraformTopologyRole: "vpcRouteTable" as const,
              terraformTopologyPath: [
                vpcRouteTable.accountId,
                vpcRouteTable.region,
                vpcRouteTable.vpcId,
              ],
            }
        : {}),
      terraformResources:
        resource &&
        buildTerraformResourcePanelDetails(
          addr,
          resource as Record<string, unknown>,
        ),
    },
  });
}

/** One composite `aws_subnet` tile for merged supplementary zones (shared route table). */
function appendMergedSubnetCompositeRectangles(
  skeleton: ExcalidrawElementSkeleton[],
  accountTuple: { accountId: string; region: string; vpcId: string },
  sortedAddrs: readonly string[],
  z: TopologyPlacementZone,
  contentOriginX: number,
  contentOriginY: number,
  nodes: TerraformPlanNodesMap,
  _arnIndex: Map<string, string>,
  _plan: unknown,
  subnetNameById: ReadonlyMap<string, string>,
): string[] {
  const sorted = [...sortedAddrs].sort();
  if (sorted.length === 0) {
    return [];
  }
  const addr0 = sorted[0]!;
  const rx = contentOriginX;
  const ry = contentOriginY;
  const compositeId = `tf-topo:merged-subnet:${encodeURIComponent(
    z.subnetSignature,
  )}`;
  const pad = TOPOLOGY_PRIMARY_CLUSTER_FRAME_PAD_PX;
  const node0 = nodes[addr0] as TerraformPlanGraphNode | undefined;
  const resource0 = getPrimaryResource(node0);
  const resourceType = getTerraformCardResourceType(
    addr0,
    resource0 as Record<string, unknown> | null,
  );
  const action = getTerraformPlanNodeAction(node0);
  const initiallyVisible = isInitiallyVisibleTerraformTopologyTile(
    resourceType,
    action,
  );
  const actionStyle = getTerraformActionStyle(action);
  const terraformResourcesMerged = sorted.flatMap((a) => {
    const n = nodes[a] as TerraformPlanGraphNode | undefined;
    const r = getPrimaryResource(n) as Record<string, any> | undefined;
    return r ? buildTerraformResourcePanelDetails(a, r) : [];
  });

  const clusterChildIds: string[] = [];
  let clusterBounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null = null;
  const addClusterMember = (
    id: string,
    bx: number,
    by: number,
    bw: number,
    bh: number,
  ) => {
    clusterChildIds.push(id);
    clusterBounds = growClusterBounds(clusterBounds, bx, by, bw, bh);
  };

  addClusterMember(compositeId, rx, ry, RESOURCE_RECT_W, RESOURCE_RECT_H);
  skeleton.push({
    type: "rectangle",
    id: compositeId,
    x: rx,
    y: ry,
    width: RESOURCE_RECT_W,
    height: RESOURCE_RECT_H,
    strokeWidth: 1.5,
    strokeColor: actionStyle.strokeColor,
    backgroundColor: actionStyle.backgroundColor,
    strokeStyle: "solid",
    roundness: { type: 3, value: px(10) },
    label: {
      text: zoneDisplayName(z, subnetNameById),
      fontSize: tfComfortFontSize(11),
      strokeColor: TERRAFORM_RESOURCE_LABEL_STROKE,
    },
    customData: {
      terraform: true,
      terraformSemanticOverview: true,
      terraformVisibilityRole: "resource",
      terraformVisibilityKey: compositeId,
      terraformNodeKind: "resource",
      terraformInitiallyVisible: initiallyVisible,
      terraformExplodeParentKeys: [],
      terraformExplodeParent: null,
      terraformExpandAllView: false,
      resourceType: "aws_subnet",
      nodePath: addr0,
      action,
      terraformMergedSubnetComposite: true,
      terraformMergedSubnetAddresses: sorted,
      terraformResources: terraformResourcesMerged,
    },
  });

  const b = clusterBounds!;
  const clusterSkId = primaryClusterSkeletonId(compositeId);
  skeleton.push({
    type: "frame",
    id: clusterSkId,
    name: zoneDisplayName(z, subnetNameById).slice(0, 48),
    x: b.minX - pad,
    y: b.minY - pad,
    width: b.maxX - b.minX + 2 * pad,
    height: b.maxY - b.minY + 2 * pad,
    children: clusterChildIds as readonly string[],
    customData: frameCustomData(
      "primaryCluster",
      accountTuple.accountId,
      accountTuple.region,
      accountTuple.vpcId,
      clusterSkId,
      { terraformPrimaryAddress: addr0 },
    ),
  });
  return [clusterSkId];
}

type TopologySatelliteLineSpec = {
  edge: TopologyIamEdge;
  origin:
    | "topology_iam"
    | "topology_sg"
    | "topology_cloudwatch"
    | "topology_kms"
    | "topology_s3"
    | "topology_sqs"
    | "topology_vpc_flow"
    | "topology_vpc_defaults"
    | "topology_endpoint_sg";
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
      type: "arrow",
      id: `tf-topo-sat-edge-${edgeSeq}`,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
      strokeWidth: 3,
      strokeColor,
      strokeStyle: "solid",
      roundness: { type: 2 },
      endArrowhead: "arrow",
      customData: {
        terraform: true,
        terraformSemanticOverview: true,
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

function bucketAddressesForVpc<
  T extends {
    accountId: string;
    region: string;
    vpcId: string;
    addresses: readonly string[];
  },
>(
  buckets: readonly T[],
  accountId: string,
  regionName: string,
  vpcId: string,
): string[] {
  for (const b of buckets) {
    if (
      b.accountId === accountId &&
      b.region === regionName &&
      b.vpcId === vpcId
    ) {
      return [...b.addresses];
    }
  }
  return [];
}

function resourceTypeForAddress(
  nodes: TerraformPlanNodesMap,
  addr: string,
): string {
  const node = nodes[addr] as TerraformPlanGraphNode | undefined;
  const resource = getPrimaryResource(node);
  return getTerraformCardResourceType(
    addr,
    resource as Record<string, unknown> | null,
  );
}

type VpcInternetEdgeAddresses = {
  defaultTop: string[];
  left: string[];
  right: string[];
};

function splitVpcInternetEdgeAddresses(
  addrs: readonly string[],
  nodes: TerraformPlanNodesMap,
): VpcInternetEdgeAddresses {
  const out: VpcInternetEdgeAddresses = {
    defaultTop: [],
    left: [],
    right: [],
  };
  for (const addr of addrs) {
    const t = resourceTypeForAddress(nodes, addr);
    if (t === "aws_internet_gateway") {
      out.left.push(addr);
    } else if (t === "aws_nat_gateway" || t === "aws_eip") {
      out.right.push(addr);
    } else {
      out.defaultTop.push(addr);
    }
  }
  out.left.sort();
  out.right.sort();
  out.defaultTop.sort();
  return out;
}

function vpcInternetSideGutterPx(edgeAddrs: VpcInternetEdgeAddresses): number {
  return edgeAddrs.left.length > 0 || edgeAddrs.right.length > 0
    ? VPC_INTERNET_EDGE_GUTTER
    : 0;
}

function vpcInfrastructureTopPadPx(
  accountId: string,
  regionName: string,
  vpcId: string,
  vpcDefaultPlumbing: readonly TopologyVpcDefaultPlumbingBucket[],
  vpcFlowLogs: readonly TopologyVpcFlowLogBucket[],
  endpointSgs: readonly TopologyEndpointSecurityGroupBucket[],
  nodes: TerraformPlanNodesMap,
): number {
  let rows = 0;
  const defaultTop = splitVpcInternetEdgeAddresses(
    bucketAddressesForVpc(vpcDefaultPlumbing, accountId, regionName, vpcId),
    nodes,
  ).defaultTop;
  if (defaultTop.length) {
    rows++;
  }
  if (bucketAddressesForVpc(vpcFlowLogs, accountId, regionName, vpcId).length) {
    rows++;
  }
  if (bucketAddressesForVpc(endpointSgs, accountId, regionName, vpcId).length) {
    rows++;
  }
  if (rows === 0) {
    return 0;
  }
  return (
    rows * (TOPOLOGY_TIER2_H + TOPOLOGY_SATELLITE_GAP_PX) +
    TOPOLOGY_SATELLITE_GAP_PX
  );
}

function appendVpcInternetEdgeRectangles(
  skeleton: ExcalidrawElementSkeleton[],
  accountId: string,
  regionName: string,
  vpcId: string,
  vpcX: number,
  vpcY: number,
  vpcCellW: number,
  vpcCellBodyH: number,
  nodes: TerraformPlanNodesMap,
  edgeAddrs: VpcInternetEdgeAddresses,
): string[] {
  const out: string[] = [];
  const placeColumn = (addrs: readonly string[], side: "left" | "right") => {
    if (addrs.length === 0) {
      return;
    }
    const columnH =
      addrs.length * VPC_INTERNET_EDGE_TILE_H +
      Math.max(0, addrs.length - 1) * VPC_INTERNET_EDGE_TILE_GAP;
    const x =
      side === "left" ? vpcX : vpcX + vpcCellW - VPC_INTERNET_EDGE_TILE_W;
    let y = vpcY + Math.max(VPC_TOP_PAD, (vpcCellBodyH - columnH) / 2);
    for (const addr of addrs) {
      out.push(addr);
      const resourceType = resourceTypeForAddress(nodes, addr);
      const action = getTerraformPlanNodeAction(
        nodes[addr] as TerraformPlanGraphNode | undefined,
      );
      pushResourceRectangleSkeleton(
        skeleton,
        addr,
        x,
        y,
        VPC_INTERNET_EDGE_TILE_W,
        VPC_INTERNET_EDGE_TILE_H,
        nodes,
        {
          initiallyVisible: isInitiallyVisibleTerraformTopologyTile(
            resourceType,
            action,
          ),
          explodeParentKeys: [],
          satelliteTier: 2,
          egress: { accountId, region: regionName, vpcId },
        },
      );
      y += VPC_INTERNET_EDGE_TILE_H + VPC_INTERNET_EDGE_TILE_GAP;
    }
  };
  placeColumn(edgeAddrs.left, "left");
  placeColumn(edgeAddrs.right, "right");
  return out;
}

function appendVpcFlowLogBundleSatelliteEdges(
  satelliteLineSpecs: TopologySatelliteLineSpec[],
  flowAddrs: readonly string[],
  nodes: TerraformPlanNodesMap,
): void {
  const flowAddr = flowAddrs.find((a) => {
    const pr = getPrimaryResource(nodes[a] as TerraformPlanGraphNode);
    return pr?.type === "aws_flow_log";
  });
  if (!flowAddr) {
    return;
  }
  for (const addr of flowAddrs) {
    if (addr === flowAddr) {
      continue;
    }
    satelliteLineSpecs.push({
      edge: {
        source: flowAddr,
        target: addr,
        type: "vpc_flow_module",
        label: "VPC flow log",
      },
      origin: "topology_vpc_flow",
      strokeColor: TOPOLOGY_DATAFLOW_STROKE,
    });
  }
}

/** Default VPC, flow-log, and endpoint-SG tiles at the top inside a VPC frame. */
function appendVpcInfrastructureStrips(
  skeleton: ExcalidrawElementSkeleton[],
  accountId: string,
  regionName: string,
  vpcId: string,
  vpcX: number,
  vpcY: number,
  vpcCellW: number,
  nodes: TerraformPlanNodesMap,
  defaultAddrs: readonly string[],
  flowAddrs: readonly string[],
  endpointSgAddrs: readonly string[],
): string[] {
  const out: string[] = [];
  const innerLeft = vpcX + INNER_PAD;
  const innerW = Math.max(0, vpcCellW - 2 * INNER_PAD);
  let rowY = vpcY + VPC_TOP_PAD;
  const tileGap = TOPOLOGY_SATELLITE_GAP_PX;

  const placeRow = (addrs: readonly string[]) => {
    if (addrs.length === 0) {
      return;
    }
    const rowW =
      addrs.length * TOPOLOGY_TIER2_W + Math.max(0, addrs.length - 1) * tileGap;
    let x = innerLeft + Math.max(0, (innerW - rowW) / 2);
    for (const addr of addrs) {
      out.push(addr);
      const node = nodes[addr] as TerraformPlanGraphNode | undefined;
      const resourceType = getTerraformCardResourceType(
        addr,
        getPrimaryResource(node) as Record<string, unknown> | null,
      );
      const action = getTerraformPlanNodeAction(node);
      pushResourceRectangleSkeleton(
        skeleton,
        addr,
        x,
        rowY,
        TOPOLOGY_TIER2_W,
        TOPOLOGY_TIER2_H,
        nodes,
        {
          initiallyVisible: isInitiallyVisibleTerraformTopologyTile(
            resourceType,
            action,
          ),
          explodeParentKeys: [],
          satelliteTier: 2,
        },
      );
      x += TOPOLOGY_TIER2_W + tileGap;
    }
    rowY += TOPOLOGY_TIER2_H + tileGap;
  };

  placeRow(defaultAddrs);
  placeRow(flowAddrs);
  placeRow(endpointSgAddrs);

  return out;
}

function companionStackTileMetrics(
  nodes: TerraformPlanNodesMap,
  satAddr: string,
  tier1W: number,
): { tileH: number; tileW: number; tileXOffset: number; tier: 1 | 2 } {
  const n = nodes[satAddr] as TerraformPlanGraphNode | undefined;
  const pr = getPrimaryResource(n);
  const t = typeof pr?.type === "string" ? pr.type : "";
  if (t === "aws_iam_policy_document") {
    return {
      tileH: TOPOLOGY_TIER2_H,
      tileW: TOPOLOGY_TIER2_W,
      tileXOffset: Math.floor((tier1W - TOPOLOGY_TIER2_W) / 2),
      tier: 2,
    };
  }
  return {
    tileH: TOPOLOGY_TIER1_H,
    tileW: tier1W,
    tileXOffset: 0,
    tier: 1,
  };
}

function growClusterBounds(
  prev: { minX: number; minY: number; maxX: number; maxY: number } | null,
  x: number,
  y: number,
  w: number,
  h: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const maxX = x + w;
  const maxY = y + h;
  if (!prev) {
    return { minX: x, minY: y, maxX, maxY };
  }
  return {
    minX: Math.min(prev.minX, x),
    minY: Math.min(prev.minY, y),
    maxX: Math.max(prev.maxX, maxX),
    maxY: Math.max(prev.maxY, maxY),
  };
}

type TopologyPrimaryClusterPlacement = {
  accountId: string;
  region: string;
  vpcId: string | null;
};

/** Primary grid + top CloudWatch, bottom IAM / KMS policy (left) / SG (right) satellites and data-flow edges. */
function appendTopologyResourceRectangles(
  skeleton: ExcalidrawElementSkeleton[],
  placement: TopologyPrimaryClusterPlacement,
  addrs: readonly string[],
  contentOriginX: number,
  contentOriginY: number,
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  globalPlacedIamSatellites: Set<string>,
  globalPlacedKmsPolicySatellites: Set<string>,
  globalPlacedSgSatellites: Set<string>,
  globalPlacedCloudWatchSatellites: Set<string>,
  globalPlacedS3Satellites: Set<string>,
  globalPlacedSqsSatellites: Set<string>,
  satelliteLineSpecs: TopologySatelliteLineSpec[],
  plan?: unknown,
): string[] {
  const clusterFrameIds: string[] = [];
  const sorted = [...addrs].sort();
  const { cols: rcCols, rows: rcRows } = gridColsRows(sorted.length);
  const cellW = maxTopologyCellFootprintPx(sorted, nodes, arnIndex, plan);

  const rowTopBase: number[] = new Array(rcRows).fill(0);
  const rowBottomBase: number[] = new Array(rcRows).fill(0);
  for (let ri = 0; ri < sorted.length; ri++) {
    const addr = sorted[ri]!;
    const rr = Math.floor(ri / rcCols);
    const cloudWatchExtra = cloudWatchSatelliteStackHeightPx(
      nodes,
      addr,
      TOPOLOGY_TIER1_H,
      TOPOLOGY_SATELLITE_GAP_PX,
    );
    const iamExtra = iamSatelliteStackHeightPx(
      nodes,
      addr,
      arnIndex,
      TOPOLOGY_TIER1_H,
      TOPOLOGY_TIER2_H,
      TOPOLOGY_SATELLITE_GAP_PX,
    );
    const kmsPolicyExtra = kmsPolicySatelliteStackHeightPx(
      nodes,
      addr,
      arnIndex,
      TOPOLOGY_TIER1_H,
      TOPOLOGY_SATELLITE_GAP_PX,
    );
    const sgExtra = sgSatelliteStackHeightPx(
      nodes,
      addr,
      arnIndex,
      TOPOLOGY_TIER1_H,
      TOPOLOGY_TIER2_H,
      TOPOLOGY_SATELLITE_GAP_PX,
      plan,
    );
    const s3Extra = s3SatelliteStackHeightPx(
      nodes,
      addr,
      arnIndex,
      TOPOLOGY_TIER1_H,
      TOPOLOGY_TIER2_H,
      TOPOLOGY_SATELLITE_GAP_PX,
    );
    const sqsExtra = sqsSatelliteStackHeightPx(
      nodes,
      addr,
      arnIndex,
      TOPOLOGY_TIER1_H,
      TOPOLOGY_TIER2_H,
      TOPOLOGY_SATELLITE_GAP_PX,
    );
    const leftColumnBottom = stackSequentialSatelliteHeightsPx(
      TOPOLOGY_SATELLITE_GAP_PX,
      [iamExtra, kmsPolicyExtra, s3Extra],
    );
    const rightColumnBottom = stackSequentialSatelliteHeightsPx(
      TOPOLOGY_SATELLITE_GAP_PX,
      [sgExtra, sqsExtra],
    );
    rowTopBase[rr] = Math.max(rowTopBase[rr]!, cloudWatchExtra);
    rowBottomBase[rr] = Math.max(
      rowBottomBase[rr]!,
      leftColumnBottom,
      rightColumnBottom,
    );
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
    const rx = contentOriginX + rc * (cellW + RESOURCE_GAP);
    const ry = rowOriginY[rr]! + rowTopBase[rr]!;

    const clusterChildIds: string[] = [];
    let clusterBounds: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    } | null = null;
    const addClusterMember = (
      id: string,
      boxX: number,
      boxY: number,
      boxW: number,
      boxH: number,
    ) => {
      clusterChildIds.push(id);
      clusterBounds = growClusterBounds(clusterBounds, boxX, boxY, boxW, boxH);
    };

    const node = nodes[addr] as TerraformPlanGraphNode | undefined;
    const resourceType = getTerraformCardResourceType(
      addr,
      getPrimaryResource(node) as Record<string, unknown> | null,
    );
    const action = getTerraformPlanNodeAction(node);
    const initiallyVisible = isInitiallyVisibleTerraformTopologyTile(
      resourceType,
      action,
    );

    addClusterMember(addr, rx, ry, RESOURCE_RECT_W, RESOURCE_RECT_H);
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
    const kmsBuild = buildKmsKeyPolicyCluster(nodes, addr, arnIndex);
    const sgBuild = buildLambdaSgCluster(nodes, addr, arnIndex, plan);
    const s3Build = buildS3CompanionCluster(nodes, addr, arnIndex);
    const sqsBuild = buildSqsCompanionCluster(nodes, addr, arnIndex);
    const cloudWatchBuild = buildResourceCloudWatchCluster(nodes, addr);
    const { iamW, sgW } = satelliteColumnWidths();
    const { alarmW, logGroupW } = cloudWatchColumnWidths();

    for (const e of edges) {
      satelliteLineSpecs.push({
        edge: e,
        origin: "topology_iam",
        strokeColor: TOPOLOGY_DATAFLOW_STROKE,
      });
    }
    for (const e of kmsBuild.edges) {
      satelliteLineSpecs.push({
        edge: e,
        origin: "topology_kms",
        strokeColor: TOPOLOGY_DATAFLOW_STROKE,
      });
    }
    for (const e of sgBuild.edges) {
      satelliteLineSpecs.push({
        edge: e,
        origin: "topology_sg",
        strokeColor: TOPOLOGY_DATAFLOW_STROKE,
      });
    }
    for (const e of s3Build.edges) {
      satelliteLineSpecs.push({
        edge: e,
        origin: "topology_s3",
        strokeColor: TOPOLOGY_DATAFLOW_STROKE,
      });
    }
    for (const e of sqsBuild.edges) {
      satelliteLineSpecs.push({
        edge: e,
        origin: "topology_sqs",
        strokeColor: TOPOLOGY_DATAFLOW_STROKE,
      });
    }
    for (const e of cloudWatchBuild.edges) {
      satelliteLineSpecs.push({
        edge: e,
        origin: "topology_cloudwatch",
        strokeColor: TOPOLOGY_DATAFLOW_STROKE,
      });
    }

    const hasLeft =
      Boolean(cluster) || Boolean(kmsBuild.cluster) || Boolean(s3Build.cluster);
    const hasSg = Boolean(sgBuild.cluster);
    const hasSqs = Boolean(sqsBuild.cluster);
    const cwHasAlarm = Boolean(cloudWatchBuild.cluster?.alarms.length);
    const cwHasLog = Boolean(cloudWatchBuild.cluster?.logGroups.length);
    const logGroupX =
      cwHasAlarm && cwHasLog
        ? rx + CLOUDWATCH_LEFT_PAD + TOPOLOGY_TIER1_W + CLOUDWATCH_COLUMN_GAP_PX
        : rx + TOPOLOGY_TIER0_W - logGroupW - CLOUDWATCH_RIGHT_PAD;

    if (cloudWatchBuild.cluster) {
      const cloudWatchTop =
        ry -
        cloudWatchSatelliteStackHeightPx(
          nodes,
          addr,
          TOPOLOGY_TIER1_H,
          TOPOLOGY_SATELLITE_GAP_PX,
        ) +
        TOPOLOGY_SATELLITE_GAP_PX;

      let yAlarm = cloudWatchTop;
      const alarmX = rx + CLOUDWATCH_LEFT_PAD;
      for (const alarmPath of cloudWatchBuild.cluster.alarms) {
        if (!globalPlacedCloudWatchSatellites.has(alarmPath)) {
          globalPlacedCloudWatchSatellites.add(alarmPath);
          addClusterMember(alarmPath, alarmX, yAlarm, alarmW, TOPOLOGY_TIER1_H);
          pushResourceRectangleSkeleton(
            skeleton,
            alarmPath,
            alarmX,
            yAlarm,
            alarmW,
            TOPOLOGY_TIER1_H,
            nodes,
            {
              initiallyVisible: false,
              explodeParentKeys: [addr],
              satelliteTier: 1,
            },
          );
        }
        yAlarm += TOPOLOGY_TIER1_H + TOPOLOGY_SATELLITE_GAP_PX;
      }

      let yLogGroup = cloudWatchTop;
      for (const logGroupPath of cloudWatchBuild.cluster.logGroups) {
        if (!globalPlacedCloudWatchSatellites.has(logGroupPath)) {
          globalPlacedCloudWatchSatellites.add(logGroupPath);
          addClusterMember(
            logGroupPath,
            logGroupX,
            yLogGroup,
            logGroupW,
            TOPOLOGY_TIER1_H,
          );
          pushResourceRectangleSkeleton(
            skeleton,
            logGroupPath,
            logGroupX,
            yLogGroup,
            logGroupW,
            TOPOLOGY_TIER1_H,
            nodes,
            {
              initiallyVisible: false,
              explodeParentKeys: [addr],
              satelliteTier: 1,
            },
          );
        }
        yLogGroup += TOPOLOGY_TIER1_H + TOPOLOGY_SATELLITE_GAP_PX;
      }
    }

    const yAfterPrimary = ry + RESOURCE_RECT_H;
    let yLeft = yAfterPrimary;

    if (cluster) {
      yLeft += TOPOLOGY_SATELLITE_GAP_PX;
      const satXIam = rx;
      for (let si = 0; si < cluster.stack.length; si++) {
        const satAddr = cluster.stack[si]!;
        const isRoleTile = si === 0;
        const tileH = isRoleTile ? TOPOLOGY_TIER1_H : TOPOLOGY_TIER2_H;
        const tileW = isRoleTile ? iamW : TOPOLOGY_TIER2_W;
        const tileX = isRoleTile
          ? satXIam
          : satXIam + Math.floor((iamW - TOPOLOGY_TIER2_W) / 2);
        if (globalPlacedIamSatellites.has(satAddr)) {
          yLeft += tileH + TOPOLOGY_SATELLITE_GAP_PX;
          continue;
        }
        globalPlacedIamSatellites.add(satAddr);
        addClusterMember(satAddr, tileX, yLeft, tileW, tileH);
        pushResourceRectangleSkeleton(
          skeleton,
          satAddr,
          tileX,
          yLeft,
          tileW,
          tileH,
          nodes,
          {
            initiallyVisible: false,
            explodeParentKeys: [addr],
            satelliteTier: isRoleTile ? 1 : 2,
          },
        );
        yLeft += tileH + TOPOLOGY_SATELLITE_GAP_PX;
      }
    }

    if (kmsBuild.cluster) {
      if (!cluster) {
        yLeft += TOPOLOGY_SATELLITE_GAP_PX;
      }
      const satXKms = rx;
      for (const policyPath of kmsBuild.cluster.policies) {
        if (globalPlacedKmsPolicySatellites.has(policyPath)) {
          yLeft += TOPOLOGY_TIER1_H + TOPOLOGY_SATELLITE_GAP_PX;
          continue;
        }
        globalPlacedKmsPolicySatellites.add(policyPath);
        addClusterMember(policyPath, satXKms, yLeft, iamW, TOPOLOGY_TIER1_H);
        pushResourceRectangleSkeleton(
          skeleton,
          policyPath,
          satXKms,
          yLeft,
          iamW,
          TOPOLOGY_TIER1_H,
          nodes,
          {
            initiallyVisible: false,
            explodeParentKeys: [addr],
            satelliteTier: 1,
          },
        );
        yLeft += TOPOLOGY_TIER1_H + TOPOLOGY_SATELLITE_GAP_PX;
      }
    }

    if (s3Build.cluster) {
      if (!cluster && !kmsBuild.cluster) {
        yLeft += TOPOLOGY_SATELLITE_GAP_PX;
      }
      const satXS3 = rx;
      for (const satAddr of s3Build.cluster.stack) {
        const m = companionStackTileMetrics(nodes, satAddr, iamW);
        if (globalPlacedS3Satellites.has(satAddr)) {
          yLeft += m.tileH + TOPOLOGY_SATELLITE_GAP_PX;
          continue;
        }
        globalPlacedS3Satellites.add(satAddr);
        addClusterMember(
          satAddr,
          satXS3 + m.tileXOffset,
          yLeft,
          m.tileW,
          m.tileH,
        );
        pushResourceRectangleSkeleton(
          skeleton,
          satAddr,
          satXS3 + m.tileXOffset,
          yLeft,
          m.tileW,
          m.tileH,
          nodes,
          {
            initiallyVisible: false,
            explodeParentKeys: [addr],
            satelliteTier: m.tier,
          },
        );
        yLeft += m.tileH + TOPOLOGY_SATELLITE_GAP_PX;
      }
    }

    const hasRight = hasSg || hasSqs;
    const satXRight =
      hasLeft && hasRight
        ? rx + TOPOLOGY_TIER1_W + IAM_SG_COLUMN_GAP_PX
        : rx + TOPOLOGY_TIER0_W - sgW - SG_RIGHT_PAD;
    const ruleTileX = satXRight + Math.floor((sgW - TOPOLOGY_TIER2_W) / 2);
    let yRight = yAfterPrimary;

    if (sgBuild.cluster) {
      yRight += TOPOLOGY_SATELLITE_GAP_PX;
      for (let gi = 0; gi < sgBuild.cluster.groups.length; gi++) {
        const group = sgBuild.cluster.groups[gi]!;

        if (!globalPlacedSgSatellites.has(group.sgPath)) {
          globalPlacedSgSatellites.add(group.sgPath);
          addClusterMember(
            group.sgPath,
            satXRight,
            yRight,
            sgW,
            TOPOLOGY_TIER1_H,
          );
          pushResourceRectangleSkeleton(
            skeleton,
            group.sgPath,
            satXRight,
            yRight,
            sgW,
            TOPOLOGY_TIER1_H,
            nodes,
            {
              initiallyVisible: false,
              explodeParentKeys: [addr],
              satelliteTier: 1,
            },
          );
        }
        yRight += TOPOLOGY_TIER1_H + TOPOLOGY_SATELLITE_GAP_PX;

        for (const rulePath of group.rules) {
          if (!globalPlacedSgSatellites.has(rulePath)) {
            globalPlacedSgSatellites.add(rulePath);
            addClusterMember(
              rulePath,
              ruleTileX,
              yRight,
              TOPOLOGY_TIER2_W,
              TOPOLOGY_TIER2_H,
            );
            pushResourceRectangleSkeleton(
              skeleton,
              rulePath,
              ruleTileX,
              yRight,
              TOPOLOGY_TIER2_W,
              TOPOLOGY_TIER2_H,
              nodes,
              {
                initiallyVisible: false,
                explodeParentKeys: [addr],
                satelliteTier: 2,
              },
            );
          }
          yRight += TOPOLOGY_TIER2_H + TOPOLOGY_SATELLITE_GAP_PX;
        }

        if (gi < sgBuild.cluster.groups.length - 1) {
          yRight += TOPOLOGY_SG_BETWEEN_GROUPS_GAP_PX;
        }
      }
    }

    if (sqsBuild.cluster) {
      if (!sgBuild.cluster) {
        yRight += TOPOLOGY_SATELLITE_GAP_PX;
      }
      for (const satAddr of sqsBuild.cluster.stack) {
        const m = companionStackTileMetrics(nodes, satAddr, sgW);
        if (globalPlacedSqsSatellites.has(satAddr)) {
          yRight += m.tileH + TOPOLOGY_SATELLITE_GAP_PX;
          continue;
        }
        globalPlacedSqsSatellites.add(satAddr);
        addClusterMember(
          satAddr,
          satXRight + m.tileXOffset,
          yRight,
          m.tileW,
          m.tileH,
        );
        pushResourceRectangleSkeleton(
          skeleton,
          satAddr,
          satXRight + m.tileXOffset,
          yRight,
          m.tileW,
          m.tileH,
          nodes,
          {
            initiallyVisible: false,
            explodeParentKeys: [addr],
            satelliteTier: m.tier,
          },
        );
        yRight += m.tileH + TOPOLOGY_SATELLITE_GAP_PX;
      }
    }

    const pad = TOPOLOGY_PRIMARY_CLUSTER_FRAME_PAD_PX;
    const b = clusterBounds!;
    const clusterSkId = primaryClusterSkeletonId(addr);
    skeleton.push({
      type: "frame",
      id: clusterSkId,
      name: shortTerraformResourceLabel(addr).slice(0, 48),
      x: b.minX - pad,
      y: b.minY - pad,
      width: b.maxX - b.minX + 2 * pad,
      height: b.maxY - b.minY + 2 * pad,
      children: clusterChildIds as readonly string[],
      customData: frameCustomData(
        "primaryCluster",
        placement.accountId,
        placement.region,
        placement.vpcId,
        clusterSkId,
        { terraformPrimaryAddress: addr },
      ),
    });
    clusterFrameIds.push(clusterSkId);
  }

  return clusterFrameIds;
}

/**
 * Terraform topology rectangles use skeleton `id` = resource address. Used to scope dependency
 * edges to resources that received a layout box (same filter idea as ELK `vertexSet`).
 */
function collectTopologyRectangleLayoutFromSkeleton(
  skeleton: readonly ExcalidrawElementSkeleton[],
): {
  placedVertexSet: Set<string>;
  layoutBoxes: Record<string, TerraformDependencyLayoutBox>;
} {
  const placedVertexSet = new Set<string>();
  const layoutBoxes: Record<string, TerraformDependencyLayoutBox> = {};
  for (const el of skeleton) {
    if (el.type !== "rectangle" || typeof el.id !== "string") {
      continue;
    }
    const id = el.id;
    if (!id || id.startsWith("__")) {
      continue;
    }
    placedVertexSet.add(id);
    layoutBoxes[id] = {
      x: typeof el.x === "number" ? el.x : 0,
      y: typeof el.y === "number" ? el.y : 0,
      width: typeof el.width === "number" ? el.width : 0,
      height: typeof el.height === "number" ? el.height : 0,
    };
  }
  return { placedVertexSet, layoutBoxes };
}

/**
 * Excalidraw paints later elements on top. Put graph **edges** at the back, then topology
 * **frames**, then everything else (resource rectangles / AWS icons / labels). This keeps
 * dimmed cards (which now have opaque washed backgrounds — see `terraformColorWash`) from
 * being hidden behind edges that route across them, while orbit binding still anchors the
 * arrowhead to the card boundary so endpoints stay legible.
 */
function reorderTopologyElementsZStack(
  elements: readonly ExcalidrawElement[],
): ExcalidrawElement[] {
  const isTopologyFrame = (el: ExcalidrawElement) =>
    el.type === "frame" &&
    Boolean(
      (el.customData as { terraformTopologyRole?: string } | undefined)
        ?.terraformTopologyRole,
    );

  const isTerraformTopologyEdge = (el: ExcalidrawElement) => {
    if (el.type !== "line" && el.type !== "arrow") {
      return false;
    }
    const layer = getTerraformEdgeLayer(el);
    return (
      layer === "dependency" || layer === "dataFlow" || layer === "networking"
    );
  };

  const withIndex = elements.map((el, index) => ({ el, index }));
  const lines = withIndex.filter(({ el }) => isTerraformTopologyEdge(el));
  const frames = withIndex.filter(({ el }) => isTopologyFrame(el));
  const rest = withIndex.filter(
    ({ el }) => !isTopologyFrame(el) && !isTerraformTopologyEdge(el),
  );

  return [...lines, ...frames, ...rest].map(({ el }) => el);
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
  vpcEndpointBuckets: readonly TopologyVpcEndpointBucket[] = [],
  routeTableBottomPlacements: TopologyRouteTableBottomPlacements = {
    zoneBottom: [],
    vpcBottom: [],
  },
  vpcDefaultPlumbingBuckets: readonly TopologyVpcDefaultPlumbingBucket[] = [],
  vpcFlowLogBuckets: readonly TopologyVpcFlowLogBucket[] = [],
  endpointSecurityGroupBuckets: readonly TopologyEndpointSecurityGroupBucket[] = [],
): Promise<{
  elements: ExcalidrawElement[];
  meta: TerraformTopologySceneMeta;
}> {
  const counts = countTopology(model);
  const regionalPrimaryCount = regionalBuckets.reduce(
    (n, b) => n + b.addresses.length,
    0,
  );
  const vpcEndpointCount = vpcEndpointBuckets.reduce(
    (n, b) => n + b.addresses.length,
    0,
  );
  const routeTableCount =
    routeTableBottomPlacements.zoneBottom.reduce(
      (n, z) => n + z.addresses.length,
      0,
    ) +
    routeTableBottomPlacements.vpcBottom.reduce(
      (n, v) => n + v.addresses.length,
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
        vpcEndpointCount: 0,
        routeTableCount: 0,
        dependencyEdgeCount: 0,
        skippedLayout: true,
        skipReason: "empty_topology",
      },
    };
  }

  const skeleton: ExcalidrawElementSkeleton[] = [];
  const arnIndex = buildArnIndexForTopology(nodes);
  const vpcNameById = buildTopologyVpcNameMap(plan);
  const subnetNameById = buildTopologySubnetNameMap(plan);
  const satelliteLineSpecs: TopologySatelliteLineSpec[] = [];
  const globalPlacedIamSatellites = new Set<string>();
  const globalPlacedKmsPolicySatellites = new Set<string>();
  const globalPlacedSgSatellites = new Set<string>();
  const globalPlacedCloudWatchSatellites = new Set<string>();
  const globalPlacedS3Satellites = new Set<string>();
  const globalPlacedSqsSatellites = new Set<string>();
  const zoneRouteAnchorDebug: TerraformTopologyZoneRouteAnchorDebugRow[] = [];

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
      let vpcCellBodyH = MIN_VPC_H + FRAME_CONTENT_SLACK_Y;
      let maxVpcBottomStripInset = 0;
      if (hasVpc) {
        for (const [vpcId] of vpcEntries) {
          const vpcZs = zonesForVpc(zones, accountId, regionName, vpcId);
          const rtZoneSizing = buildRouteTableZoneSizingMapForVpc(
            routeTableBottomPlacements,
            accountId,
            regionName,
            vpcId,
          );
          const infraTop = vpcInfrastructureTopPadPx(
            accountId,
            regionName,
            vpcId,
            vpcDefaultPlumbingBuckets,
            vpcFlowLogBuckets,
            endpointSecurityGroupBuckets,
            nodes,
          );
          const defaultPlumbingAddrs = bucketAddressesForVpc(
            vpcDefaultPlumbingBuckets,
            accountId,
            regionName,
            vpcId,
          );
          const internetEdges = splitVpcInternetEdgeAddresses(
            defaultPlumbingAddrs,
            nodes,
          );
          const vd = vpcFrameDimensionsForZones(
            vpcZs,
            nodes,
            arnIndex,
            plan,
            rtZoneSizing,
            infraTop,
            subnetNameById,
            vpcInternetSideGutterPx(internetEdges),
          );
          const epAddrs = endpointsForVpc(
            vpcEndpointBuckets,
            accountId,
            regionName,
            vpcId,
          );
          const epMinOuter =
            epAddrs.length > 0
              ? 2 * INNER_PAD +
                FRAME_CONTENT_SLACK_X +
                vpcEndpointSingleRowMinInnerWidth(epAddrs.length)
              : 0;
          const vpcRtSizing = vpcBottomRouteTablesRowSizing(
            routeTableBottomPlacements,
            accountId,
            regionName,
            vpcId,
          );
          const rtMinOuter =
            vpcRtSizing != null
              ? 2 * INNER_PAD +
                FRAME_CONTENT_SLACK_X +
                vpcRtSizing.minInnerWidthPx
              : 0;
          vpcCellW = Math.max(vpcCellW, vd.w, epMinOuter, rtMinOuter);
        }
        for (const [vpcId] of vpcEntries) {
          const vpcZs = zonesForVpc(zones, accountId, regionName, vpcId);
          const rtZoneSizing = buildRouteTableZoneSizingMapForVpc(
            routeTableBottomPlacements,
            accountId,
            regionName,
            vpcId,
          );
          const infraTop = vpcInfrastructureTopPadPx(
            accountId,
            regionName,
            vpcId,
            vpcDefaultPlumbingBuckets,
            vpcFlowLogBuckets,
            endpointSecurityGroupBuckets,
            nodes,
          );
          const defaultPlumbingAddrs = bucketAddressesForVpc(
            vpcDefaultPlumbingBuckets,
            accountId,
            regionName,
            vpcId,
          );
          const internetEdges = splitVpcInternetEdgeAddresses(
            defaultPlumbingAddrs,
            nodes,
          );
          const vd = vpcFrameDimensionsForZones(
            vpcZs,
            nodes,
            arnIndex,
            plan,
            rtZoneSizing,
            infraTop,
            subnetNameById,
            vpcInternetSideGutterPx(internetEdges),
          );
          const epAddrs = endpointsForVpc(
            vpcEndpointBuckets,
            accountId,
            regionName,
            vpcId,
          );
          const vpcRtSizing = vpcBottomRouteTablesRowSizing(
            routeTableBottomPlacements,
            accountId,
            regionName,
            vpcId,
          );
          vpcCellBodyH = Math.max(vpcCellBodyH, vd.h);
          maxVpcBottomStripInset = Math.max(
            maxVpcBottomStripInset,
            vpcBottomStripInsetPx(
              epAddrs.length,
              vpcRtSizing?.maxExtentBelowAnchorPx ?? 0,
            ),
          );
        }
      }
      const vpcCellFrameH = vpcCellBodyH + maxVpcBottomStripInset;

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
        vpcGridH = vpcRows * (vpcCellFrameH + VPC_GAP) - VPC_GAP;
      }

      const innerTop = regionRowY + VPC_TOP_PAD;
      const contentInnerX = regionRowX + INNER_PAD;

      const vpcGridOriginX = contentInnerX;
      const vpcGridOriginY = innerTop;

      const regionChildIds: string[] = [];

      if (hasReg) {
        const regX = contentInnerX;
        const regY = innerTop + (hasVpc ? vpcGridH + REGIONAL_TO_VPC_GAP : 0);

        const regionalRectIds = appendTopologyResourceRectangles(
          skeleton,
          { accountId, region: regionName, vpcId: null },
          regionalAddrs,
          regX + INNER_PAD,
          regY + VPC_TOP_PAD,
          nodes,
          arnIndex,
          globalPlacedIamSatellites,
          globalPlacedKmsPolicySatellites,
          globalPlacedSgSatellites,
          globalPlacedCloudWatchSatellites,
          globalPlacedS3Satellites,
          globalPlacedSqsSatellites,
          satelliteLineSpecs,
          plan,
        );
        regionChildIds.push(...regionalRectIds);
      }

      const vpcFrameIds: string[] = [];

      for (let vi = 0; hasVpc && vi < vpcEntries.length; vi++) {
        const [vpcId] = vpcEntries[vi]!;
        const col = vi % vpcCols;
        const row = Math.floor(vi / vpcCols);
        const vpcX = vpcGridOriginX + col * (vpcCellW + VPC_GAP);
        const vpcY = vpcGridOriginY + row * (vpcCellFrameH + VPC_GAP);
        const vpcSkId = skeletonId("vpc", accountId, regionName, vpcId);
        vpcFrameIds.push(vpcSkId);

        const vpcZs = zonesForVpc(zones, accountId, regionName, vpcId).sort(
          compareTopologyZonesByTier(subnetNameById),
        );

        const epAddrs = endpointsForVpc(
          vpcEndpointBuckets,
          accountId,
          regionName,
          vpcId,
        );
        const vpcBottomRtRowRaw = routeTablesVpcBottomRow(
          routeTableBottomPlacements,
          accountId,
          regionName,
          vpcId,
        );
        const fanOutRtAddrs =
          plan != null
            ? computeVpcRouteTableFanOutAddressesForVpc(
                zones,
                routeTableBottomPlacements,
                plan as never,
                accountId,
                regionName,
                vpcId,
              )
            : new Set<string>();
        const vpcBottomRtRow =
          vpcBottomRtRowRaw && fanOutRtAddrs.size > 0
            ? {
                ...vpcBottomRtRowRaw,
                addresses: vpcBottomRtRowRaw.addresses.filter(
                  (a) => !fanOutRtAddrs.has(a),
                ),
                routeChildrenByTable: Object.fromEntries(
                  vpcBottomRtRowRaw.addresses
                    .filter((a) => !fanOutRtAddrs.has(a))
                    .map((a) => [
                      a,
                      vpcBottomRtRowRaw.routeChildrenByTable[a] ?? [],
                    ]),
                ),
              }
            : vpcBottomRtRowRaw;
        const vpcBottomRtChildrenByTable =
          vpcBottomRtRowRaw?.routeChildrenByTable ?? {};
        const vpcBottomRtMaxH =
          vpcBottomRtRow && vpcBottomRtRow.addresses.length > 0
            ? routeTableMaxCompositeHeightForRowPx(
                vpcBottomRtRow.addresses,
                vpcBottomRtRow.routeChildrenByTable,
              )
            : 0;
        const rtStackAboveVpcBottomPx =
          epAddrs.length > 0
            ? Math.max(VPC_ENDPOINT_TILE_H, vpcBottomRtMaxH) + 8
            : 0;

        const defaultPlumbingAddrs = bucketAddressesForVpc(
          vpcDefaultPlumbingBuckets,
          accountId,
          regionName,
          vpcId,
        );
        const internetEdgeAddrs = splitVpcInternetEdgeAddresses(
          defaultPlumbingAddrs,
          nodes,
        );
        const flowLogAddrs = bucketAddressesForVpc(
          vpcFlowLogBuckets,
          accountId,
          regionName,
          vpcId,
        );
        const endpointSgAddrs = bucketAddressesForVpc(
          endpointSecurityGroupBuckets,
          accountId,
          regionName,
          vpcId,
        );
        const infraTop = vpcInfrastructureTopPadPx(
          accountId,
          regionName,
          vpcId,
          vpcDefaultPlumbingBuckets,
          vpcFlowLogBuckets,
          endpointSecurityGroupBuckets,
          nodes,
        );
        const vpcInfraIds = appendVpcInfrastructureStrips(
          skeleton,
          accountId,
          regionName,
          vpcId,
          vpcX,
          vpcY,
          vpcCellW,
          nodes,
          internetEdgeAddrs.defaultTop,
          flowLogAddrs,
          endpointSgAddrs,
        );
        const vpcInternetEdgeIds = appendVpcInternetEdgeRectangles(
          skeleton,
          accountId,
          regionName,
          vpcId,
          vpcX,
          vpcY,
          vpcCellW,
          vpcCellBodyH,
          nodes,
          internetEdgeAddrs,
        );
        appendVpcFlowLogBundleSatelliteEdges(
          satelliteLineSpecs,
          flowLogAddrs,
          nodes,
        );

        if (vpcZs.length === 0) {
          const vpcBottomRtRectIdsEmpty =
            vpcBottomRtRow && vpcBottomRtRow.addresses.length > 0
              ? appendRouteTableBottomEdgeRectangles(
                  skeleton,
                  accountId,
                  regionName,
                  vpcId,
                  vpcBottomRtRow.addresses,
                  vpcBottomRtRow.routeChildrenByTable,
                  vpcX,
                  vpcY,
                  vpcCellW,
                  vpcCellBodyH,
                  nodes,
                  undefined,
                  rtStackAboveVpcBottomPx,
                )
              : [];
          const vpcEpRectIdsEmpty =
            epAddrs.length > 0
              ? appendVpcEndpointEgressRectangles(
                  skeleton,
                  accountId,
                  regionName,
                  vpcId,
                  epAddrs,
                  vpcX,
                  vpcY,
                  vpcCellW,
                  vpcCellBodyH,
                  nodes,
                )
              : [];

          skeleton.push({
            type: "frame",
            id: vpcSkId,
            name: shortLabel("VPC", vpcNameById.get(vpcId) ?? vpcId),
            x: vpcX,
            y: vpcY,
            width: vpcCellW,
            height: vpcCellFrameH,
            children: [
              ...vpcInfraIds,
              ...vpcInternetEdgeIds,
              ...vpcBottomRtRectIdsEmpty,
              ...vpcEpRectIdsEmpty,
            ] as readonly string[],
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

        const rtZoneSizing = buildRouteTableZoneSizingMapForVpc(
          routeTableBottomPlacements,
          accountId,
          regionName,
          vpcId,
        );
        const vd = vpcFrameDimensionsForZones(
          vpcZs,
          nodes,
          arnIndex,
          plan,
          rtZoneSizing,
          infraTop,
          subnetNameById,
          vpcInternetSideGutterPx(internetEdgeAddrs),
        );
        const sideGutterPx = vpcInternetSideGutterPx(internetEdgeAddrs);
        const zoneGridOriginX = vpcX + INNER_PAD + sideGutterPx;
        const zoneGridOriginY = vpcY + VPC_TOP_PAD + infraTop;
        const zoneFrameIds: string[] = [];
        const zoneColumns = topologyZoneColumns(vpcZs, subnetNameById);

        for (let zcol = 0; zcol < zoneColumns.length; zcol++) {
          const column = zoneColumns[zcol]!;
          for (let zrow = 0; zrow < column.length; zrow++) {
            const z = column[zrow]!;
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
            const rectIds = z.mergedSupplementaryComposite
              ? appendMergedSubnetCompositeRectangles(
                  skeleton,
                  { accountId, region: regionName, vpcId },
                  addrs,
                  z,
                  zoneX + INNER_PAD,
                  zoneY + VPC_TOP_PAD,
                  nodes,
                  arnIndex,
                  plan,
                  subnetNameById,
                )
              : appendTopologyResourceRectangles(
                  skeleton,
                  { accountId, region: regionName, vpcId },
                  addrs,
                  zoneX + INNER_PAD,
                  zoneY + VPC_TOP_PAD,
                  nodes,
                  arnIndex,
                  globalPlacedIamSatellites,
                  globalPlacedKmsPolicySatellites,
                  globalPlacedSgSatellites,
                  globalPlacedCloudWatchSatellites,
                  globalPlacedS3Satellites,
                  globalPlacedSqsSatellites,
                  satelliteLineSpecs,
                  plan,
                );

            /** Primary footprint height; route anchor uses uniform `vd.perZoneBodyH` (cell bottom). */
            const zoneContentBodyHPx = zoneFrameSizeForTopologyAddresses(
              addrs,
              nodes,
              arnIndex,
              plan,
            ).h;
            let routeTableRowCenterBandW: number | undefined;
            if (addrs.length > 0) {
              const { cols: rcCols } = gridColsRows(addrs.length);
              const cellW = maxTopologyCellFootprintPx(
                addrs,
                nodes,
                arnIndex,
                plan,
              );
              routeTableRowCenterBandW =
                rcCols * cellW + Math.max(0, rcCols - 1) * RESOURCE_GAP;
            }
            const zoneRtRow = routeTablesZoneBottomRow(
              routeTableBottomPlacements,
              accountId,
              regionName,
              vpcId,
              z.subnetSignature,
            );
            const zoneRtRectIds =
              zoneRtRow && zoneRtRow.addresses.length > 0
                ? (() => {
                    if (zoneRouteAnchorDebug.length < 64) {
                      zoneRouteAnchorDebug.push({
                        accountId,
                        region: regionName,
                        vpcId,
                        subnetSignature: z.subnetSignature,
                        tier: topologySubnetTierFromZone(z, subnetNameById),
                        zoneContentBodyHPx,
                        routeAnchorBodyHPx: vd.perZoneBodyH,
                      });
                    }
                    return appendRouteTableBottomEdgeRectangles(
                      skeleton,
                      accountId,
                      regionName,
                      vpcId,
                      zoneRtRow.addresses,
                      zoneRtRow.routeChildrenByTable,
                      zoneX,
                      zoneY,
                      vd.perZoneW,
                      vd.perZoneBodyH,
                      nodes,
                      z.subnetSignature,
                      0,
                      routeTableRowCenterBandW,
                    );
                  })()
                : [];

            const fanOutRtRectIds: string[] = [];
            if (
              plan != null &&
              fanOutRtAddrs.size > 0 &&
              z.subnetIds.length > 0
            ) {
              for (const addr of fanOutRtAddrs) {
                const snSet = subnetSetForRouteTableAddress(
                  plan as never,
                  addr,
                );
                if (!snSet || !z.subnetIds.some((sid) => snSet.has(sid))) {
                  continue;
                }
                const routes = vpcBottomRtChildrenByTable[addr] ?? [];
                fanOutRtRectIds.push(
                  ...appendRouteTableBottomEdgeRectangles(
                    skeleton,
                    accountId,
                    regionName,
                    vpcId,
                    [addr],
                    { [addr]: [...routes] },
                    zoneX,
                    zoneY,
                    vd.perZoneW,
                    vd.perZoneBodyH,
                    nodes,
                    z.subnetSignature,
                    0,
                    routeTableRowCenterBandW,
                    {
                      placementIdSuffix: `__dup__${encodeURIComponent(
                        z.subnetSignature,
                      )}`,
                      semanticRouteTableDuplicate: true,
                    },
                  ),
                );
              }
            }

            skeleton.push({
              type: "frame",
              id: zoneSkId,
              name: zoneDisplayName(z, subnetNameById),
              x: zoneX,
              y: zoneY,
              width: vd.perZoneW,
              height: vd.perZoneH,
              children: [
                ...rectIds,
                ...zoneRtRectIds,
                ...fanOutRtRectIds,
              ] as readonly string[],
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
        }

        const vpcBottomRtRectIds =
          vpcBottomRtRow && vpcBottomRtRow.addresses.length > 0
            ? appendRouteTableBottomEdgeRectangles(
                skeleton,
                accountId,
                regionName,
                vpcId,
                vpcBottomRtRow.addresses,
                vpcBottomRtRow.routeChildrenByTable,
                vpcX,
                vpcY,
                vpcCellW,
                vpcCellBodyH,
                nodes,
                undefined,
                rtStackAboveVpcBottomPx,
              )
            : [];

        const vpcEpRectIds =
          epAddrs.length > 0
            ? appendVpcEndpointEgressRectangles(
                skeleton,
                accountId,
                regionName,
                vpcId,
                epAddrs,
                vpcX,
                vpcY,
                vpcCellW,
                vpcCellBodyH,
                nodes,
              )
            : [];

        skeleton.push({
          type: "frame",
          id: vpcSkId,
          name: shortLabel("VPC", vpcNameById.get(vpcId) ?? vpcId),
          x: vpcX,
          y: vpcY,
          width: vpcCellW,
          height: vpcCellFrameH,
          children: [
            ...vpcInfraIds,
            ...vpcInternetEdgeIds,
            ...zoneFrameIds,
            ...vpcBottomRtRectIds,
            ...vpcEpRectIds,
          ] as readonly string[],
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

      const innerContentW = Math.max(hasReg ? regDims.w : 0, vpcGridW);
      const innerContentH =
        vpcGridH +
        (hasReg && hasVpc ? REGIONAL_TO_VPC_GAP : 0) +
        (hasReg ? regDims.h : 0);

      const regionWidth = innerContentW + 2 * INNER_PAD + FRAME_CONTENT_SLACK_X;
      const regionHeight =
        VPC_TOP_PAD + innerContentH + 2 * INNER_PAD + FRAME_CONTENT_SLACK_Y;

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
      customData: frameCustomData("account", accountId, "", null, accountSkId),
    });

    accountCursorX += accountWidth + ACCOUNT_GAP;
  }

  const wideVertexSet = new Set(
    Object.keys(nodes).filter(
      (k) => k !== TERRAFORM_MODULE_TREE_KEY && !k.startsWith("__"),
    ),
  );
  const wideDirectedEdges = collectDirectedEdges(nodes, wideVertexSet);
  const { networkingDependencyEdges: wideNetworkingDependencyEdges } =
    partitionDirectedEdgesByNetworking(nodes, wideDirectedEdges);
  const wideNetDepPairKeys = new Set(
    wideNetworkingDependencyEdges.map((e) =>
      [e.source, e.target].sort().join("|||"),
    ),
  );
  const allNetworkingRecordEdges = collectNetworkingEdges(
    nodes as Record<
      string,
      { edges_data_flow?: unknown; edges_networking?: unknown }
    >,
  );
  const wideNetworkingRecordEdges = allNetworkingRecordEdges.filter((r) => {
    const s = resolveTerraformPlanVertexId(nodes, r.source);
    const t = resolveTerraformPlanVertexId(nodes, r.target);
    if (!s || !t) {
      return false;
    }
    return !wideNetDepPairKeys.has([s, t].sort().join("|||"));
  });
  const networkingStructuralPairKeys = new Set<string>([
    ...wideNetworkingDependencyEdges.map((e) =>
      [e.source, e.target].sort().join("|||"),
    ),
    ...wideNetworkingRecordEdges.map((r) => {
      const s = resolveTerraformPlanVertexId(nodes, r.source)!;
      const t = resolveTerraformPlanVertexId(nodes, r.target)!;
      return [s, t].sort().join("|||");
    }),
  ]);

  const dataFlowEdgeRecords = collectDataFlowEdges(
    nodes as Record<string, { edges_data_flow?: unknown }>,
  );
  const dataFlowUndirectedPairKeys = new Set(
    dataFlowEdgeRecords.map((e) => [e.source, e.target].sort().join("|||")),
  );
  const filteredSatelliteLineSpecs = satelliteLineSpecs.filter((s) => {
    const satKey = [
      resolveTerraformPlanVertexId(nodes, s.edge.source) ?? s.edge.source,
      resolveTerraformPlanVertexId(nodes, s.edge.target) ?? s.edge.target,
    ]
      .sort()
      .join("|||");
    return (
      !dataFlowUndirectedPairKeys.has(satKey) &&
      !networkingStructuralPairKeys.has(satKey)
    );
  });

  skeleton.unshift(
    ...buildTopologySatelliteLineSkeletons(filteredSatelliteLineSpecs),
  );

  const { placedVertexSet, layoutBoxes: topologyLayoutBoxes } =
    collectTopologyRectangleLayoutFromSkeleton(skeleton);
  const topologyDirectedEdges = collectDirectedEdges(nodes, placedVertexSet);
  const { dependencyEdges, networkingDependencyEdges } =
    partitionDirectedEdgesByNetworking(nodes, topologyDirectedEdges);
  const structuralUndirectedPairs = new Set(
    [...dependencyEdges, ...networkingDependencyEdges].map((e) =>
      [e.source, e.target].sort().join("|||"),
    ),
  );
  const netDepPairKeys = new Set(
    networkingDependencyEdges.map((e) =>
      [e.source, e.target].sort().join("|||"),
    ),
  );
  const networkingRecordEdgesFiltered = allNetworkingRecordEdges.filter((r) => {
    const s = resolveTerraformPlanVertexId(nodes, r.source);
    const t = resolveTerraformPlanVertexId(nodes, r.target);
    if (!s || !t || !placedVertexSet.has(s) || !placedVertexSet.has(t)) {
      return false;
    }
    return !netDepPairKeys.has([s, t].sort().join("|||"));
  });
  skeleton.push(
    ...buildTerraformDependencyLineSkeletons(
      nodes,
      topologyLayoutBoxes,
      dependencyEdges,
      { terraformSemanticOverview: true },
    ),
  );
  skeleton.push(
    ...buildTerraformNetworkingDependencyLineSkeletons(
      nodes,
      topologyLayoutBoxes,
      networkingDependencyEdges,
      { terraformSemanticOverview: true },
    ),
  );
  skeleton.push(
    ...buildTerraformNetworkingRecordLineSkeletons(
      nodes,
      topologyLayoutBoxes,
      networkingRecordEdgesFiltered,
      structuralUndirectedPairs,
      { terraformSemanticOverview: true },
    ),
  );
  skeleton.push(
    ...buildTerraformDataFlowLineSkeletons(
      nodes,
      topologyLayoutBoxes,
      dataFlowEdgeRecords,
      structuralUndirectedPairs,
      { terraformSemanticOverview: true },
    ),
  );

  let elements = convertToExcalidrawElements(skeleton, {
    regenerateIds: true,
  }) as ExcalidrawElement[];

  elements = applyTerraformResourceRectangleSoftDelete(elements, {
    semanticAllVisible: true,
  });
  elements = mirrorAndDetachTerraformResourceLabels(elements);
  elements = await injectTerraformAwsIconsIntoElements(elements);
  elements = reconcileTerraformVisibility(
    repairTerraformEdgeBindings(elements),
    {
      pins: TERRAFORM_IMPORT_EDGE_LAYER_PINS,
      hoverPeekKey: null,
    },
  );
  elements = reorderTopologyElementsZStack(elements);

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
      vpcEndpointCount,
      routeTableCount,
      dependencyEdgeCount: topologyDirectedEdges.length,
      ...(zoneRouteAnchorDebug.length > 0 ? { zoneRouteAnchorDebug } : {}),
    },
  };
}
