/**
 * Load per–primary-type JSON slot configs for semantic topology satellite placement.
 */

import { tfComfortPx } from "./terraformLayoutComfort";
import {
  getTopologyPrimaryLayoutJson,
  __topologyPrimaryLayoutsForTest,
  getRegisteredTopologyPrimaryLayoutTypes,
} from "./terraformTopologyPrimaryLayoutLoader";
import {
  type ResolvedPrimaryLayoutConfig,
  type ResolvedTopologyTiers,
  type TopologyPrimaryLayoutJson,
  type TopologySatelliteKind,
} from "./terraformTopologyPrimaryLayoutTypes";
import { buildSatelliteClusterForKind } from "./terraformTopologySatelliteEngine";
import { apiGatewayVpcLinkLeftSpanPx } from "./terraformTopologyApiGatewayLinks";
import {
  buildSatelliteContext,
  satelliteStackHeightPxForKind,
} from "./terraformTopologySatelliteRegistry";

import { getTerraformCardResourceType } from "./terraformResourceCardLabel";

import "./terraformTopologySatelliteRegistry";

import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

export {
  getTopologyPrimaryLayoutJson,
  __topologyPrimaryLayoutsForTest,
  getRegisteredTopologyPrimaryLayoutTypes,
};

export type { ResolvedPrimaryLayoutConfig, ResolvedTopologyTiers };

function resolveTiers(json: TopologyPrimaryLayoutJson): ResolvedTopologyTiers {
  const b = json.tierBase;
  return {
    tier0W: tfComfortPx(b.tier0.w),
    tier0H: tfComfortPx(b.tier0.h),
    tier1W: tfComfortPx(b.tier1.w),
    tier1H: tfComfortPx(b.tier1.h),
    tier2W: tfComfortPx(b.tier2.w),
    tier2H: tfComfortPx(b.tier2.h),
  };
}

function resolveConfig(
  json: TopologyPrimaryLayoutJson,
): ResolvedPrimaryLayoutConfig {
  return {
    primaryType: json.primaryType,
    attachments: [...json.attachments],
    enabledKinds: new Set(json.attachments),
    tiers: resolveTiers(json),
    padding: {
      sgRight: tfComfortPx(json.padding.sgRight),
      cloudwatchLeft: tfComfortPx(json.padding.cloudwatchLeft),
      cloudwatchRight: tfComfortPx(json.padding.cloudwatchRight),
      /** Legacy constant was not comfort-scaled. */
      primaryClusterFrame: json.padding.primaryClusterFrame,
    },
    gaps: {
      satellite: tfComfortPx(json.gaps.satellite),
      iamSgColumn: tfComfortPx(json.gaps.iamSgColumn),
      cloudwatchColumn: tfComfortPx(json.gaps.cloudwatchColumn),
      /** Matches {@link TOPOLOGY_SG_BETWEEN_GROUPS_GAP_PX} (not comfort-scaled). */
      sgBetweenGroups: json.gaps.sgBetweenGroups,
    },
    slots: json.slots,
  };
}

const DEFAULT_RESOLVED = resolveConfig(getTopologyPrimaryLayoutJson("default"));

/** Resolved layout for a Terraform primary resource type (`default` fallback). */
export function getPrimaryLayoutConfig(
  primaryType: string,
): ResolvedPrimaryLayoutConfig {
  const json = getTopologyPrimaryLayoutJson(primaryType);
  if (json.primaryType === "default") {
    return DEFAULT_RESOLVED;
  }
  return resolveConfig(json);
}

export function slotColumnKey(
  anchor: string,
  align: string,
): `${string}-${string}` {
  return `${anchor}-${align}`;
}

export function kindsForColumn(
  config: ResolvedPrimaryLayoutConfig,
  anchor: "top" | "bottom",
  align: "start" | "end",
): TopologySatelliteKind[] {
  const kinds: TopologySatelliteKind[] = [];
  for (const slot of config.slots) {
    if (slot.anchor === anchor && slot.align === align) {
      kinds.push(...slot.kinds);
    }
  }
  return kinds;
}

export function kindsForSideAnchor(
  config: ResolvedPrimaryLayoutConfig,
  anchor: "left" | "right",
  align?: "start" | "center" | "end",
): TopologySatelliteKind[] {
  const kinds: TopologySatelliteKind[] = [];
  for (const slot of config.slots) {
    if (slot.anchor !== anchor) {
      continue;
    }
    if (align != null && slot.align !== align) {
      continue;
    }
    kinds.push(...slot.kinds);
  }
  return kinds;
}

/**
 * Sum vertical space for satellite stacks drawn one after another below a primary, without
 * double-counting the gap between stacks (each stack's height already includes a leading gap).
 */
export function stackSequentialSatelliteHeightsPx(
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

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

export type SatelliteKindHeightContext = {
  nodes: TerraformPlanNodesMap;
  address: string;
  primaryType: string;
  arnIndex: Map<string, string>;
  plan?: unknown;
  tiers: ResolvedTopologyTiers;
  gaps: ResolvedPrimaryLayoutConfig["gaps"];
};

export function satelliteKindStackHeightPx(
  kind: TopologySatelliteKind,
  ctx: SatelliteKindHeightContext,
): number {
  const config = getPrimaryLayoutConfig(ctx.primaryType);
  const satCtx = buildSatelliteContext(
    ctx.nodes,
    ctx.address,
    ctx.arnIndex,
    ctx.plan,
  );
  return satelliteStackHeightPxForKind(kind, config, satCtx);
}

/** Top margin above tier-0 primary (CloudWatch band). */
export function primaryTopMarginPx(
  config: ResolvedPrimaryLayoutConfig,
  ctx: SatelliteKindHeightContext,
): number {
  const hasTopCw = config.slots.some(
    (s) =>
      s.anchor === "top" &&
      s.kinds.some(
        (k) => k === "cloudwatch_alarms" || k === "cloudwatch_log_groups",
      ),
  );
  if (!hasTopCw) {
    return 0;
  }
  return satelliteKindStackHeightPx("cloudwatch_alarms", ctx);
}

/** Bottom margin below tier-0 primary for one column. */
export function primaryBottomColumnMarginPx(
  config: ResolvedPrimaryLayoutConfig,
  ctx: SatelliteKindHeightContext,
  anchor: "bottom",
  align: "start" | "end",
): number {
  const kinds = kindsForColumn(config, anchor, align);
  const heights = kinds.map((k) => satelliteKindStackHeightPx(k, ctx));
  return stackSequentialSatelliteHeightsPx(ctx.gaps.satellite, heights);
}

export function primaryHasKindContent(
  kind: TopologySatelliteKind,
  ctx: SatelliteKindHeightContext,
): boolean {
  return satelliteKindStackHeightPx(kind, ctx) > 0;
}

export function primaryBottomHasStartContent(
  config: ResolvedPrimaryLayoutConfig,
  ctx: SatelliteKindHeightContext,
): boolean {
  return kindsForColumn(config, "bottom", "start").some((k) =>
    primaryHasKindContent(k, ctx),
  );
}

export function primaryBottomHasEndContent(
  config: ResolvedPrimaryLayoutConfig,
  ctx: SatelliteKindHeightContext,
): boolean {
  return kindsForColumn(config, "bottom", "end").some((k) =>
    primaryHasKindContent(k, ctx),
  );
}

/** Horizontal space reserved left of tier-0 (e.g. API Gateway VPC link). */
export function primaryLeftMarginPx(
  config: ResolvedPrimaryLayoutConfig,
  ctx: SatelliteKindHeightContext,
): number {
  if (ctx.primaryType !== "aws_api_gateway_rest_api") {
    return 0;
  }
  if (!config.enabledKinds.has("api_gateway_vpc_links")) {
    return 0;
  }
  return apiGatewayVpcLinkLeftSpanPx(
    ctx.nodes,
    ctx.address,
    config.tiers.tier1W,
    config.gaps.satellite,
    ctx.plan,
  );
}

export function primaryHasLeftSideContent(
  config: ResolvedPrimaryLayoutConfig,
  ctx: SatelliteKindHeightContext,
): boolean {
  return primaryLeftMarginPx(config, ctx) > 0;
}

/** Minimum horizontal span for one primary cell so satellites are not clipped. */
export function topologyPrimaryCellFootprintPx(
  config: ResolvedPrimaryLayoutConfig,
  ctx: SatelliteKindHeightContext,
): number {
  const { tiers, gaps, padding } = config;
  const hasLeft = primaryBottomHasStartContent(config, ctx);
  const hasRight = primaryBottomHasEndContent(config, ctx);
  const leftSide = primaryLeftMarginPx(config, ctx);
  let w = tiers.tier0W + leftSide;
  if (hasLeft && hasRight) {
    w = Math.max(w, leftSide + tiers.tier1W * 2 + gaps.iamSgColumn);
  }

  const satCtx = buildSatelliteContext(
    ctx.nodes,
    ctx.address,
    ctx.arnIndex,
    ctx.plan,
  );
  const cwBuild = config.enabledKinds.has("cloudwatch_alarms")
    ? buildSatelliteClusterForKind("cloudwatch_alarms", satCtx)
    : { cluster: null };
  const cwCluster = cwBuild.cluster as {
    alarms?: string[];
    logGroups?: string[];
  } | null;
  const hasAlarm =
    config.enabledKinds.has("cloudwatch_alarms") &&
    Boolean(cwCluster?.alarms?.length);
  const hasLog =
    config.enabledKinds.has("cloudwatch_log_groups") &&
    Boolean(cwCluster?.logGroups?.length);
  if (hasAlarm && hasLog) {
    const cwSpan =
      padding.cloudwatchLeft +
      tiers.tier1W +
      gaps.cloudwatchColumn +
      tiers.tier1W +
      padding.cloudwatchRight;
    w = Math.max(w, cwSpan);
  }
  return w;
}

export function buildSatelliteKindHeightContext(
  nodes: TerraformPlanNodesMap,
  address: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
): SatelliteKindHeightContext {
  const node = nodes[address] as TerraformPlanGraphNode | undefined;
  const pr = getPrimaryResource(node);
  const primaryType =
    typeof pr?.type === "string"
      ? pr.type
      : getTerraformCardResourceType(address, pr);
  const config = getPrimaryLayoutConfig(primaryType);
  return {
    nodes,
    address,
    primaryType,
    arnIndex,
    plan,
    tiers: config.tiers,
    gaps: config.gaps,
  };
}

export function primaryCellFootprintForAddress(
  nodes: TerraformPlanNodesMap,
  address: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
): number {
  const node = nodes[address] as TerraformPlanGraphNode | undefined;
  const pr = getPrimaryResource(node);
  const primaryType =
    typeof pr?.type === "string"
      ? pr.type
      : getTerraformCardResourceType(address, pr);
  const config = getPrimaryLayoutConfig(primaryType);
  const ctx = buildSatelliteKindHeightContext(nodes, address, arnIndex, plan);
  return topologyPrimaryCellFootprintPx(config, ctx);
}

export function primaryVerticalMarginsForAddress(
  nodes: TerraformPlanNodesMap,
  address: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
): { top: number; bottom: number } {
  const node = nodes[address] as TerraformPlanGraphNode | undefined;
  const pr = getPrimaryResource(node);
  const primaryType =
    typeof pr?.type === "string"
      ? pr.type
      : getTerraformCardResourceType(address, pr);
  const config = getPrimaryLayoutConfig(primaryType);
  const ctx = buildSatelliteKindHeightContext(nodes, address, arnIndex, plan);
  const top = primaryTopMarginPx(config, ctx);
  const bottomStart = primaryBottomColumnMarginPx(
    config,
    ctx,
    "bottom",
    "start",
  );
  const bottomEnd = primaryBottomColumnMarginPx(config, ctx, "bottom", "end");
  return { top, bottom: Math.max(bottomStart, bottomEnd) };
}
