const { nodesToExcalidraw } = require("./excalidraw");

describe("nodesToExcalidraw Terraform edge layers", () => {
  it("renders resource labels as grouped text that can be restored with hidden resources", async () => {
    const scene = await nodesToExcalidraw({
      "aws_lambda_function.worker": {
        resources: {
          "aws_lambda_function.worker": {
            address: "aws_lambda_function.worker",
            type: "aws_lambda_function",
            name: "worker",
            change: { actions: ["create"], after: { function_name: "worker" } },
          },
        },
        edges_new: ["aws_iam_role.worker"],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_iam_role.worker": {
        resources: {
          "aws_iam_role.worker": {
            address: "aws_iam_role.worker",
            type: "aws_iam_role",
            name: "worker",
            change: { actions: ["create"], after: { name: "worker" } },
          },
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
    });

    const roleText = scene.elements.find(
      (element) =>
        element.type === "text" &&
        element.customData?.nodePath === "aws_iam_role.worker",
    );
    const roleRect = scene.elements.find(
      (element) =>
        element.type === "rectangle" &&
        element.customData?.nodePath === "aws_iam_role.worker",
    );

    expect(roleRect).toMatchObject({
      isDeleted: true,
      boundElements: expect.any(Array),
    });
    expect(roleText).toMatchObject({
      isDeleted: true,
      containerId: null,
      text: "aws_iam_role.worker",
      customData: {
        terraformVisibilityRole: "resource",
        terraformVisibilityKey: "aws_iam_role.worker",
      },
    });
    expect(roleText.groupIds[0]).toBe(roleRect.groupIds[0]);
  });

  it("renders dependency and data-flow arrows with layer metadata", async () => {
    const scene = await nodesToExcalidraw({
      "aws_api_gateway_rest_api.api": {
        resources: {
          "aws_api_gateway_rest_api.api": {
            address: "aws_api_gateway_rest_api.api",
            type: "aws_api_gateway_rest_api",
            name: "api",
            change: { actions: ["create"], after: { id: "api-id" } },
          },
        },
        edges_new: ["aws_lambda_function.handler"],
        edges_existing: [],
        edges_data_flow: [
          {
            target: "aws_lambda_function.handler",
            type: "invokes",
            label: "invokes",
            origin: "terraform_resource",
          },
        ],
      },
      "aws_lambda_function.handler": {
        resources: {
          "aws_lambda_function.handler": {
            address: "aws_lambda_function.handler",
            type: "aws_lambda_function",
            name: "handler",
            change: {
              actions: ["create"],
              after: { function_name: "handler" },
            },
          },
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
    });

    const dependencyArrow = scene.elements.find(
      (element) => element.customData?.terraformEdgeLayer === "dependency",
    );
    const dataFlowArrow = scene.elements.find(
      (element) => element.customData?.terraformEdgeLayer === "dataFlow",
    );

    expect(dependencyArrow).toMatchObject({
      type: "arrow",
      customData: {
        relationship: {
          type: "dependency",
        },
      },
    });
    expect(dataFlowArrow).toMatchObject({
      type: "arrow",
      strokeColor: "#0ca678",
      strokeWidth: 3,
      endArrowhead: "arrow",
      startBinding: {
        elementId: expect.any(String),
        mode: "orbit",
      },
      endBinding: {
        elementId: expect.any(String),
        mode: "orbit",
      },
      customData: {
        relationship: {
          type: "invokes",
          label: "invokes",
          origin: "terraform_resource",
        },
      },
    });
    expect(dataFlowArrow.startBinding.fixedPoint).not.toEqual(
      dependencyArrow.startBinding.fixedPoint,
    );
    expect(dataFlowArrow.endBinding.fixedPoint).not.toEqual(
      dependencyArrow.endBinding.fixedPoint,
    );
  });

  it("coalesces opposite data-flow directions into a bidirectional arrow", async () => {
    const scene = await nodesToExcalidraw({
      "aws_lambda_function.sync": {
        resources: {
          "aws_lambda_function.sync": {
            address: "aws_lambda_function.sync",
            type: "aws_lambda_function",
            name: "sync",
            change: {
              actions: ["create"],
              after: { function_name: "sync" },
            },
          },
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [
          {
            target: "aws_s3_bucket.assets",
            type: "writes",
            label: "writes",
            origin: "iam_policy",
          },
        ],
      },
      "aws_s3_bucket.assets": {
        resources: {
          "aws_s3_bucket.assets": {
            address: "aws_s3_bucket.assets",
            type: "aws_s3_bucket",
            name: "assets",
            change: {
              actions: ["create"],
              after: { bucket: "assets" },
            },
          },
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [
          {
            target: "aws_lambda_function.sync",
            type: "reads",
            label: "reads",
            origin: "iam_policy",
          },
        ],
      },
    });

    const dataFlowArrows = scene.elements.filter(
      (element) => element.customData?.terraformEdgeLayer === "dataFlow",
    );

    expect(dataFlowArrows).toHaveLength(1);
    expect(dataFlowArrows[0]).toMatchObject({
      startArrowhead: "arrow",
      endArrowhead: "arrow",
      customData: {
        relationship: {
          type: "bidirectional_data_flow",
          label: "writes / reads",
          bidirectional: true,
          directed: false,
        },
      },
    });
  });
});

describe("nodesToExcalidraw container facets", () => {
  it("adds generic facet metadata to group boxes and networking summaries for vpc/subnet", async () => {
    const scene = await nodesToExcalidraw({
      "aws_vpc.main": {
        resources: {
          "aws_vpc.main": {
            address: "aws_vpc.main",
            type: "aws_vpc",
            name: "main",
            change: { actions: ["create"], after: { id: "vpc-1234abcd" } },
          },
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_subnet.private": {
        resources: {
          "aws_subnet.private": {
            address: "aws_subnet.private",
            type: "aws_subnet",
            name: "private",
            change: {
              actions: ["create"],
              after: { id: "subnet-1234abcd", vpc_id: "vpc-1234abcd" },
            },
          },
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_route_table.private": {
        resources: {
          "aws_route_table.private": {
            address: "aws_route_table.private",
            type: "aws_route_table",
            name: "private",
            change: {
              actions: ["create"],
              after: { id: "rtb-1234abcd", vpc_id: "vpc-1234abcd" },
            },
          },
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_route.private_default": {
        resources: {
          "aws_route.private_default": {
            address: "aws_route.private_default",
            type: "aws_route",
            name: "private_default",
            change: {
              actions: ["create"],
              after: {
                route_table_id: "rtb-1234abcd",
                nat_gateway_id: "nat-1234abcd",
              },
            },
          },
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_route_table_association.private": {
        resources: {
          "aws_route_table_association.private": {
            address: "aws_route_table_association.private",
            type: "aws_route_table_association",
            name: "private",
            change: {
              actions: ["create"],
              after: {
                subnet_id: "subnet-1234abcd",
                route_table_id: "rtb-1234abcd",
              },
            },
          },
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_security_group.app": {
        resources: {
          "aws_security_group.app": {
            address: "aws_security_group.app",
            type: "aws_security_group",
            name: "app",
            change: {
              actions: ["create"],
              after: { id: "sg-abcd1234", vpc_id: "vpc-1234abcd" },
            },
          },
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
    });

    const vpcLabel = scene.elements.find(
      (element) => element.type === "text" && element.customData?.terraformVpcGroup,
    );
    const subnetLabel = scene.elements.find(
      (element) =>
        element.type === "text" && element.customData?.terraformSubnetGroup,
    );
    const accountBox = scene.elements.find(
      (element) =>
        element.type === "rectangle" && element.customData?.terraformAccountGroup,
    );
    const routeTableRect = scene.elements.find(
      (element) =>
        element.type === "rectangle" &&
        element.customData?.nodePath === "aws_route_table.private",
    );
    const routeApplianceRect = scene.elements.find(
      (element) =>
        element.type === "rectangle" &&
        element.customData?.terraformVpcAppliance === true &&
        element.customData?.terraformVpcApplianceKind === "route_table",
    );
    const sgRect = scene.elements.find(
      (element) =>
        element.type === "rectangle" &&
        element.customData?.nodePath === "aws_security_group.app",
    );

    expect(vpcLabel.customData.terraformContainerFacets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "networking-v2",
          sections: expect.arrayContaining([
            expect.objectContaining({
              label: "Route tables",
              sections: expect.any(Array),
            }),
          ]),
        }),
      ]),
    );
    expect(vpcLabel.text).toContain("rt:1");
    expect(vpcLabel.text).toContain("assoc:1");
    expect(vpcLabel.text).toContain("routes:1");

    expect(subnetLabel.customData.terraformContainerFacets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "networking-v2",
          sections: expect.arrayContaining([
            expect.objectContaining({ label: "VPC" }),
            expect.objectContaining({ label: "Route table associations" }),
          ]),
        }),
      ]),
    );
    expect(subnetLabel.text).toContain("rt_assoc:1");

    expect(accountBox.customData.terraformContainerFacets).toEqual([]);
    expect(routeTableRect.isDeleted).toBe(true);
    expect(sgRect).toBeDefined();
    expect(sgRect?.isDeleted).toBe(true);
    expect(routeApplianceRect).toBeDefined();
  });
});

describe("nodesToExcalidraw VPC perimeter layout", () => {
  it("omits dependency arrows for VPC endpoints and lists endpoints in VPC facets", async () => {
    const scene = await nodesToExcalidraw({
      "aws_vpc.main": {
        resources: {
          "aws_vpc.main": {
            address: "aws_vpc.main",
            type: "aws_vpc",
            name: "main",
            change: { actions: ["create"], after: { id: "vpc-1234abcd" } },
          },
        },
        edges_new: ["aws_subnet.private"],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_subnet.private": {
        resources: {
          "aws_subnet.private": {
            address: "aws_subnet.private",
            type: "aws_subnet",
            name: "private",
            change: {
              actions: ["create"],
              after: { id: "subnet-1234abcd", vpc_id: "vpc-1234abcd" },
            },
          },
        },
        edges_new: ["aws_vpc.main", "aws_lambda_function.worker"],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_lambda_function.worker": {
        resources: {
          "aws_lambda_function.worker": {
            address: "aws_lambda_function.worker",
            type: "aws_lambda_function",
            name: "worker",
            change: {
              actions: ["create"],
              after: { function_name: "worker" },
            },
          },
        },
        edges_new: ["aws_security_group.app"],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_security_group.app": {
        resources: {
          "aws_security_group.app": {
            address: "aws_security_group.app",
            type: "aws_security_group",
            name: "app",
            change: {
              actions: ["create"],
              after: { vpc_id: "vpc-1234abcd" },
            },
          },
        },
        edges_new: ["aws_vpc.main"],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_vpc_endpoint.s3": {
        resources: {
          "aws_vpc_endpoint.s3": {
            address: "aws_vpc_endpoint.s3",
            type: "aws_vpc_endpoint",
            name: "s3",
            change: {
              actions: ["create"],
              after: {
                vpc_id: "vpc-1234abcd",
                service_name: "com.amazonaws.s3",
                vpc_endpoint_type: "Interface",
              },
            },
          },
        },
        edges_new: ["aws_lambda_function.worker"],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_vpc_endpoint.logs": {
        resources: {
          "aws_vpc_endpoint.logs": {
            address: "aws_vpc_endpoint.logs",
            type: "aws_vpc_endpoint",
            name: "logs",
            change: {
              actions: ["create"],
              after: {
                vpc_id: "vpc-1234abcd",
                service_name: "com.amazonaws.logs",
                vpc_endpoint_type: "Interface",
              },
            },
          },
        },
        edges_new: ["aws_lambda_function.worker"],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_vpc_endpoint.sqs": {
        resources: {
          "aws_vpc_endpoint.sqs": {
            address: "aws_vpc_endpoint.sqs",
            type: "aws_vpc_endpoint",
            name: "sqs",
            change: {
              actions: ["create"],
              after: {
                vpc_id: "vpc-1234abcd",
                service_name: "com.amazonaws.sqs",
                vpc_endpoint_type: "Interface",
              },
            },
          },
        },
        edges_new: ["aws_lambda_function.worker"],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_vpc_endpoint.xray": {
        resources: {
          "aws_vpc_endpoint.xray": {
            address: "aws_vpc_endpoint.xray",
            type: "aws_vpc_endpoint",
            name: "xray",
            change: {
              actions: ["create"],
              after: {
                vpc_id: "vpc-1234abcd",
                service_name: "com.amazonaws.xray",
                vpc_endpoint_type: "Interface",
              },
            },
          },
        },
        edges_new: ["aws_lambda_function.worker"],
        edges_existing: [],
        edges_data_flow: [],
      },
    });

    const vpcLabel = scene.elements.find(
      (element) => element.type === "text" && element.customData?.terraformVpcGroup,
    );
    const endpointRect = scene.elements.find(
      (element) =>
        element.type === "rectangle" &&
        element.customData?.nodePath === "aws_vpc_endpoint.s3",
    );
    const vpcBox = scene.elements.find(
      (element) =>
        element.type === "rectangle" && element.customData?.terraformVpcGroup,
    );

    expect(vpcLabel?.customData?.terraformContainerFacets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "networking-v2",
          sections: expect.arrayContaining([
            expect.objectContaining({
              label: "VPC endpoints",
              sections: expect.arrayContaining([
                expect.objectContaining({
                  data: expect.objectContaining({
                    service_name: "com.amazonaws.s3",
                  }),
                }),
              ]),
            }),
          ]),
        }),
      ]),
    );

    expect(endpointRect).toBeDefined();
    expect(endpointRect?.customData?.terraformVpcAppliance).toBe(true);
    expect(endpointRect?.customData?.terraformVpcApplianceKind).toBe("endpoint");
    expect(endpointRect?.customData?.terraformVpcApplianceWall).toBe("bottomWall");
    expect(endpointRect?.strokeStyle).toBe("dotted");
    expect(vpcBox).toBeDefined();
    const endpointRects = scene.elements.filter(
      (element) =>
        element.type === "rectangle" &&
        String(element.customData?.nodePath || "").includes("aws_vpc_endpoint."),
    );
    expect(endpointRects.length).toBe(4);
    const L = vpcBox.x;
    const R = vpcBox.x + vpcBox.width;
    const T = vpcBox.y;
    const B = vpcBox.y + vpcBox.height;
    const tol = 3;
    for (const ep of endpointRects) {
      const overlapsInterior =
        ep.x + ep.width > L &&
        ep.x < R &&
        ep.y + ep.height > T &&
        ep.y < B;
      const extendsOutside =
        ep.x < L - tol ||
        ep.x + ep.width > R + tol ||
        ep.y < T - tol ||
        ep.y + ep.height > B + tol;
      expect(overlapsInterior && extendsOutside).toBe(true);
      const cornerMargin = Math.max(ep.width, ep.height) * 0.5 + 8;
      expect(ep.x + ep.width / 2).toBeGreaterThanOrEqual(L + cornerMargin - 1);
      expect(ep.x + ep.width / 2).toBeLessThanOrEqual(R - cornerMargin + 1);
    }

    const depArrows = scene.elements.filter(
      (element) => element.customData?.terraformEdgeLayer === "dependency",
    );
    const endpointDeps = depArrows.filter((arrow) => {
      const rel = arrow.customData?.relationship;
      return (
        rel?.source === "aws_vpc_endpoint.s3" ||
        rel?.target === "aws_vpc_endpoint.s3"
      );
    });
    expect(endpointDeps).toHaveLength(0);
  });

  it("classifies load balancers to leftWall or topWall from internal flag", async () => {
    const scene = await nodesToExcalidraw({
      "aws_vpc.main": {
        resources: {
          "aws_vpc.main": {
            address: "aws_vpc.main",
            type: "aws_vpc",
            name: "main",
            change: { actions: ["create"], after: { id: "vpc-1234abcd" } },
          },
        },
        edges_new: ["aws_subnet.private"],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_subnet.private": {
        resources: {
          "aws_subnet.private": {
            address: "aws_subnet.private",
            type: "aws_subnet",
            name: "private",
            change: {
              actions: ["create"],
              after: { id: "subnet-1234abcd", vpc_id: "vpc-1234abcd" },
            },
          },
        },
        edges_new: ["aws_vpc.main", "aws_lambda_function.worker"],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_lambda_function.worker": {
        resources: {
          "aws_lambda_function.worker": {
            address: "aws_lambda_function.worker",
            type: "aws_lambda_function",
            name: "worker",
            change: {
              actions: ["create"],
              after: { function_name: "worker" },
            },
          },
        },
        edges_new: ["aws_security_group.app"],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_security_group.app": {
        resources: {
          "aws_security_group.app": {
            address: "aws_security_group.app",
            type: "aws_security_group",
            name: "app",
            change: {
              actions: ["create"],
              after: { id: "sg-abcd", vpc_id: "vpc-1234abcd" },
            },
          },
        },
        edges_new: ["aws_vpc.main", "aws_lb.public", "aws_lb.internal"],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_lb.public": {
        resources: {
          "aws_lb.public": {
            address: "aws_lb.public",
            type: "aws_lb",
            name: "public",
            change: {
              actions: ["create"],
              after: {
                name: "public",
                internal: false,
                load_balancer_type: "application",
                subnets: ["subnet-1234abcd"],
              },
            },
          },
        },
        edges_new: ["aws_security_group.app"],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_lb.internal": {
        resources: {
          "aws_lb.internal": {
            address: "aws_lb.internal",
            type: "aws_lb",
            name: "internal",
            change: {
              actions: ["create"],
              after: {
                name: "internal",
                internal: true,
                load_balancer_type: "application",
                subnets: ["subnet-1234abcd"],
              },
            },
          },
        },
        edges_new: ["aws_security_group.app"],
        edges_existing: [],
        edges_data_flow: [],
      },
    });

    const publicLb = scene.elements.find(
      (e) =>
        e.type === "rectangle" && e.customData?.nodePath === "aws_lb.public",
    );
    const internalLb = scene.elements.find(
      (e) =>
        e.type === "rectangle" && e.customData?.nodePath === "aws_lb.internal",
    );
    expect(publicLb?.customData?.terraformVpcApplianceWall).toBe("leftWall");
    expect(publicLb?.customData?.terraformVpcApplianceKind).toBe("load_balancer");
    expect(internalLb?.customData?.terraformVpcApplianceWall).toBe("topWall");
  });
});
