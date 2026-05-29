/**
 * Build satellite clusters for one topology primary (discovery layer output).
 */

import { buildAlbListenerTargetCluster } from "./terraformTopologyAlbLinks";
import { buildResourceCloudWatchCluster } from "./terraformTopologyCloudWatchLinks";
import { buildEcsServiceCompanionCluster } from "./terraformTopologyEcsLinks";
import {
  buildPrimaryIamCluster,
  type TopologyIamEdge,
} from "./terraformTopologyIamLinks";
import { buildKmsKeyPolicyCluster } from "./terraformTopologyKmsLinks";
import { buildLambdaPermissionCluster } from "./terraformTopologyLambdaPermissionLinks";
import { buildApiGatewayCompanionCluster } from "./terraformTopologyApiGatewayLinks";
import { buildTransitGatewayCompanionCluster } from "./terraformTopologyTransitGatewayLinks";
import { buildS3CompanionCluster } from "./terraformTopologyS3Links";
import { buildPrimarySgCluster } from "./terraformTopologySgLinks";
import { buildSqsCompanionCluster } from "./terraformTopologySqsLinks";
import { getTerraformCardResourceType } from "./terraformResourceCardLabel";

import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

export type TopologyPrimarySatelliteBundles = {
  primaryType: string;
  iam: ReturnType<typeof buildPrimaryIamCluster>;
  kms: ReturnType<typeof buildKmsKeyPolicyCluster>;
  sg: ReturnType<typeof buildPrimarySgCluster>;
  s3: ReturnType<typeof buildS3CompanionCluster>;
  alb: ReturnType<typeof buildAlbListenerTargetCluster>;
  ecs: ReturnType<typeof buildEcsServiceCompanionCluster>;
  api: ReturnType<typeof buildApiGatewayCompanionCluster>;
  tgw: ReturnType<typeof buildTransitGatewayCompanionCluster>;
  lambdaPermission: ReturnType<typeof buildLambdaPermissionCluster>;
  sqs: ReturnType<typeof buildSqsCompanionCluster>;
  cloudWatch: ReturnType<typeof buildResourceCloudWatchCluster>;
};

export function buildTopologyPrimarySatelliteBundles(
  nodes: TerraformPlanNodesMap,
  address: string,
  arnIndex: Map<string, string>,
  plan?: unknown,
): TopologyPrimarySatelliteBundles {
  const node = nodes[address] as TerraformPlanGraphNode | undefined;
  const pr = getPrimaryResource(node);
  const primaryType =
    typeof pr?.type === "string"
      ? pr.type
      : getTerraformCardResourceType(address, pr);

  const planChanges = Array.isArray(
    (plan as { resource_changes?: unknown })?.resource_changes,
  )
    ? (plan as { resource_changes: Array<{ address?: string; type?: string }> })
        .resource_changes ?? []
    : undefined;

  const iam = buildPrimaryIamCluster(nodes, address, arnIndex);
  const kms = buildKmsKeyPolicyCluster(nodes, address, arnIndex);
  const sg = buildPrimarySgCluster(nodes, address, arnIndex, plan);
  const s3 = buildS3CompanionCluster(nodes, address, arnIndex);
  const alb = buildAlbListenerTargetCluster(nodes, address, arnIndex);
  const ecs = buildEcsServiceCompanionCluster(nodes, address, arnIndex);
  const api = buildApiGatewayCompanionCluster(nodes, address);
  const tgw =
    primaryType === "aws_ec2_transit_gateway"
      ? buildTransitGatewayCompanionCluster(nodes, address, planChanges)
      : { cluster: null, edges: [] as TopologyIamEdge[] };
  const lambdaPermission = buildLambdaPermissionCluster(
    nodes,
    address,
    arnIndex,
  );
  const sqs = buildSqsCompanionCluster(nodes, address, arnIndex);
  const cloudWatch = buildResourceCloudWatchCluster(nodes, address);

  return {
    primaryType,
    iam,
    kms,
    sg,
    s3,
    alb,
    ecs,
    api,
    tgw,
    lambdaPermission,
    sqs,
    cloudWatch,
  };
}

export function collectTopologySatelliteEdges(
  bundles: TopologyPrimarySatelliteBundles,
): TopologyIamEdge[] {
  return [
    ...bundles.iam.edges,
    ...bundles.kms.edges,
    ...bundles.sg.edges,
    ...bundles.s3.edges,
    ...bundles.alb.edges,
    ...bundles.ecs.edges,
    ...bundles.api.edges,
    ...bundles.tgw.edges,
    ...bundles.lambdaPermission.edges,
    ...bundles.sqs.edges,
    ...bundles.cloudWatch.edges,
  ];
}
