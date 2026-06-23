/**
 * Plugin implementations for satellite kinds (loaded lazily to avoid import cycles).
 */

import { buildAlbListenerTargetCluster } from "./terraformTopologyAlbLinks";
import { buildResourceCloudWatchCluster } from "./terraformTopologyCloudWatchLinks";
import {
  buildEcsClusterCompanionCluster,
  buildEcsEc2CapacityCompanionCluster,
  buildEcsServiceCompanionCluster,
} from "./terraformTopologyEcsLinks";
import { buildPrimaryIamCluster } from "./terraformTopologyIamLinks";
import {
  buildApiGatewayCompanionCluster,
  buildApiGatewayVpcLinkCluster,
} from "./terraformTopologyApiGatewayLinks";
import { buildTransitGatewayCompanionCluster } from "./terraformTopologyTransitGatewayLinks";
import { buildPrimarySgCluster } from "./terraformTopologySgLinks";
import { buildS3CompanionCluster } from "./terraformTopologyS3Links";
import { buildSqsCompanionCluster } from "./terraformTopologySqsLinks";
import {
  buildAuroraCompanionCluster,
  buildRdsCompanionCluster,
} from "./terraformTopologyDatastoreLinks";
import { buildEksCompanionCluster } from "./terraformTopologyEksLinks";
import {
  registerSatellitePlugins,
  type SatelliteClusterBuildResult,
} from "./terraformTopologySatelliteEngine";

let installed = false;

function emptyResult(): SatelliteClusterBuildResult {
  return { cluster: null, edges: [] };
}

export function installSatellitePlugins(): void {
  if (installed) {
    return;
  }
  installed = true;

  registerSatellitePlugins({
    cloudwatch_resource: (_kind, ctx) =>
      buildResourceCloudWatchCluster(ctx.nodes, ctx.primaryAddress),

    iam_execution_role: (_kind, ctx) =>
      buildPrimaryIamCluster(
        ctx.nodes,
        ctx.primaryAddress,
        ctx.arnIndex,
        ctx.plan,
        ctx.nodesByType,
      ),

    security_groups: (_kind, ctx) =>
      buildPrimarySgCluster(
        ctx.nodes,
        ctx.primaryAddress,
        ctx.arnIndex,
        ctx.plan,
        ctx.nodesByType,
      ),

    alb_companions: (_kind, ctx) =>
      buildAlbListenerTargetCluster(
        ctx.nodes,
        ctx.primaryAddress,
        ctx.arnIndex,
        ctx.nodesByType,
      ),

    eks_companions: (_kind, ctx) =>
      buildEksCompanionCluster(ctx.nodes, ctx.primaryAddress, ctx.arnIndex),

    ecs_companions: (_kind, ctx) =>
      buildEcsServiceCompanionCluster(
        ctx.nodes,
        ctx.primaryAddress,
        ctx.arnIndex,
        ctx.nodesByType,
      ),

    ecs_cluster_companions: (_kind, ctx) =>
      buildEcsClusterCompanionCluster(
        ctx.nodes,
        ctx.primaryAddress,
        ctx.plan,
        ctx.nodesByType,
      ),

    ecs_ec2_capacity_companions: (_kind, ctx) =>
      buildEcsEc2CapacityCompanionCluster(
        ctx.nodes,
        ctx.primaryAddress,
        ctx.arnIndex,
        ctx.plan,
        ctx.nodesByType,
      ),

    api_gateway_companions: (_kind, ctx) =>
      buildApiGatewayCompanionCluster(ctx.nodes, ctx.primaryAddress, ctx.plan),

    api_gateway_vpc_links: (_kind, ctx) =>
      buildApiGatewayVpcLinkCluster(ctx.nodes, ctx.primaryAddress, ctx.plan),

    tgw_companions: (_kind, ctx) =>
      ctx.primaryType === "aws_ec2_transit_gateway"
        ? buildTransitGatewayCompanionCluster(
            ctx.nodes,
            ctx.primaryAddress,
            ctx.planChanges,
          )
        : emptyResult(),

    s3_companions: (_kind, ctx) =>
      buildS3CompanionCluster(
        ctx.nodes,
        ctx.primaryAddress,
        ctx.arnIndex,
        ctx.nodesByType,
      ),

    sqs_companions: (_kind, ctx) =>
      buildSqsCompanionCluster(
        ctx.nodes,
        ctx.primaryAddress,
        ctx.arnIndex,
        ctx.nodesByType,
      ),

    aurora_companions: (_kind, ctx) =>
      buildAuroraCompanionCluster(ctx.nodes, ctx.primaryAddress),

    rds_companions: (_kind, ctx) =>
      buildRdsCompanionCluster(ctx.nodes, ctx.primaryAddress),
  });
}
