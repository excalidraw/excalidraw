import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

/** Vertex types treated as “networking” for dependency-edge partitioning (VPC/SG/NACL/routing…). */
export const TERRAFORM_NETWORKING_VERTEX_TYPES = new Set([
  "aws_vpc",
  "aws_subnet",
  "aws_security_group",
  "aws_default_security_group",
  "aws_route_table",
  "aws_default_route_table",
  "aws_route_table_association",
  "aws_route",
  "aws_internet_gateway",
  "aws_egress_only_internet_gateway",
  "aws_nat_gateway",
  "aws_eip",
  "aws_eip_association",
  "aws_vpc_endpoint",
  "aws_network_acl",
  "aws_default_network_acl",
  "aws_network_acl_rule",
  "aws_ec2_transit_gateway",
  "aws_ec2_transit_gateway_vpc_attachment",
  "aws_ec2_transit_gateway_route_table",
  "aws_ec2_transit_gateway_route_table_association",
  "aws_ec2_transit_gateway_route_table_propagation",
  "aws_vpc_peering_connection",
  "aws_customer_gateway",
  "aws_vpn_gateway",
  "aws_vpn_gateway_attachment",
  "aws_vpn_connection",
]);

function vertexResourceType(node: TerraformPlanGraphNode | undefined): string {
  const resources = node?.resources || {};
  const withType = Object.values(resources).find(
    (r) => r && typeof r === "object" && (r as { type?: string }).type,
  ) as { type?: string } | undefined;
  return withType?.type || "";
}

/** True if this graph vertex’s primary resource type is a networking primitive. */
export function isTerraformNetworkingVertex(
  nodes: TerraformPlanNodesMap,
  vertexId: string,
): boolean {
  const node = nodes[vertexId];
  if (!node) {
    return false;
  }
  return TERRAFORM_NETWORKING_VERTEX_TYPES.has(
    vertexResourceType(node as TerraformPlanGraphNode),
  );
}

/** Split DOT dependency edges: both endpoints networking → networking layer; else dependency layer. */
export function partitionDirectedEdgesByNetworking<
  T extends { source: string; target: string },
>(
  nodes: TerraformPlanNodesMap,
  edges: readonly T[],
): {
  dependencyEdges: T[];
  networkingDependencyEdges: T[];
} {
  const dependencyEdges: T[] = [];
  const networkingDependencyEdges: T[] = [];
  for (const e of edges) {
    if (
      isTerraformNetworkingVertex(nodes, e.source) &&
      isTerraformNetworkingVertex(nodes, e.target)
    ) {
      networkingDependencyEdges.push(e);
    } else {
      dependencyEdges.push(e);
    }
  }
  return { dependencyEdges, networkingDependencyEdges };
}
