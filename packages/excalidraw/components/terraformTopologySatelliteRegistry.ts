/**
 * Registry: satellite kind catalog + per-primary layout attachments.
 */

import { albSatelliteStackHeightPx } from "./terraformTopologyAlbLinks";
import { buildAlbListenerTargetCluster } from "./terraformTopologyAlbLinks";
import {
  buildResourceCloudWatchCluster,
  cloudWatchSatelliteStackHeightPx,
} from "./terraformTopologyCloudWatchLinks";
import {
  buildEcsClusterCompanionCluster,
  buildEcsEc2CapacityCompanionCluster,
  buildEcsServiceCompanionCluster,
  ecsClusterSatelliteStackHeightPx,
  ecsEc2SatelliteStackHeightPx,
  ecsSatelliteStackHeightPx,
} from "./terraformTopologyEcsLinks";
import {
  buildPrimaryIamCluster,
  iamSatelliteStackHeightPx,
  type TopologyIamEdge,
} from "./terraformTopologyIamLinks";
import {
  apiGatewaySatelliteStackHeightPx,
  buildApiGatewayCompanionCluster,
  buildApiGatewayVpcLinkCluster,
} from "./terraformTopologyApiGatewayLinks";
import { buildTransitGatewayCompanionCluster } from "./terraformTopologyTransitGatewayLinks";
import { transitGatewaySatelliteStackHeightPx } from "./terraformTopologyTransitGatewayLinks";
import { sgSatelliteStackHeightPx } from "./terraformTopologySgLinks";
import { buildPrimarySgCluster } from "./terraformTopologySgLinks";
import {
  buildS3CompanionCluster,
  s3SatelliteStackHeightPx,
} from "./terraformTopologyS3Links";
import {
  buildSqsCompanionCluster,
  sqsSatelliteStackHeightPx,
} from "./terraformTopologySqsLinks";
import {
  auroraSatelliteStackHeightPx,
  buildAuroraCompanionCluster,
  buildRdsCompanionCluster,
  rdsSatelliteStackHeightPx,
} from "./terraformTopologyDatastoreLinks";

import { buildLambdaPermissionCluster } from "./terraformTopologyLambdaPermissionLinks";
import { getTerraformCardResourceType } from "./terraformResourceCardLabel";
import { getTopologyPrimaryLayoutJson } from "./terraformTopologyPrimaryLayoutLoader";

import {
  buildSatelliteClusterForKind,
  collectSatelliteAddressesForKind,
  getAllCatalogPluginIds,
  type SatelliteBuildContext,
} from "./terraformTopologySatelliteEngine";

import { installSatellitePlugins } from "./terraformTopologySatellitePlugins";

import type { ResolvedPrimaryLayoutConfig } from "./terraformTopologyPrimaryLayoutConfig";
import type { TopologySatelliteKind } from "./terraformTopologyPrimaryLayoutTypes";
import type { buildKmsKeyPolicyCluster } from "./terraformTopologyKmsLinks";

import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

export function assertAllCatalogPluginsRegistered(): void {
  installSatellitePlugins();
  const registered = new Set([
    "cloudwatch_resource",
    "iam_execution_role",
    "security_groups",
    "alb_companions",
    "ecs_companions",
    "ecs_cluster_companions",
    "ecs_ec2_capacity_companions",
    "api_gateway_companions",
    "api_gateway_vpc_links",
    "tgw_companions",
    "s3_companions",
    "sqs_companions",
    "aurora_companions",
    "rds_companions",
  ]);
  for (const id of getAllCatalogPluginIds()) {
    if (!registered.has(id)) {
      throw new Error(`Missing plugin registration for ${id}`);
    }
  }
}

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

function layoutAttachmentsForPrimary(
  primaryType: string,
): TopologySatelliteKind[] {
  return getTopologyPrimaryLayoutJson(primaryType).attachments;
}

export function enabledKindsForPrimaryType(
  primaryType: string,
): ReadonlySet<TopologySatelliteKind> {
  return new Set(layoutAttachmentsForPrimary(primaryType));
}

export function isKindEnabledForPrimary(
  primaryType: string,
  kind: TopologySatelliteKind,
): boolean {
  return enabledKindsForPrimaryType(primaryType).has(kind);
}

export function buildSatelliteContext(
  nodes: TerraformPlanNodesMap,
  primaryAddress: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
): SatelliteBuildContext {
  const node = nodes[primaryAddress] as TerraformPlanGraphNode | undefined;
  const pr = getPrimaryResource(node);
  const primaryType =
    typeof pr?.type === "string"
      ? pr.type
      : getTerraformCardResourceType(primaryAddress, pr);
  const planChanges = Array.isArray(
    (plan as { resource_changes?: unknown })?.resource_changes,
  )
    ? (plan as { resource_changes: Array<{ address?: string; type?: string }> })
        .resource_changes ?? []
    : undefined;
  return {
    nodes,
    primaryAddress,
    primaryType,
    arnIndex,
    plan,
    planChanges,
  };
}

export type TopologyPrimarySatelliteBundles = {
  primaryType: string;
  iam: ReturnType<typeof buildPrimaryIamCluster>;
  kms: ReturnType<typeof buildKmsKeyPolicyCluster>;
  sg: ReturnType<typeof buildPrimarySgCluster>;
  s3: ReturnType<typeof buildS3CompanionCluster>;
  alb: ReturnType<typeof buildAlbListenerTargetCluster>;
  ecs: ReturnType<typeof buildEcsServiceCompanionCluster>;
  ecsCluster: ReturnType<typeof buildEcsClusterCompanionCluster>;
  ecsEc2: ReturnType<typeof buildEcsEc2CapacityCompanionCluster>;
  api: ReturnType<typeof buildApiGatewayCompanionCluster>;
  apiVpc: ReturnType<typeof buildApiGatewayVpcLinkCluster>;
  tgw: ReturnType<typeof buildTransitGatewayCompanionCluster>;
  lambdaPermission: ReturnType<typeof buildLambdaPermissionCluster>;
  sqs: ReturnType<typeof buildSqsCompanionCluster>;
  aurora: ReturnType<typeof buildAuroraCompanionCluster>;
  rds: ReturnType<typeof buildRdsCompanionCluster>;
  cloudWatch: ReturnType<typeof buildResourceCloudWatchCluster>;
};

export function buildTopologyPrimarySatelliteBundles(
  nodes: TerraformPlanNodesMap,
  address: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
): TopologyPrimarySatelliteBundles {
  installSatellitePlugins();
  const ctx = buildSatelliteContext(nodes, address, arnIndex, plan);
  const { primaryType } = ctx;
  const enabled = enabledKindsForPrimaryType(primaryType);
  const empty = { cluster: null, edges: [] as TopologyIamEdge[] };

  return {
    primaryType,
    iam: enabled.has("iam")
      ? buildPrimaryIamCluster(nodes, address, arnIndex)
      : empty,
    kms: enabled.has("kms_policies")
      ? (buildSatelliteClusterForKind("kms_policies", ctx) as ReturnType<
          typeof buildKmsKeyPolicyCluster
        >)
      : empty,
    sg: enabled.has("security_groups")
      ? buildPrimarySgCluster(nodes, address, arnIndex, plan)
      : empty,
    s3: enabled.has("s3_companions")
      ? buildS3CompanionCluster(nodes, address, arnIndex)
      : empty,
    alb: enabled.has("alb_companions")
      ? buildAlbListenerTargetCluster(nodes, address, arnIndex)
      : empty,
    ecs: enabled.has("ecs_companions")
      ? buildEcsServiceCompanionCluster(nodes, address, arnIndex)
      : empty,
    ecsCluster: enabled.has("ecs_cluster_companions")
      ? buildEcsClusterCompanionCluster(nodes, address, plan)
      : empty,
    ecsEc2: enabled.has("ecs_ec2_capacity_companions")
      ? buildEcsEc2CapacityCompanionCluster(nodes, address, arnIndex, plan)
      : empty,
    api: enabled.has("api_gateway_companions")
      ? buildApiGatewayCompanionCluster(nodes, address, plan)
      : empty,
    apiVpc: enabled.has("api_gateway_vpc_links")
      ? buildApiGatewayVpcLinkCluster(nodes, address, plan)
      : empty,
    tgw:
      enabled.has("tgw_companions") && primaryType === "aws_ec2_transit_gateway"
        ? buildTransitGatewayCompanionCluster(nodes, address, ctx.planChanges)
        : empty,
    lambdaPermission: enabled.has("lambda_permission")
      ? buildLambdaPermissionCluster(nodes, address, arnIndex, plan)
      : empty,
    sqs: enabled.has("sqs_companions")
      ? buildSqsCompanionCluster(nodes, address, arnIndex)
      : empty,
    aurora: enabled.has("aurora_companions")
      ? buildAuroraCompanionCluster(nodes, address)
      : empty,
    rds: enabled.has("rds_companions")
      ? buildRdsCompanionCluster(nodes, address)
      : empty,
    cloudWatch:
      enabled.has("cloudwatch_alarms") || enabled.has("cloudwatch_log_groups")
        ? buildResourceCloudWatchCluster(nodes, address)
        : empty,
  };
}

export function satelliteStackHeightPxForKind(
  kind: TopologySatelliteKind,
  config: ResolvedPrimaryLayoutConfig,
  ctx: SatelliteBuildContext,
): number {
  if (!config.enabledKinds.has(kind)) {
    return 0;
  }

  const { nodes, primaryAddress, arnIndex, plan, primaryType } = ctx;
  const tier1H = config.tiers.tier1H;
  const tier2H = config.tiers.tier2H;
  const gap = config.gaps.satellite;

  switch (kind) {
    case "cloudwatch_alarms":
    case "cloudwatch_log_groups":
      return cloudWatchSatelliteStackHeightPx(
        nodes,
        primaryAddress,
        tier1H,
        gap,
      );
    case "iam":
      return iamSatelliteStackHeightPx(
        nodes,
        primaryAddress,
        arnIndex,
        tier1H,
        tier2H,
        gap,
        ctx.plan,
      );
    case "kms_policies": {
      installSatellitePlugins();
      const { cluster } = buildSatelliteClusterForKind("kms_policies", ctx);
      const policies =
        cluster &&
        typeof cluster === "object" &&
        cluster !== null &&
        "policies" in cluster &&
        Array.isArray((cluster as { policies: string[] }).policies)
          ? (cluster as { policies: string[] }).policies
          : [];
      return policies.length > 0 ? gap + policies.length * (tier1H + gap) : 0;
    }
    case "security_groups":
      return sgSatelliteStackHeightPx(
        nodes,
        primaryAddress,
        arnIndex,
        tier1H,
        tier2H,
        gap,
        plan,
      );
    case "s3_companions":
      return s3SatelliteStackHeightPx(
        nodes,
        primaryAddress,
        arnIndex,
        tier1H,
        tier2H,
        gap,
      );
    case "alb_companions":
      return albSatelliteStackHeightPx(
        nodes,
        primaryAddress,
        arnIndex,
        tier1H,
        tier2H,
        gap,
      );
    case "ecs_companions":
      return primaryType === "aws_ecs_service"
        ? ecsSatelliteStackHeightPx(
            nodes,
            primaryAddress,
            arnIndex,
            tier1H,
            tier2H,
            gap,
          )
        : 0;
    case "ecs_cluster_companions":
      return primaryType === "aws_ecs_service"
        ? ecsClusterSatelliteStackHeightPx(
            nodes,
            primaryAddress,
            tier1H,
            tier2H,
            gap,
            ctx.plan,
          )
        : 0;
    case "ecs_ec2_capacity_companions":
      return primaryType === "aws_ecs_service"
        ? ecsEc2SatelliteStackHeightPx(
            nodes,
            primaryAddress,
            arnIndex,
            tier1H,
            tier2H,
            gap,
            ctx.plan,
          )
        : 0;
    case "api_gateway_companions":
      return primaryType === "aws_api_gateway_rest_api"
        ? apiGatewaySatelliteStackHeightPx(
            nodes,
            primaryAddress,
            tier1H,
            tier2H,
            gap,
          )
        : 0;
    case "api_gateway_vpc_links":
      /** Left column; width handled by {@link primaryLeftMarginPx}. */
      return 0;
    case "tgw_companions":
      return primaryType === "aws_ec2_transit_gateway"
        ? transitGatewaySatelliteStackHeightPx(
            nodes,
            primaryAddress,
            tier1H,
            tier2H,
            gap,
            ctx.planChanges,
          )
        : 0;
    case "lambda_permission": {
      installSatellitePlugins();
      const { cluster } = buildSatelliteClusterForKind(
        "lambda_permission",
        ctx,
      );
      const stack =
        cluster &&
        typeof cluster === "object" &&
        cluster !== null &&
        "stack" in cluster &&
        Array.isArray((cluster as { stack: string[] }).stack)
          ? (cluster as { stack: string[] }).stack
          : [];
      if (stack.length === 0) {
        return 0;
      }
      return gap + stack.length * (tier2H + gap);
    }
    case "sqs_companions":
      return sqsSatelliteStackHeightPx(
        nodes,
        primaryAddress,
        arnIndex,
        tier1H,
        tier2H,
        gap,
      );
    case "aurora_companions":
      return primaryType === "aws_rds_cluster"
        ? auroraSatelliteStackHeightPx(
            nodes,
            primaryAddress,
            tier1H,
            tier2H,
            gap,
          )
        : 0;
    case "rds_companions":
      return primaryType === "aws_db_instance"
        ? rdsSatelliteStackHeightPx(
            nodes,
            primaryAddress,
            tier1H,
            tier2H,
            gap,
          )
        : 0;
    default:
      return 0;
  }
}

export function collectTopologySatelliteAddressesFromRegistry(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  primaryAddresses: readonly string[],
  plan?: unknown,
): Set<string> {
  installSatellitePlugins();
  const out = new Set<string>();

  for (const primaryAddress of primaryAddresses) {
    const ctx = buildSatelliteContext(nodes, primaryAddress, arnIndex, plan);
    const kinds = enabledKindsForPrimaryType(ctx.primaryType);

    for (const kind of kinds) {
      for (const addr of collectSatelliteAddressesForKind(
        kind,
        [primaryAddress],
        nodes,
        arnIndex,
        plan,
      )) {
        out.add(addr);
      }
    }
  }

  return out;
}

export function filterAddressesExcludingRegistrySatellites(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  addresses: readonly string[],
  plan?: unknown,
  precomputedSatelliteAddresses?: ReadonlySet<string>,
): string[] {
  const consumed =
    precomputedSatelliteAddresses ??
    (() => {
      const primaries = addresses.filter((addr) => {
        const node = nodes[addr] as TerraformPlanGraphNode | undefined;
        const pr = getPrimaryResource(node);
        const t = typeof pr?.type === "string" ? pr.type : "";
        return Boolean(t && !t.startsWith("data."));
      });
      return collectTopologySatelliteAddressesFromRegistry(
        nodes,
        arnIndex,
        primaries,
        plan,
      );
    })();
  return addresses.filter((a) => !consumed.has(a));
}
