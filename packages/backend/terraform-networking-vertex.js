/**
 * Mirrors `packages/excalidraw/components/terraformNetworkingVertex.ts`:
 * partition DOT dependency edges whose endpoints are both networking primitives.
 */

const TERRAFORM_NETWORKING_VERTEX_TYPES = new Set([
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

function vertexResourceType(node) {
  const resources = node?.resources || {};
  const withType = Object.values(resources).find(
    (r) => r && typeof r === "object" && r.type,
  );
  return withType?.type || "";
}

function isTerraformNetworkingVertex(nodes, vertexId) {
  const node = nodes[vertexId];
  if (!node) {
    return false;
  }
  return TERRAFORM_NETWORKING_VERTEX_TYPES.has(vertexResourceType(node));
}

function partitionDirectedEdgesByNetworking(nodes, directedEdges) {
  const dependencyEdges = [];
  const networkingDependencyEdges = [];
  for (const e of directedEdges) {
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

module.exports = {
  TERRAFORM_NETWORKING_VERTEX_TYPES,
  isTerraformNetworkingVertex,
  partitionDirectedEdgesByNetworking,
};
