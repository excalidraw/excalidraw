/**
 * Build satellite clusters for one topology primary (discovery layer output).
 */

import {
  buildTopologyPrimarySatelliteBundles,
  type TopologyPrimarySatelliteBundles,
} from "./terraformTopologySatelliteRegistry";

import type { TopologyIamEdge } from "./terraformTopologyIamLinks";

export type { TopologyPrimarySatelliteBundles };

export { buildTopologyPrimarySatelliteBundles };

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
    ...bundles.ecsCluster.edges,
    ...bundles.ecsEc2.edges,
    ...bundles.api.edges,
    ...bundles.apiVpc.edges,
    ...bundles.tgw.edges,
    ...bundles.lambdaPermission.edges,
    ...bundles.sqs.edges,
    ...bundles.cloudWatch.edges,
  ];
}
