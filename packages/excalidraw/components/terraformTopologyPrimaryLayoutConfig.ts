/**
 * Load per–primary-type JSON slot configs for semantic topology satellite placement.
 */

import defaultLayoutJson from "../assets/terraform-topology-primary-layouts/default.json";
import awsLambdaLayoutJson from "../assets/terraform-topology-primary-layouts/aws_lambda_function.json";
import awsEcsServiceLayoutJson from "../assets/terraform-topology-primary-layouts/aws_ecs_service.json";
import awsApiGatewayLayoutJson from "../assets/terraform-topology-primary-layouts/aws_api_gateway_rest_api.json";
import awsS3BucketLayoutJson from "../assets/terraform-topology-primary-layouts/aws_s3_bucket.json";
import awsTgwLayoutJson from "../assets/terraform-topology-primary-layouts/aws_ec2_transit_gateway.json";
import awsLbLayoutJson from "../assets/terraform-topology-primary-layouts/aws_lb.json";

import { tfComfortPx } from "./terraformLayoutComfort";
import {
  validateTopologyPrimaryLayoutJson,
  type ResolvedPrimaryLayoutConfig,
  type ResolvedTopologyTiers,
  type TopologyPrimaryLayoutJson,
  type TopologySatelliteKind,
} from "./terraformTopologyPrimaryLayoutTypes";

import { albSatelliteStackHeightPx } from "./terraformTopologyAlbLinks";
import {
  buildResourceCloudWatchCluster,
  cloudWatchSatelliteStackHeightPx,
} from "./terraformTopologyCloudWatchLinks";
import { ecsSatelliteStackHeightPx } from "./terraformTopologyEcsLinks";
import { iamSatelliteStackHeightPx } from "./terraformTopologyIamLinks";
import { kmsPolicySatelliteStackHeightPx } from "./terraformTopologyKmsLinks";
import { lambdaPermissionSatelliteStackHeightPx } from "./terraformTopologyLambdaPermissionLinks";
import { apiGatewaySatelliteStackHeightPx } from "./terraformTopologyApiGatewayLinks";
import { s3SatelliteStackHeightPx } from "./terraformTopologyS3Links";
import { sgSatelliteStackHeightPx } from "./terraformTopologySgLinks";
import { sqsSatelliteStackHeightPx } from "./terraformTopologySqsLinks";
import { transitGatewaySatelliteStackHeightPx } from "./terraformTopologyTransitGatewayLinks";

import { getTerraformCardResourceType } from "./terraformResourceCardLabel";

import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

export type { ResolvedPrimaryLayoutConfig, ResolvedTopologyTiers };

const RAW_LAYOUTS: TopologyPrimaryLayoutJson[] = [
  validateTopologyPrimaryLayoutJson(defaultLayoutJson),
  validateTopologyPrimaryLayoutJson(awsLambdaLayoutJson),
  validateTopologyPrimaryLayoutJson(awsEcsServiceLayoutJson),
  validateTopologyPrimaryLayoutJson(awsApiGatewayLayoutJson),
  validateTopologyPrimaryLayoutJson(awsS3BucketLayoutJson),
  validateTopologyPrimaryLayoutJson(awsTgwLayoutJson),
  validateTopologyPrimaryLayoutJson(awsLbLayoutJson),
];

const LAYOUT_BY_PRIMARY_TYPE = new Map<string, TopologyPrimaryLayoutJson>();
for (const layout of RAW_LAYOUTS) {
  LAYOUT_BY_PRIMARY_TYPE.set(layout.primaryType, layout);
}

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

const DEFAULT_RESOLVED = resolveConfig(LAYOUT_BY_PRIMARY_TYPE.get("default")!);

export function getRegisteredTopologyPrimaryLayoutTypes(): string[] {
  return [...LAYOUT_BY_PRIMARY_TYPE.keys()].sort();
}

export function getTopologyPrimaryLayoutJson(
  primaryType: string,
): TopologyPrimaryLayoutJson {
  return (
    LAYOUT_BY_PRIMARY_TYPE.get(primaryType) ??
    LAYOUT_BY_PRIMARY_TYPE.get("default")!
  );
}

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
  const { nodes, address, arnIndex, plan, tiers, gaps } = ctx;
  const tier1H = tiers.tier1H;
  const tier2H = tiers.tier2H;
  const gap = gaps.satellite;

  switch (kind) {
    case "cloudwatch_alarms":
    case "cloudwatch_log_groups":
      return cloudWatchSatelliteStackHeightPx(nodes, address, tier1H, gap);
    case "iam":
      return iamSatelliteStackHeightPx(
        nodes,
        address,
        arnIndex,
        tier1H,
        tier2H,
        gap,
      );
    case "kms_policies":
      return kmsPolicySatelliteStackHeightPx(
        nodes,
        address,
        arnIndex,
        tier1H,
        gap,
      );
    case "security_groups":
      return sgSatelliteStackHeightPx(
        nodes,
        address,
        arnIndex,
        tier1H,
        tier2H,
        gap,
        plan,
      );
    case "s3_companions":
      return s3SatelliteStackHeightPx(
        nodes,
        address,
        arnIndex,
        tier1H,
        tier2H,
        gap,
      );
    case "alb_companions":
      return albSatelliteStackHeightPx(
        nodes,
        address,
        arnIndex,
        tier1H,
        tier2H,
        gap,
      );
    case "ecs_companions":
      return ctx.primaryType === "aws_ecs_service"
        ? ecsSatelliteStackHeightPx(
            nodes,
            address,
            arnIndex,
            tier1H,
            tier2H,
            gap,
          )
        : 0;
    case "api_gateway_companions":
      return ctx.primaryType === "aws_api_gateway_rest_api"
        ? apiGatewaySatelliteStackHeightPx(nodes, address, tier1H, tier2H, gap)
        : 0;
    case "tgw_companions": {
      const planChanges = Array.isArray(
        (plan as { resource_changes?: unknown })?.resource_changes,
      )
        ? (plan as { resource_changes: Array<{ address?: string }> })
            .resource_changes ?? []
        : undefined;
      return ctx.primaryType === "aws_ec2_transit_gateway"
        ? transitGatewaySatelliteStackHeightPx(
            nodes,
            address,
            tier1H,
            tier2H,
            gap,
            planChanges,
          )
        : 0;
    }
    case "lambda_permission":
      return ctx.primaryType === "aws_lambda_function"
        ? lambdaPermissionSatelliteStackHeightPx(
            nodes,
            address,
            arnIndex,
            tier2H,
            gap,
          )
        : 0;
    case "sqs_companions":
      return sqsSatelliteStackHeightPx(
        nodes,
        address,
        arnIndex,
        tier1H,
        tier2H,
        gap,
      );
    default:
      return 0;
  }
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

/** Minimum horizontal span for one primary cell so satellites are not clipped. */
export function topologyPrimaryCellFootprintPx(
  config: ResolvedPrimaryLayoutConfig,
  ctx: SatelliteKindHeightContext,
): number {
  const { tiers, gaps, padding } = config;
  const hasLeft = primaryBottomHasStartContent(config, ctx);
  const hasRight = primaryBottomHasEndContent(config, ctx);
  let w = tiers.tier0W;
  if (hasLeft && hasRight) {
    w = Math.max(w, tiers.tier1W * 2 + gaps.iamSgColumn);
  }

  const cwBuild = buildResourceCloudWatchCluster(ctx.nodes, ctx.address);
  const hasAlarm = Boolean(cwBuild.cluster?.alarms.length);
  const hasLog = Boolean(cwBuild.cluster?.logGroups.length);
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

/** @internal tests */
export const __topologyPrimaryLayoutsForTest = RAW_LAYOUTS;
