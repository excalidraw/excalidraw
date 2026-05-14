import { describe, expect, it } from "vitest";

import {
  TERRAFORM_NETWORKING_VERTEX_TYPES,
  isTerraformNetworkingVertex,
  partitionDirectedEdgesByNetworking,
} from "./terraformNetworkingVertex";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

describe("terraformNetworkingVertex", () => {
  it("TERRAFORM_NETWORKING_VERTEX_TYPES includes core VPC primitives", () => {
    expect(TERRAFORM_NETWORKING_VERTEX_TYPES.has("aws_vpc")).toBe(true);
    expect(TERRAFORM_NETWORKING_VERTEX_TYPES.has("aws_subnet")).toBe(true);
    expect(TERRAFORM_NETWORKING_VERTEX_TYPES.has("aws_security_group")).toBe(
      true,
    );
  });

  it("isTerraformNetworkingVertex uses primary resource type on the node", () => {
    const nodes: TerraformPlanNodesMap = {
      "aws_vpc.main": {
        resources: {
          "aws_vpc.main": {
            address: "aws_vpc.main",
            type: "aws_vpc",
          },
        },
      },
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": {
            address: "aws_lambda_function.fn",
            type: "aws_lambda_function",
          },
        },
      },
    };
    expect(isTerraformNetworkingVertex(nodes, "aws_vpc.main")).toBe(true);
    expect(isTerraformNetworkingVertex(nodes, "aws_lambda_function.fn")).toBe(
      false,
    );
    expect(isTerraformNetworkingVertex(nodes, "missing")).toBe(false);
  });

  it("partitionDirectedEdgesByNetworking splits vpc↔subnet vs mixed edges", () => {
    const nodes: TerraformPlanNodesMap = {
      vpc: {
        resources: {
          vpc: { type: "aws_vpc", address: "aws_vpc.main" },
        },
      },
      sn: {
        resources: {
          sn: { type: "aws_subnet", address: "aws_subnet.a" },
        },
      },
      fn: {
        resources: {
          fn: { type: "aws_lambda_function", address: "aws_lambda_function.x" },
        },
      },
    };
    const edges = [
      { source: "vpc", target: "sn" },
      { source: "fn", target: "sn" },
    ];
    const { dependencyEdges, networkingDependencyEdges } =
      partitionDirectedEdgesByNetworking(nodes, edges);
    expect(networkingDependencyEdges).toEqual([
      { source: "vpc", target: "sn" },
    ]);
    expect(dependencyEdges).toEqual([{ source: "fn", target: "sn" }]);
  });
});
