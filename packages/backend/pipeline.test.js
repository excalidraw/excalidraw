const {
  buildDataFlowEdges,
  buildNetworkingEdges,
  ensureEdgeLists,
  ensureTerraformModuleNodes,
  collectAllTerraformModulePaths,
  getModulePathChainFromAddress,
  buildNewEdges,
  refineCloudWatchMetricAlarmEdges,
  omitVpcPlumbingNodes,
  deleteOrphanedNodes,
  omitNonAllowlistedDataSourceNodes,
  omitStateOnlyDataSourceNodes,
  omitGhostIamPolicyDocumentNodes,
  getDataSourceTypeFromAddress,
  isExcludedDataSourceAddress,
  mergeTerraformState,
  pruneRedundantStructuralEdges,
} = require("./pipeline");

const resource = (address, type, name, values = {}, mode = "managed") => ({
  address,
  type,
  name,
  mode,
  values,
  change: { actions: ["create"], after: values },
});

describe("data source graph filtering", () => {
  it("parses data source type from module-qualified addresses", () => {
    expect(getDataSourceTypeFromAddress("data.aws_region.current")).toBe("aws_region");
    expect(
      getDataSourceTypeFromAddress("module.a.module.b.data.aws_iam_policy_document.x"),
    ).toBe("aws_iam_policy_document");
    expect(getDataSourceTypeFromAddress("aws_lambda_function.y")).toBeNull();
  });

  it("treats only non-allowlisted data addresses as excluded", () => {
    expect(isExcludedDataSourceAddress("data.aws_region.current")).toBe(true);
    expect(isExcludedDataSourceAddress("data.aws_iam_policy_document.main")).toBe(false);
  });

  it("omitNonAllowlistedDataSourceNodes removes data sources not on allowlist and strips edges", () => {
    let nodes = ensureEdgeLists({
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": resource(
            "aws_lambda_function.fn",
            "aws_lambda_function",
            "fn",
            {},
          ),
        },
        edges_new: ["data.aws_region.current"],
        edges_existing: [],
        edges_data_flow: [],
      },
      "data.aws_region.current": {
        resources: {
          "data.aws_region.current": resource(
            "data.aws_region.current",
            "aws_region",
            "current",
            {},
            "data",
          ),
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
      "data.aws_iam_policy_document.pol": {
        resources: {
          "data.aws_iam_policy_document.pol": resource(
            "data.aws_iam_policy_document.pol",
            "aws_iam_policy_document",
            "pol",
            {},
            "data",
          ),
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
    });

    nodes = omitNonAllowlistedDataSourceNodes(nodes);

    expect(nodes["data.aws_region.current"]).toBeUndefined();
    expect(nodes["data.aws_iam_policy_document.pol"]).toBeDefined();
    expect(nodes["aws_lambda_function.fn"].edges_new).toEqual([]);
  });

  it("buildNewEdges does not traverse through excluded data vertices in DOT", () => {
    const adjacency = {
      "aws_lambda_function.fn": ["data.aws_region.current"],
      "data.aws_region.current": ["aws_vpc.main"],
      "aws_vpc.main": [],
    };

    let nodes = ensureEdgeLists({
      "aws_lambda_function.fn": { resources: {} },
      "aws_vpc.main": { resources: {} },
    });
    nodes = ensureTerraformModuleNodes(nodes);
    buildNewEdges(nodes, adjacency);

    expect(nodes["aws_lambda_function.fn"].edges_new).toEqual([]);
  });

  it("buildNewEdges still connects allowlisted data.aws_iam_policy_document neighbors", () => {
    const adjacency = {
      "aws_iam_role.r": ["data.aws_iam_policy_document.assume"],
      "data.aws_iam_policy_document.assume": [],
    };

    let nodes = ensureEdgeLists({
      "aws_iam_role.r": { resources: {} },
      "data.aws_iam_policy_document.assume": {
        resources: {
          "data.aws_iam_policy_document.assume": resource(
            "data.aws_iam_policy_document.assume",
            "aws_iam_policy_document",
            "assume",
            {},
            "data",
          ),
        },
      },
    });
    nodes = ensureTerraformModuleNodes(nodes);
    buildNewEdges(nodes, adjacency);

    expect(nodes["aws_iam_role.r"].edges_new).toEqual([
      "data.aws_iam_policy_document.assume",
    ]);
  });

  it("mergeTerraformState skips non-allowlisted data resources and dependency edges to them", () => {
    let nodes = ensureEdgeLists({
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": resource(
            "aws_lambda_function.fn",
            "aws_lambda_function",
            "fn",
            {},
          ),
        },
        edges_existing: [],
      },
    });

    mergeTerraformState(nodes, {
      resources: [
        {
          mode: "data",
          type: "aws_region",
          name: "current",
          provider: "provider.aws",
          instances: [
            {
              attributes: {},
              dependencies: [],
            },
          ],
        },
        {
          mode: "managed",
          type: "aws_lambda_function",
          name: "fn",
          provider: "provider.aws",
          instances: [
            {
              attributes: {},
              dependencies: ["data.aws_region.current"],
            },
          ],
        },
      ],
    });

    expect(nodes["data.aws_region.current"]).toBeUndefined();
    expect(nodes["aws_lambda_function.fn"].edges_existing || []).toEqual([]);
  });
});

describe("omitGhostIamPolicyDocumentNodes", () => {
  it("removes config-only IAM policy-document placeholders and strips references", () => {
    let nodes = ensureEdgeLists({
      "module.lambda-monitoring.aws_iam_role_policy.logs[0]": {
        resources: {
          "module.lambda-monitoring.aws_iam_role_policy.logs[0]": resource(
            "module.lambda-monitoring.aws_iam_role_policy.logs[0]",
            "aws_iam_role_policy",
            "logs",
            {},
          ),
        },
        edges_new: ["module.lambda-monitoring.data.aws_iam_policy_document.logs"],
        edges_existing: ["module.lambda-monitoring.data.aws_iam_policy_document.logs"],
        edges_data_flow: [
          {
            target: "module.lambda-monitoring.data.aws_iam_policy_document.logs",
            relation: "policy",
          },
        ],
      },
      "module.lambda-monitoring.data.aws_iam_policy_document.logs": {
        resources: {
          "module.lambda-monitoring.data.aws_iam_policy_document.logs": {
            address: "module.lambda-monitoring.data.aws_iam_policy_document.logs",
            type: "module.lambda-monitoring.data.aws_iam_policy_document.logs",
            change: { actions: ["external"] },
          },
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
    });

    nodes = omitGhostIamPolicyDocumentNodes(nodes);

    expect(nodes["module.lambda-monitoring.data.aws_iam_policy_document.logs"]).toBeUndefined();
    expect(nodes["module.lambda-monitoring.aws_iam_role_policy.logs[0]"].edges_new).toEqual([]);
    expect(nodes["module.lambda-monitoring.aws_iam_role_policy.logs[0]"].edges_existing).toEqual(
      [],
    );
    expect(
      nodes["module.lambda-monitoring.aws_iam_role_policy.logs[0]"].edges_data_flow,
    ).toEqual([]);
  });

  it("keeps concrete IAM policy-document instances", () => {
    let nodes = ensureEdgeLists({
      "module.lambda-writer.data.aws_iam_policy_document.logs[0]": {
        resources: {
          "module.lambda-writer.data.aws_iam_policy_document.logs[0]": resource(
            "module.lambda-writer.data.aws_iam_policy_document.logs[0]",
            "aws_iam_policy_document",
            "logs",
            {
              json: "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\"}]}",
            },
            "data",
          ),
        },
      },
    });

    nodes = omitGhostIamPolicyDocumentNodes(nodes);

    expect(nodes["module.lambda-writer.data.aws_iam_policy_document.logs[0]"]).toBeDefined();
  });

  it("removes indexed IAM policy-document nodes when they have no concrete payload", () => {
    let nodes = ensureEdgeLists({
      "module.lambda-monitoring.data.aws_iam_policy_document.logs[0]": {
        resources: {
          "module.lambda-monitoring.data.aws_iam_policy_document.logs[0]": {
            address: "module.lambda-monitoring.data.aws_iam_policy_document.logs[0]",
            mode: "data",
            type: "aws_iam_policy_document",
            name: "logs",
            values: {},
            change: { actions: ["read"], after: null },
          },
        },
      },
      "module.lambda-monitoring.aws_iam_role_policy.logs[0]": {
        resources: {
          "module.lambda-monitoring.aws_iam_role_policy.logs[0]": resource(
            "module.lambda-monitoring.aws_iam_role_policy.logs[0]",
            "aws_iam_role_policy",
            "logs",
            {},
          ),
        },
        edges_new: ["module.lambda-monitoring.data.aws_iam_policy_document.logs[0]"],
        edges_existing: ["module.lambda-monitoring.data.aws_iam_policy_document.logs[0]"],
      },
    });

    nodes = omitGhostIamPolicyDocumentNodes(nodes);

    expect(
      nodes["module.lambda-monitoring.data.aws_iam_policy_document.logs[0]"],
    ).toBeUndefined();
    expect(nodes["module.lambda-monitoring.aws_iam_role_policy.logs[0]"].edges_new).toEqual([]);
    expect(nodes["module.lambda-monitoring.aws_iam_role_policy.logs[0]"].edges_existing).toEqual(
      [],
    );
  });

  it("does not remove non policy-document data sources", () => {
    let nodes = ensureEdgeLists({
      "data.aws_region.current": {
        resources: {
          "data.aws_region.current": resource(
            "data.aws_region.current",
            "aws_region",
            "current",
            {},
            "data",
          ),
        },
      },
    });

    nodes = omitGhostIamPolicyDocumentNodes(nodes);

    expect(nodes["data.aws_region.current"]).toBeDefined();
  });
});

describe("omitStateOnlyDataSourceNodes", () => {
  it("removes data nodes that exist only from tfstate merge", () => {
    let nodes = ensureEdgeLists({
      "module.lambda-monitoring.aws_iam_role_policy.logs[0]": {
        resources: {
          "module.lambda-monitoring.aws_iam_role_policy.logs[0]": resource(
            "module.lambda-monitoring.aws_iam_role_policy.logs[0]",
            "aws_iam_role_policy",
            "logs",
            {},
          ),
        },
        edges_existing: ["module.lambda-monitoring.data.aws_iam_policy_document.logs[0]"],
      },
      "module.lambda-monitoring.data.aws_iam_policy_document.logs[0]": {
        resources: {
          "module.lambda-monitoring.data.aws_iam_policy_document.logs[0]": {
            address: "module.lambda-monitoring.data.aws_iam_policy_document.logs[0]",
            mode: "data",
            type: "aws_iam_policy_document",
            name: "logs",
            values: { json: "{\"Version\":\"2012-10-17\"}" },
            change: { actions: ["existing"] },
          },
        },
      },
    });

    nodes = omitStateOnlyDataSourceNodes(nodes);

    expect(
      nodes["module.lambda-monitoring.data.aws_iam_policy_document.logs[0]"],
    ).toBeUndefined();
    expect(nodes["module.lambda-monitoring.aws_iam_role_policy.logs[0]"].edges_existing).toEqual(
      [],
    );
  });

  it("keeps plan-backed data nodes even if state is also merged", () => {
    let nodes = ensureEdgeLists({
      "data.aws_iam_policy_document.assume[0]": {
        resources: {
          "data.aws_iam_policy_document.assume[0]": {
            address: "data.aws_iam_policy_document.assume[0]",
            mode: "data",
            type: "aws_iam_policy_document",
            name: "assume",
            values: { json: "{\"Version\":\"2012-10-17\"}" },
            change: { actions: ["read"], after: { statement: [{ effect: "Allow" }] } },
          },
        },
      },
    });

    nodes = omitStateOnlyDataSourceNodes(nodes);

    expect(nodes["data.aws_iam_policy_document.assume[0]"]).toBeDefined();
  });
});

describe("omitVpcPlumbingNodes", () => {
  it("removes VPC plumbing nodes and strips references while retaining SG / NACL-class nodes", () => {
    let nodes = ensureEdgeLists({
      "aws_vpc.main": {
        resources: {
          "aws_vpc.main": resource("aws_vpc.main", "aws_vpc", "main", {
            id: "vpc-aaaa",
          }),
        },
        edges_new: ["aws_route_table.rt", "aws_security_group.sg"],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_route_table.rt": {
        resources: {
          "aws_route_table.rt": resource("aws_route_table.rt", "aws_route_table", "rt", {
            id: "rtb-1",
            vpc_id: "vpc-aaaa",
          }),
        },
        edges_new: ["aws_vpc.main"],
        edges_existing: [],
        edges_data_flow: [],
      },
      "aws_security_group.sg": {
        resources: {
          "aws_security_group.sg": resource(
            "aws_security_group.sg",
            "aws_security_group",
            "sg",
            { vpc_id: "vpc-aaaa" },
          ),
        },
        edges_new: ["aws_vpc.main"],
        edges_existing: [],
        edges_data_flow: [],
      },
    });

    nodes = omitVpcPlumbingNodes(nodes);

    expect(nodes["aws_route_table.rt"]).toBeUndefined();
    expect(nodes["aws_security_group.sg"]).toBeDefined();
    expect(nodes["aws_vpc.main"].edges_new).toEqual(["aws_security_group.sg"]);
    expect(nodes["aws_security_group.sg"].edges_new).toEqual(["aws_vpc.main"]);
  });
});

describe("deleteOrphanedNodes", () => {
  it("preserves __-prefixed metadata keys on the graph object", () => {
    const nodes = {
      __networkingFacetStore: { byVpcKey: {}, bySubnetKey: {} },
      a: {
        resources: {},
        edges_new: ["b"],
        edges_existing: [],
        edges_data_flow: [],
      },
      b: {
        resources: {},
        edges_new: ["a"],
        edges_existing: [],
        edges_data_flow: [],
      },
    };
    const out = deleteOrphanedNodes(nodes);
    expect(out.__networkingFacetStore).toEqual(nodes.__networkingFacetStore);
    expect(out.a).toBeDefined();
    expect(out.b).toBeDefined();
  });
});

const buildNodes = (resources) => {
  const nodes = {};
  for (const item of resources) {
    nodes[item.address] = {
      resources: {
        [item.address]: item,
      },
    };
  }
  return ensureEdgeLists(nodes);
};

const dataFlowTargets = (nodes, source) =>
  (nodes[source].edges_data_flow || []).map((edge) => ({
    target: edge.target,
    type: edge.type,
    origin: edge.origin,
  }));

const networkingTargets = (nodes, source) =>
  (nodes[source].edges_networking || []).map((edge) => ({
    target: edge.target,
    type: edge.type,
    origin: edge.origin,
  }));

describe("terraform module graph nodes", () => {
  it("collects nested module prefixes from addresses", () => {
    expect(
      getModulePathChainFromAddress("module.a.module.b.aws_lambda_function.this"),
    ).toEqual(["module.a", "module.a.module.b"]);
    expect(
      [...collectAllTerraformModulePaths(["module.x.aws_s3_bucket.y", "aws_vpc.z"])].sort(),
    ).toEqual(["module.x"]);
  });

  it("buildNewEdges stops at module boundaries instead of fanning out", () => {
    const adjacency = {
      root_alarm: ["module.app"],
      "module.app": ["module.app.aws_lambda_function.a", "module.app.aws_iam_role.b"],
      "module.app.aws_lambda_function.a": [],
      "module.app.aws_iam_role.b": [],
    };

    let nodes = ensureEdgeLists({
      root_alarm: { resources: {} },
      "module.app.aws_lambda_function.a": { resources: {} },
      "module.app.aws_iam_role.b": { resources: {} },
    });
    nodes = ensureTerraformModuleNodes(nodes);
    buildNewEdges(nodes, adjacency);

    expect(nodes.root_alarm.edges_new.sort()).toEqual(["module.app"]);
  });

  it("buildNewEdges uses stripped DOT keys for indexed for_each resource addresses", () => {
    const adjacency = {
      "module.m.aws_vpc_endpoint.this": ["peer.a", "peer.b"],
      "peer.a": [],
      "peer.b": [],
    };

    let nodes = ensureEdgeLists({
      'module.m.aws_vpc_endpoint.this["logs"]': { resources: {} },
      "peer.a": { resources: {} },
      "peer.b": { resources: {} },
    });
    nodes = ensureTerraformModuleNodes(nodes);
    buildNewEdges(nodes, adjacency);

    expect(nodes['module.m.aws_vpc_endpoint.this["logs"]'].edges_new.sort()).toEqual([
      "peer.a",
      "peer.b",
    ]);
  });

  it("refineCloudWatchMetricAlarmEdges replaces fan-out with resolved references and owning modules", () => {
    let nodes = ensureEdgeLists({
      "aws_cloudwatch_metric_alarm.lambda_errors": {
        resources: {
          "aws_cloudwatch_metric_alarm.lambda_errors": {
            type: "aws_cloudwatch_metric_alarm",
            address: "aws_cloudwatch_metric_alarm.lambda_errors",
            change: {
              actions: ["create"],
              after: {
                namespace: "AWS/Lambda",
                dimensions: { FunctionName: "test-writer" },
              },
            },
          },
        },
        edges_new: [
          "module.lambda-writer.aws_lambda_function.main",
          "aws_vpc.lambda",
          "aws_s3_bucket.data",
        ],
        edges_existing: ["module.lambda-writer.aws_iam_role.x", "aws_kms_key.s3"],
      },
      "module.lambda-writer.aws_lambda_function.main": {
        resources: {
          "module.lambda-writer.aws_lambda_function.main": {
            type: "aws_lambda_function",
            address: "module.lambda-writer.aws_lambda_function.main",
            change: { after: { function_name: "test-writer" } },
          },
        },
      },
      "module.lambda-writer": {
        resources: {
          "module.lambda-writer": {
            type: "terraform_module",
            address: "module.lambda-writer",
            change: { actions: ["no-op"] },
          },
        },
      },
      "aws_vpc.lambda": {
        resources: {
          "aws_vpc.lambda": {
            type: "aws_vpc",
            address: "aws_vpc.lambda",
            change: { after: {} },
          },
        },
      },
    });

    nodes = ensureTerraformModuleNodes(nodes);
    refineCloudWatchMetricAlarmEdges(nodes);

    expect(nodes["aws_cloudwatch_metric_alarm.lambda_errors"].edges_new.sort()).toEqual([
      "module.lambda-writer.aws_lambda_function.main",
      "module.lambda-writer",
    ].sort());
    expect(nodes["aws_cloudwatch_metric_alarm.lambda_errors"].edges_existing.sort()).toEqual([
      "module.lambda-writer.aws_lambda_function.main",
      "module.lambda-writer",
    ].sort());
  });

  it("supports custom resolvers overriding defaults", () => {
    let nodes = ensureEdgeLists({
      "aws_cloudwatch_metric_alarm.lambda_errors": {
        resources: {
          "aws_cloudwatch_metric_alarm.lambda_errors": {
            type: "aws_cloudwatch_metric_alarm",
            address: "aws_cloudwatch_metric_alarm.lambda_errors",
            change: {
              actions: ["create"],
              after: {
                namespace: "AWS/Lambda",
                dimensions: { FunctionName: "test-writer" },
              },
            },
          },
        },
        edges_new: ["aws_vpc.lambda"],
        edges_existing: ["aws_kms_key.s3"],
      },
      "module.lambda-writer.aws_lambda_function.main": {
        resources: {
          "module.lambda-writer.aws_lambda_function.main": {
            type: "aws_lambda_function",
            address: "module.lambda-writer.aws_lambda_function.main",
            change: { after: { function_name: "test-writer" } },
          },
        },
      },
      "module.lambda-writer": {
        resources: {
          "module.lambda-writer": {
            type: "terraform_module",
            address: "module.lambda-writer",
            change: { actions: ["no-op"] },
          },
        },
      },
    });

    nodes = ensureTerraformModuleNodes(nodes);
    refineCloudWatchMetricAlarmEdges(nodes, {
      customResolvers: [
        {
          id: "test-override",
          match(nodePath) {
            return nodePath === "aws_cloudwatch_metric_alarm.lambda_errors";
          },
          resolve() {
            return {
              policy: "replace",
              targets: ["module.lambda-writer"],
            };
          },
        },
      ],
    });

    expect(nodes["aws_cloudwatch_metric_alarm.lambda_errors"].edges_new).toEqual([
      "module.lambda-writer",
    ]);
    expect(nodes["aws_cloudwatch_metric_alarm.lambda_errors"].edges_existing).toEqual([
      "module.lambda-writer",
    ]);
  });

  it("refines non-alarm resources generically from value references", () => {
    let nodes = ensureEdgeLists({
      "aws_lambda_permission.allow_s3": {
        resources: {
          "aws_lambda_permission.allow_s3": {
            type: "aws_lambda_permission",
            address: "aws_lambda_permission.allow_s3",
            change: {
              actions: ["create"],
              after: {
                function_name: "processor",
                source_arn: "arn:aws:s3:::assets",
              },
            },
          },
        },
        edges_new: ["aws_kms_key.noisy"],
        edges_existing: ["aws_iam_policy.noisy"],
      },
      "module.lambda.aws_lambda_function.processor": {
        resources: {
          "module.lambda.aws_lambda_function.processor": {
            type: "aws_lambda_function",
            address: "module.lambda.aws_lambda_function.processor",
            change: { after: { function_name: "processor" } },
          },
        },
      },
      "module.lambda": {
        resources: {
          "module.lambda": {
            type: "terraform_module",
            address: "module.lambda",
            change: { actions: ["no-op"] },
          },
        },
      },
      "aws_s3_bucket.assets": {
        resources: {
          "aws_s3_bucket.assets": {
            type: "aws_s3_bucket",
            address: "aws_s3_bucket.assets",
            change: { after: { arn: "arn:aws:s3:::assets", bucket: "assets" } },
          },
        },
      },
    });

    nodes = ensureTerraformModuleNodes(nodes);
    refineCloudWatchMetricAlarmEdges(nodes);

    expect(nodes["aws_lambda_permission.allow_s3"].edges_new.sort()).toEqual([
      "module.lambda.aws_lambda_function.processor",
      "module.lambda",
      "aws_s3_bucket.assets",
    ].sort());
    expect(nodes["aws_lambda_permission.allow_s3"].edges_existing.sort()).toEqual([
      "module.lambda.aws_lambda_function.processor",
      "module.lambda",
      "aws_s3_bucket.assets",
    ].sort());
  });

  it("uses key-aware matching so FunctionName does not resolve to IAM role names", () => {
    let nodes = ensureEdgeLists({
      "aws_cloudwatch_metric_alarm.lambda_errors": {
        resources: {
          "aws_cloudwatch_metric_alarm.lambda_errors": {
            type: "aws_cloudwatch_metric_alarm",
            address: "aws_cloudwatch_metric_alarm.lambda_errors",
            change: {
              actions: ["create"],
              after: {
                namespace: "AWS/Lambda",
                dimensions: { FunctionName: "test-writer" },
              },
            },
          },
        },
        edges_new: [],
        edges_existing: [],
      },
      "module.lambda-writer.aws_lambda_function.main": {
        resources: {
          "module.lambda-writer.aws_lambda_function.main": {
            type: "aws_lambda_function",
            address: "module.lambda-writer.aws_lambda_function.main",
            change: { after: { function_name: "test-writer" } },
          },
        },
      },
      "module.lambda-writer.aws_iam_role.lambda": {
        resources: {
          "module.lambda-writer.aws_iam_role.lambda": {
            type: "aws_iam_role",
            address: "module.lambda-writer.aws_iam_role.lambda",
            change: { after: { name: "test-writer" } },
          },
        },
      },
      "module.lambda-writer": {
        resources: {
          "module.lambda-writer": {
            type: "terraform_module",
            address: "module.lambda-writer",
            change: { actions: ["no-op"] },
          },
        },
      },
    });

    nodes = ensureTerraformModuleNodes(nodes);
    refineCloudWatchMetricAlarmEdges(nodes);

    expect(nodes["aws_cloudwatch_metric_alarm.lambda_errors"].edges_new.sort()).toEqual([
      "module.lambda-writer.aws_lambda_function.main",
      "module.lambda-writer",
    ].sort());
    expect(
      nodes["aws_cloudwatch_metric_alarm.lambda_errors"].edges_new,
    ).not.toContain("module.lambda-writer.aws_iam_role.lambda");
  });

  it("ignores collision-prone generic id scalars to avoid cross-module policy-doc links", () => {
    let nodes = ensureEdgeLists({
      "module.s3_kms.data.aws_iam_policy_document.this[0]": {
        resources: {
          "module.s3_kms.data.aws_iam_policy_document.this[0]": {
            type: "aws_iam_policy_document",
            address: "module.s3_kms.data.aws_iam_policy_document.this[0]",
            mode: "data",
            change: { after: { id: "2681806354" } },
          },
        },
      },
      "module.sqs_kms.data.aws_iam_policy_document.this[0]": {
        resources: {
          "module.sqs_kms.data.aws_iam_policy_document.this[0]": {
            type: "aws_iam_policy_document",
            address: "module.sqs_kms.data.aws_iam_policy_document.this[0]",
            mode: "data",
            change: { after: { id: "2681806354" } },
          },
        },
      },
    });

    nodes = ensureTerraformModuleNodes(nodes);
    refineCloudWatchMetricAlarmEdges(nodes);

    expect(nodes["module.s3_kms.data.aws_iam_policy_document.this[0]"].edges_new).toEqual(
      [],
    );
    expect(
      nodes["module.s3_kms.data.aws_iam_policy_document.this[0]"].edges_new,
    ).not.toContain("module.sqs_kms.data.aws_iam_policy_document.this[0]");
    expect(
      nodes["module.s3_kms.data.aws_iam_policy_document.this[0]"].edges_new,
    ).not.toContain("module.sqs_kms");
  });
});

describe("buildDataFlowEdges", () => {
  it("infers Lambda IAM access to S3 from inline role policy", () => {
    const nodes = buildNodes([
      resource("aws_iam_role.lambda", "aws_iam_role", "lambda", {
        name: "lambda-role",
        arn: "arn:aws:iam::123:role/lambda-role",
      }),
      resource("aws_lambda_function.writer", "aws_lambda_function", "writer", {
        function_name: "writer",
        role: "arn:aws:iam::123:role/lambda-role",
      }),
      resource("aws_s3_bucket.assets", "aws_s3_bucket", "assets", {
        bucket: "assets",
        arn: "arn:aws:s3:::assets",
      }),
      resource("aws_iam_role_policy.lambda", "aws_iam_role_policy", "lambda", {
        role: "lambda-role",
        policy: JSON.stringify({
          Statement: [
            {
              Effect: "Allow",
              Action: "s3:PutObject",
              Resource: "arn:aws:s3:::assets/*",
            },
          ],
        }),
      }),
    ]);

    buildDataFlowEdges(nodes);

    expect(dataFlowTargets(nodes, "aws_lambda_function.writer")).toContainEqual(
      {
        target: "aws_s3_bucket.assets",
        type: "writes",
        origin: "iam_policy",
      },
    );
  });

  it("maps new Lambda roles through Terraform dependency edges", () => {
    const nodes = buildNodes([
      resource("aws_iam_role.reader", "aws_iam_role", "reader", {
        name: "reader-role",
      }),
      resource("aws_lambda_function.reader", "aws_lambda_function", "reader", {
        function_name: "reader",
      }),
      resource("aws_s3_bucket.assets", "aws_s3_bucket", "assets", {
        bucket: "assets",
        arn: "arn:aws:s3:::assets",
      }),
      resource("aws_iam_role_policy.reader", "aws_iam_role_policy", "reader", {
        role: "reader-role",
        policy: JSON.stringify({
          Statement: [
            {
              Effect: "Allow",
              Action: "s3:GetObject",
              Resource: "arn:aws:s3:::assets/*",
            },
          ],
        }),
      }),
    ]);
    nodes["aws_iam_role.reader"].edges_new = ["aws_lambda_function.reader"];

    buildDataFlowEdges(nodes);

    expect(dataFlowTargets(nodes, "aws_s3_bucket.assets")).toContainEqual({
      target: "aws_lambda_function.reader",
      type: "reads",
      origin: "iam_policy",
    });
  });

  it("infers attached IAM policy access to DynamoDB", () => {
    const nodes = buildNodes([
      resource("aws_iam_role.lambda", "aws_iam_role", "lambda", {
        name: "lambda-role",
        arn: "arn:aws:iam::123:role/lambda-role",
      }),
      resource("aws_lambda_function.reader", "aws_lambda_function", "reader", {
        function_name: "reader",
        role: "arn:aws:iam::123:role/lambda-role",
      }),
      resource("aws_dynamodb_table.items", "aws_dynamodb_table", "items", {
        name: "items",
        arn: "arn:aws:dynamodb:us-east-1:123:table/items",
      }),
      resource("aws_iam_policy.reader", "aws_iam_policy", "reader", {
        arn: "arn:aws:iam::123:policy/reader",
        policy: JSON.stringify({
          Statement: [
            {
              Effect: "Allow",
              Action: "dynamodb:GetItem",
              Resource: "arn:aws:dynamodb:us-east-1:123:table/items",
            },
          ],
        }),
      }),
      resource(
        "aws_iam_role_policy_attachment.reader",
        "aws_iam_role_policy_attachment",
        "reader",
        {
          role: "lambda-role",
          policy_arn: "arn:aws:iam::123:policy/reader",
        },
      ),
    ]);

    buildDataFlowEdges(nodes);

    expect(dataFlowTargets(nodes, "aws_dynamodb_table.items")).toContainEqual({
      target: "aws_lambda_function.reader",
      type: "reads",
      origin: "iam_policy",
    });
  });

  it("keeps read and write IAM permissions in opposite directions", () => {
    const nodes = buildNodes([
      resource("aws_iam_role.lambda", "aws_iam_role", "lambda", {
        name: "lambda-role",
        arn: "arn:aws:iam::123:role/lambda-role",
      }),
      resource("aws_lambda_function.sync", "aws_lambda_function", "sync", {
        function_name: "sync",
        role: "arn:aws:iam::123:role/lambda-role",
      }),
      resource("aws_s3_bucket.assets", "aws_s3_bucket", "assets", {
        bucket: "assets",
        arn: "arn:aws:s3:::assets",
      }),
      resource("aws_iam_role_policy.sync", "aws_iam_role_policy", "sync", {
        role: "lambda-role",
        policy: JSON.stringify({
          Statement: [
            {
              Effect: "Allow",
              Action: ["s3:GetObject", "s3:PutObject"],
              Resource: "arn:aws:s3:::assets/*",
            },
          ],
        }),
      }),
    ]);

    buildDataFlowEdges(nodes);

    expect(dataFlowTargets(nodes, "aws_s3_bucket.assets")).toContainEqual({
      target: "aws_lambda_function.sync",
      type: "reads",
      origin: "iam_policy",
    });
    expect(dataFlowTargets(nodes, "aws_lambda_function.sync")).toContainEqual({
      target: "aws_s3_bucket.assets",
      type: "writes",
      origin: "iam_policy",
    });
  });

  it("does not populate edges_data_flow for non-IAM integrations", () => {
    const nodes = buildNodes([
      resource(
        "aws_api_gateway_rest_api.api",
        "aws_api_gateway_rest_api",
        "api",
        {
          id: "api-id",
        },
      ),
      resource(
        "aws_lambda_function.handler",
        "aws_lambda_function",
        "handler",
        {
          function_name: "handler",
          invoke_arn:
            "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:123:function:handler/invocations",
          arn: "arn:aws:lambda:us-east-1:123:function:handler",
        },
      ),
      resource(
        "aws_api_gateway_integration.integration",
        "aws_api_gateway_integration",
        "integration",
        {
          rest_api_id: "api-id",
          uri: "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:123:function:handler/invocations",
        },
      ),
    ]);

    buildDataFlowEdges(nodes);

    expect(nodes["aws_api_gateway_rest_api.api"].edges_data_flow || []).toEqual([]);
  });
});

describe("buildNetworkingEdges", () => {
  it("infers security group egress peer link to another SG by id", () => {
    const nodes = buildNodes([
      resource("aws_security_group.peer", "aws_security_group", "peer", {
        id: "sg-peer111",
        vpc_id: "vpc-1",
      }),
      resource("aws_security_group.main", "aws_security_group", "main", {
        id: "sg-main222",
        vpc_id: "vpc-1",
        egress: [
          {
            from_port: 0,
            to_port: 0,
            protocol: "-1",
            cidr_blocks: [],
            security_groups: ["sg-peer111"],
          },
        ],
      }),
    ]);

    buildNetworkingEdges(nodes);

    expect(networkingTargets(nodes, "aws_security_group.main")).toContainEqual({
      target: "aws_security_group.peer",
      type: "peer_rule",
      origin: "security_group_rule",
    });
  });

  it("resolves standalone SG rules when security_group_id and peer are raw sg- identifiers", () => {
    const nodes = buildNodes([
      resource("aws_security_group.main", "aws_security_group", "main", {
        id: "sg-049f0ff2bd862ed73",
        vpc_id: "vpc-1",
      }),
      resource("aws_security_group.peer", "aws_security_group", "peer", {
        id: "sg-0123456789abcdef0",
        vpc_id: "vpc-1",
      }),
      resource(
        "aws_security_group_rule.ingress",
        "aws_security_group_rule",
        "ingress",
        {
          type: "ingress",
          security_group_id: "sg-049f0ff2bd862ed73",
          source_security_group_id: "sg-0123456789abcdef0",
        },
      ),
    ]);

    buildNetworkingEdges(nodes);

    expect(networkingTargets(nodes, "aws_security_group.main")).toContainEqual({
      target: "aws_security_group.peer",
      type: "peer_rule",
      origin: "security_group_rule",
    });
  });

  it("links interface VPC endpoints to security groups from security_group_ids", () => {
    const nodes = buildNodes([
      resource("aws_security_group.endpoint", "aws_security_group", "endpoint", {
        id: "sg-049f0ff2bd862ed73",
        vpc_id: "vpc-1",
      }),
      resource("aws_vpc_endpoint.logs", "aws_vpc_endpoint", "logs", {
        service_name: "com.amazonaws.us-east-1.logs",
        security_group_ids: ["sg-049f0ff2bd862ed73"],
      }),
    ]);

    buildNetworkingEdges(nodes);

    expect(networkingTargets(nodes, "aws_vpc_endpoint.logs")).toContainEqual({
      target: "aws_security_group.endpoint",
      type: "endpoint_attachment",
      origin: "vpc_endpoint_security_group",
    });
  });
});

describe("pruneRedundantStructuralEdges", () => {
  it("removes a redundant edges_new shortcut when a multi-hop path exists", () => {
    let nodes = {
      "module.lambda_writer": {
        resources: {
          "module.lambda_writer": resource(
            "module.lambda_writer",
            "terraform_module",
            "lambda_writer",
          ),
        },
        edges_new: ["module.data_queue", "module.sqs_kms"],
        edges_existing: [],
      },
      "module.data_queue": {
        resources: {
          "module.data_queue": resource(
            "module.data_queue",
            "terraform_module",
            "data_queue",
          ),
        },
        edges_new: ["module.sqs_kms"],
        edges_existing: [],
      },
      "module.sqs_kms": {
        resources: {
          "module.sqs_kms": resource(
            "module.sqs_kms",
            "terraform_module",
            "sqs_kms",
          ),
        },
        edges_new: [],
        edges_existing: [],
      },
    };
    nodes = ensureEdgeLists(nodes);
    pruneRedundantStructuralEdges(nodes);

    expect(nodes["module.lambda_writer"].edges_new.sort()).toEqual([
      "module.data_queue",
    ]);
    expect(nodes["module.data_queue"].edges_new).toEqual(["module.sqs_kms"]);
  });

  it("keeps a directed edges_new link when it is the only path between endpoints", () => {
    let nodes = {
      "module.lambda_writer": {
        resources: {
          "module.lambda_writer": resource(
            "module.lambda_writer",
            "terraform_module",
            "lambda_writer",
          ),
        },
        edges_new: ["module.sqs_kms"],
        edges_existing: [],
      },
      "module.sqs_kms": {
        resources: {
          "module.sqs_kms": resource(
            "module.sqs_kms",
            "terraform_module",
            "sqs_kms",
          ),
        },
        edges_new: [],
        edges_existing: [],
      },
    };
    nodes = ensureEdgeLists(nodes);
    pruneRedundantStructuralEdges(nodes);

    expect(nodes["module.lambda_writer"].edges_new).toEqual(["module.sqs_kms"]);
  });

  it("keeps a concrete resource-to-resource shortcut even when a multi-hop path exists", () => {
    let nodes = {
      "aws_lambda_function.writer": {
        resources: {
          "aws_lambda_function.writer": resource(
            "aws_lambda_function.writer",
            "aws_lambda_function",
            "writer",
          ),
        },
        edges_new: ["aws_s3_bucket.data", "aws_s3_bucket_policy.secure_transport"],
        edges_existing: [],
      },
      "aws_s3_bucket_policy.secure_transport": {
        resources: {
          "aws_s3_bucket_policy.secure_transport": resource(
            "aws_s3_bucket_policy.secure_transport",
            "aws_s3_bucket_policy",
            "secure_transport",
          ),
        },
        edges_new: ["aws_s3_bucket.data"],
        edges_existing: [],
      },
      "aws_s3_bucket.data": {
        resources: {
          "aws_s3_bucket.data": resource(
            "aws_s3_bucket.data",
            "aws_s3_bucket",
            "data",
          ),
        },
        edges_new: [],
        edges_existing: [],
      },
    };
    nodes = ensureEdgeLists(nodes);
    pruneRedundantStructuralEdges(nodes);

    expect(nodes["aws_lambda_function.writer"].edges_new.sort()).toEqual([
      "aws_s3_bucket.data",
      "aws_s3_bucket_policy.secure_transport",
    ]);
  });

  it("prunes redundant targets listed only on edges_existing", () => {
    let nodes = {
      "module.lambda_reader": {
        resources: {
          "module.lambda_reader": resource(
            "module.lambda_reader",
            "terraform_module",
            "lambda_reader",
          ),
        },
        edges_new: ["module.data_queue"],
        edges_existing: ["module.sqs_kms"],
      },
      "module.data_queue": {
        resources: {
          "module.data_queue": resource(
            "module.data_queue",
            "terraform_module",
            "data_queue",
          ),
        },
        edges_new: [],
        edges_existing: ["module.sqs_kms"],
      },
      "module.sqs_kms": {
        resources: {
          "module.sqs_kms": resource(
            "module.sqs_kms",
            "terraform_module",
            "sqs_kms",
          ),
        },
        edges_new: [],
        edges_existing: [],
      },
    };
    nodes = ensureEdgeLists(nodes);
    pruneRedundantStructuralEdges(nodes);

    expect(nodes["module.lambda_reader"].edges_new).toEqual(["module.data_queue"]);
    expect(nodes["module.lambda_reader"].edges_existing).toEqual([]);
  });
});
