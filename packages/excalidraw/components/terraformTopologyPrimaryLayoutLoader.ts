/**
 * Load per–primary-type JSON layout files (no satellite registry dependency).
 */

import defaultLayoutJson from "../assets/terraform-topology-primary-layouts/default.json";
import awsLambdaLayoutJson from "../assets/terraform-topology-primary-layouts/aws_lambda_function.json";
import awsEcsServiceLayoutJson from "../assets/terraform-topology-primary-layouts/aws_ecs_service.json";
import awsApiGatewayLayoutJson from "../assets/terraform-topology-primary-layouts/aws_api_gateway_rest_api.json";
import awsS3BucketLayoutJson from "../assets/terraform-topology-primary-layouts/aws_s3_bucket.json";
import awsTgwLayoutJson from "../assets/terraform-topology-primary-layouts/aws_ec2_transit_gateway.json";
import awsLbLayoutJson from "../assets/terraform-topology-primary-layouts/aws_lb.json";
import awsRdsClusterLayoutJson from "../assets/terraform-topology-primary-layouts/aws_rds_cluster.json";
import awsDbInstanceLayoutJson from "../assets/terraform-topology-primary-layouts/aws_db_instance.json";
import awsDynamodbTableLayoutJson from "../assets/terraform-topology-primary-layouts/aws_dynamodb_table.json";

import {
  validateTopologyPrimaryLayoutJson,
  type TopologyPrimaryLayoutJson,
} from "./terraformTopologyPrimaryLayoutTypes";

const RAW_LAYOUTS: TopologyPrimaryLayoutJson[] = [
  validateTopologyPrimaryLayoutJson(defaultLayoutJson),
  validateTopologyPrimaryLayoutJson(awsLambdaLayoutJson),
  validateTopologyPrimaryLayoutJson(awsEcsServiceLayoutJson),
  validateTopologyPrimaryLayoutJson(awsApiGatewayLayoutJson),
  validateTopologyPrimaryLayoutJson(awsS3BucketLayoutJson),
  validateTopologyPrimaryLayoutJson(awsTgwLayoutJson),
  validateTopologyPrimaryLayoutJson(awsLbLayoutJson),
  validateTopologyPrimaryLayoutJson(awsRdsClusterLayoutJson),
  validateTopologyPrimaryLayoutJson(awsDbInstanceLayoutJson),
  validateTopologyPrimaryLayoutJson(awsDynamodbTableLayoutJson),
];

const LAYOUT_BY_PRIMARY_TYPE = new Map<string, TopologyPrimaryLayoutJson>();
for (const layout of RAW_LAYOUTS) {
  LAYOUT_BY_PRIMARY_TYPE.set(layout.primaryType, layout);
}

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

/** @internal tests */
export const __topologyPrimaryLayoutsForTest = RAW_LAYOUTS;
