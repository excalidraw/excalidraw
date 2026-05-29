/**
 * Plugin implementations for satellite kinds (loaded lazily to avoid import cycles).
 */

import { buildAlbListenerTargetCluster } from "./terraformTopologyAlbLinks";
import { buildResourceCloudWatchCluster } from "./terraformTopologyCloudWatchLinks";
import { buildEcsServiceCompanionCluster } from "./terraformTopologyEcsLinks";
import { buildPrimaryIamCluster } from "./terraformTopologyIamLinks";
import { buildApiGatewayCompanionCluster } from "./terraformTopologyApiGatewayLinks";
import { buildTransitGatewayCompanionCluster } from "./terraformTopologyTransitGatewayLinks";
import { buildPrimarySgCluster } from "./terraformTopologySgLinks";
import { buildS3CompanionCluster } from "./terraformTopologyS3Links";
import { buildSqsCompanionCluster } from "./terraformTopologySqsLinks";
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
      buildPrimaryIamCluster(ctx.nodes, ctx.primaryAddress, ctx.arnIndex),

    security_groups: (_kind, ctx) =>
      buildPrimarySgCluster(
        ctx.nodes,
        ctx.primaryAddress,
        ctx.arnIndex,
        ctx.plan,
      ),

    alb_companions: (_kind, ctx) =>
      buildAlbListenerTargetCluster(
        ctx.nodes,
        ctx.primaryAddress,
        ctx.arnIndex,
      ),

    ecs_companions: (_kind, ctx) =>
      buildEcsServiceCompanionCluster(
        ctx.nodes,
        ctx.primaryAddress,
        ctx.arnIndex,
      ),

    api_gateway_companions: (_kind, ctx) =>
      buildApiGatewayCompanionCluster(ctx.nodes, ctx.primaryAddress),

    tgw_companions: (_kind, ctx) =>
      ctx.primaryType === "aws_ec2_transit_gateway"
        ? buildTransitGatewayCompanionCluster(
            ctx.nodes,
            ctx.primaryAddress,
            ctx.planChanges,
          )
        : emptyResult(),

    s3_companions: (_kind, ctx) =>
      buildS3CompanionCluster(ctx.nodes, ctx.primaryAddress, ctx.arnIndex),

    sqs_companions: (_kind, ctx) =>
      buildSqsCompanionCluster(ctx.nodes, ctx.primaryAddress, ctx.arnIndex),
  });
}
