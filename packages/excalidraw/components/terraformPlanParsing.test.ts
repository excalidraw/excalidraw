import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildTerraformElkExcalidrawScene } from "./terraformElkLayout";
import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  buildTerraformModuleTree,
  resolveTerraformPlanNodeKey,
  sanitizeTerraformPlanNodes,
  terraformPlanParsing,
  terraformPlanParsingFromSources,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";

/** Minimal state with VPC + subnet for state-only semantic topology smoke tests. */
const MINIMAL_TFSTATE_SEMANTIC = JSON.stringify({
  version: 4,
  terraform_version: "1.0.0",
  serial: 1,
  lineage: "fixture-semantic",
  outputs: {},
  resources: [
    {
      mode: "data",
      type: "aws_caller_identity",
      name: "current",
      instances: [{ attributes: { account_id: "123456789012" } }],
    },
    {
      mode: "data",
      type: "aws_region",
      name: "current",
      instances: [{ attributes: { name: "us-east-1" } }],
    },
    {
      mode: "managed",
      type: "aws_vpc",
      name: "main",
      provider: 'provider["registry.terraform.io/hashicorp/aws"]',
      instances: [
        {
          attributes: {
            id: "vpc-fixture",
            owner_id: "123456789012",
            cidr_block: "10.0.0.0/16",
          },
        },
      ],
    },
    {
      mode: "managed",
      type: "aws_subnet",
      name: "public",
      provider: 'provider["registry.terraform.io/hashicorp/aws"]',
      instances: [
        {
          attributes: {
            id: "subnet-fixture",
            vpc_id: "vpc-fixture",
            availability_zone: "us-east-1a",
            cidr_block: "10.0.1.0/24",
            tags: { Name: "public-subnet", Tier: "public" },
          },
        },
      ],
    },
  ],
});

/** Minimal raw Terraform state (`terraform state pull` shape) for state-only import tests. */
const MINIMAL_TFSTATE = JSON.stringify({
  version: 4,
  terraform_version: "1.0.0",
  serial: 1,
  lineage: "fixture-lineage",
  outputs: {},
  resources: [
    {
      mode: "managed",
      type: "aws_s3_bucket",
      name: "fixture_bucket",
      provider: 'provider["registry.terraform.io/hashicorp/aws"]',
      instances: [
        {
          schema_version: 0,
          attributes: {
            bucket: "demo-fixture-bucket",
            region: "us-east-1",
          },
          dependencies: [],
        },
      ],
    },
  ],
});

/** Minimal `File` stand-in: Vitest’s jsdom `File` / `Blob` may omit `.text()`. */
function textFileLike(contents: string): File {
  return {
    text: async () => contents,
  } as File;
}

const resource = (
  address: string,
  mode: "managed" | "data",
  type: string,
  extra: Record<string, unknown> = {},
) => ({ address, mode, type, ...extra });

const renderedLabels = (
  elements: Array<{ type?: string; originalText?: string }>,
) =>
  elements
    .filter((element) => element.type === "text")
    .map((element) => element.originalText)
    .filter(Boolean) as string[];

describe("buildTerraformModuleTree", () => {
  it("places root resources under path root and nests module resources", () => {
    const nodes = {
      "aws_s3_bucket.root": {
        resources: {
          "aws_s3_bucket.root": { address: "aws_s3_bucket.root" },
        },
      },
      "module.network.aws_vpc.main": {
        resources: {
          "module.network.aws_vpc.main": {
            address: "module.network.aws_vpc.main",
          },
        },
      },
      "module.network.module.sub.aws_subnet.a": {
        resources: {
          "module.network.module.sub.aws_subnet.a": {
            address: "module.network.module.sub.aws_subnet.a",
          },
        },
      },
    };

    const tree = buildTerraformModuleTree(nodes);

    expect(tree.path).toBe("root");
    expect(tree.resourceAddresses).toEqual(["aws_s3_bucket.root"]);
    expect(Object.keys(tree.modules)).toEqual(["module.network"]);

    const net = tree.modules["module.network"];
    expect(net.resourceAddresses).toEqual(["module.network.aws_vpc.main"]);
    expect(Object.keys(net.modules)).toEqual(["module.network.module.sub"]);

    const sub = net.modules["module.network.module.sub"];
    expect(sub.resourceAddresses).toEqual([
      "module.network.module.sub.aws_subnet.a",
    ]);
    expect(sub.modules).toEqual({});
  });

  it("ignores reserved __ keys on the nodes map", () => {
    const nodes = {
      "aws_instance.a": {
        resources: { "aws_instance.a": { address: "aws_instance.a" } },
      },
    };
    const map = { ...nodes } as Record<
      string,
      typeof nodes["aws_instance.a"]
    > & {
      __other__?: unknown;
    };
    map.__other__ = { misc: true };

    const tree = buildTerraformModuleTree(
      map as Parameters<typeof buildTerraformModuleTree>[0],
    );
    expect(tree.resourceAddresses).toEqual(["aws_instance.a"]);
  });

  it("keeps stack-qualified module paths separate for multi-stack imports", () => {
    const nodes = {
      "40-east-api-1::module.api.aws_ssm_parameter.api_name": {
        resources: {
          "40-east-api-1::module.api.aws_ssm_parameter.api_name": {
            address: "40-east-api-1::module.api.aws_ssm_parameter.api_name",
          },
        },
      },
      "41-east-api-2::module.api.aws_ssm_parameter.api_name": {
        resources: {
          "41-east-api-2::module.api.aws_ssm_parameter.api_name": {
            address: "41-east-api-2::module.api.aws_ssm_parameter.api_name",
          },
        },
      },
      "40-east-api-1::aws_vpc.main": {
        resources: {
          "40-east-api-1::aws_vpc.main": {
            address: "40-east-api-1::aws_vpc.main",
          },
        },
      },
    };

    const tree = buildTerraformModuleTree(nodes);

    expect(Object.keys(tree.modules).sort()).toEqual([
      "__stack__::40-east-api-1",
      "__stack__::41-east-api-2",
    ]);
    const stackA = tree.modules["__stack__::40-east-api-1"]!;
    const stackB = tree.modules["__stack__::41-east-api-2"]!;
    expect(Object.keys(stackA.modules).sort()).toEqual([
      "40-east-api-1::module.api",
      "40-east-api-1::root",
    ]);
    expect(
      stackA.modules["40-east-api-1::module.api"]!.resourceAddresses,
    ).toEqual(["40-east-api-1::module.api.aws_ssm_parameter.api_name"]);
    expect(
      stackB.modules["41-east-api-2::module.api"]!.resourceAddresses,
    ).toEqual(["41-east-api-2::module.api.aws_ssm_parameter.api_name"]);
    expect(stackA.modules["40-east-api-1::root"]!.resourceAddresses).toEqual([
      "40-east-api-1::aws_vpc.main",
    ]);
  });
});

describe("resolveTerraformPlanNodeKey", () => {
  it("maps prior_state depends_on without instance key to indexed plan node keys", () => {
    const nodes: Record<string, TerraformPlanGraphNode> = {
      "module.lambda_deployment_artifacts.aws_s3_bucket.this[0]": {
        resources: {},
      },
    };
    expect(
      resolveTerraformPlanNodeKey(
        nodes,
        "module.lambda_deployment_artifacts.aws_s3_bucket.this",
      ),
    ).toBe("module.lambda_deployment_artifacts.aws_s3_bucket.this[0]");
  });

  it("returns null when multiple node keys share the same stripped id (ambiguous)", () => {
    const nodes: Record<string, TerraformPlanGraphNode> = {
      "aws_instance.a[0]": { resources: {} },
      "aws_instance.a[1]": { resources: {} },
    };
    expect(resolveTerraformPlanNodeKey(nodes, "aws_instance.a")).toBeNull();
  });

  it("resolves unqualified refs to a single stack-qualified node key", () => {
    const nodes: Record<string, TerraformPlanGraphNode> = {
      "40-east-api-1::module.api.aws_ssm_parameter.api_name": { resources: {} },
      "41-east-api-2::module.api.aws_ssm_parameter.api_name": { resources: {} },
    };
    expect(
      resolveTerraformPlanNodeKey(
        nodes,
        "module.api.aws_ssm_parameter.api_name",
      ),
    ).toBeNull();
    expect(
      resolveTerraformPlanNodeKey(
        nodes,
        "40-east-api-1::module.api.aws_ssm_parameter.api_name",
      ),
    ).toBe("40-east-api-1::module.api.aws_ssm_parameter.api_name");
  });
});

describe("terraformPlanParsing", () => {
  beforeAll(() => {
    /** Hide `[terraform:local-parse]` noise unless `VITEST_TERRAFORM_VERBOSE=1`. */
    if (process.env.VITEST_TERRAFORM_VERBOSE !== "1") {
      vi.spyOn(console, "log").mockImplementation(() => {});
    }
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("state-only import runs ELK pipeline without plan or dot", async () => {
    const res = await terraformPlanParsing(
      null,
      null,
      textFileLike(MINIMAL_TFSTATE),
      {},
    );

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta?.layoutEngine).toBe("elk");
    expect(Array.isArray(body.elements)).toBe(true);
    expect(body.elements.length).toBeGreaterThan(0);
    const labels = renderedLabels(body.elements);
    expect(
      labels.some(
        (label) =>
          label.includes("fixture_bucket") ||
          label.includes("aws_s3_bucket") ||
          label.includes("demo-fixture-bucket"),
      ),
    ).toBe(true);
  }, 60_000);

  it("state-only with semanticLayout runs topology pipeline", async () => {
    const res = await terraformPlanParsing(
      null,
      null,
      textFileLike(MINIMAL_TFSTATE_SEMANTIC),
      {
        semanticLayout: true,
      },
    );
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.meta?.layoutEngine).toBe("topology");
    expect(body.meta?.importSource).toBe("state-only");
    expect(body.meta?.plannedChanges).toBe(false);
    expect(body.elements.length).toBeGreaterThan(0);
  }, 60_000);

  it("state-only semantic returns 400 when no managed resources", async () => {
    const res = await terraformPlanParsing(
      null,
      null,
      textFileLike(
        JSON.stringify({
          version: 4,
          resources: [
            {
              mode: "data",
              type: "aws_caller_identity",
              name: "current",
              instances: [{ attributes: { account_id: "123" } }],
            },
          ],
        }),
      ),
      { semanticLayout: true },
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/managed resource/i);
  });

  it("state-only semantic accepts cloudflare managed resources", async () => {
    const res = await terraformPlanParsing(
      null,
      null,
      textFileLike(
        JSON.stringify({
          version: 4,
          resources: [
            {
              mode: "managed",
              type: "cloudflare_zone",
              name: "tfdraw_dev",
              instances: [
                {
                  attributes: {
                    id: "8aad82763aa1144a148989b4600c44f3",
                    name: "tfdraw.dev",
                    account_id: "456df569e19a171982d07ee7be6db716",
                  },
                },
              ],
            },
          ],
        }),
      ),
      { semanticLayout: true },
    );
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.meta?.layoutEngine).toBe("topology");
    expect(body.meta?.providerBlockCount).toBe(1);
    const nodePaths = body.elements
      .map(
        (e: { customData?: { nodePath?: string } }) => e.customData?.nodePath,
      )
      .filter(Boolean);
    expect(nodePaths).toContain("cloudflare_zone.tfdraw_dev");
  });

  it("state-only module view accepts cloudflare managed resources", async () => {
    const res = await terraformPlanParsing(
      null,
      null,
      textFileLike(
        JSON.stringify({
          version: 4,
          resources: [
            {
              mode: "managed",
              type: "cloudflare_zone",
              name: "tfdraw_dev",
              instances: [
                {
                  attributes: {
                    id: "8aad82763aa1144a148989b4600c44f3",
                    name: "tfdraw.dev",
                    type: "full",
                  },
                },
              ],
            },
            {
              mode: "managed",
              type: "cloudflare_dns_record",
              name: "tfdraw_dev_root",
              instances: [
                {
                  attributes: {
                    id: "d0b1a3afb332de0311e1a45d17676c35",
                    name: "tfdraw.dev",
                    type: "CNAME",
                    content: "master.ainur-chb.pages.dev",
                    zone_id: "8aad82763aa1144a148989b4600c44f3",
                  },
                },
              ],
            },
          ],
        }),
      ),
      { semanticLayout: false },
    );

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta?.layoutEngine).toBe("elk");
    expect(Array.isArray(body.elements)).toBe(true);
    expect(body.elements.length).toBeGreaterThan(0);
    const nodePaths = body.elements
      .map((element: { customData?: { nodePath?: unknown } }) =>
        typeof element.customData?.nodePath === "string"
          ? element.customData.nodePath
          : null,
      )
      .filter(Boolean);
    expect(nodePaths).toContain("cloudflare_zone.tfdraw_dev");
    expect(nodePaths).toContain("cloudflare_dns_record.tfdraw_dev_root");
    const visibleCloudflareCards = body.elements.filter(
      (element: {
        type?: string;
        isDeleted?: boolean;
        customData?: { resourceType?: unknown };
      }) =>
        element.type === "rectangle" &&
        element.isDeleted !== true &&
        typeof element.customData?.resourceType === "string" &&
        element.customData.resourceType.startsWith("cloudflare_"),
    );
    expect(visibleCloudflareCards.length).toBeGreaterThan(0);
  }, 60_000);

  it("terraformPlanParsingFromSources merges two plan+dot bundles", async () => {
    const zonePlan = {
      resource_changes: [
        {
          address: "cloudflare_zone.stack_a",
          mode: "managed",
          type: "cloudflare_zone",
          name: "stack_a",
          change: {
            actions: ["no-op"],
            after: { id: "zone-a", name: "a.example" },
          },
        },
      ],
    };
    const dnsPlan = {
      resource_changes: [
        {
          address: "cloudflare_dns_record.stack_b",
          mode: "managed",
          type: "cloudflare_dns_record",
          name: "stack_b",
          change: {
            actions: ["no-op"],
            after: { id: "dns-b", name: "b.example", type: "CNAME" },
          },
        },
      ],
    };
    const dotA = `digraph { "[root] cloudflare_zone.stack_a (expand)" [shape=box] }`;
    const dotB = `digraph { "[root] cloudflare_dns_record.stack_b (expand)" [shape=box] }`;

    const res = await terraformPlanParsingFromSources(
      {
        planDotBundles: [
          { plan: zonePlan, dotText: dotA, label: "stack-a" },
          { plan: dnsPlan, dotText: dotB, label: "stack-b" },
        ],
        states: [],
        tfdTexts: [],
      },
      { semanticLayout: false },
    );

    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.meta?.importBundleCount).toBe(2);
    const nodePaths = body.elements
      .map((element: { customData?: { nodePath?: unknown } }) =>
        typeof element.customData?.nodePath === "string"
          ? element.customData.nodePath
          : null,
      )
      .filter(Boolean);
    expect(nodePaths).toContain("stack-a::cloudflare_zone.stack_a");
    expect(nodePaths).toContain("stack-b::cloudflare_dns_record.stack_b");
  }, 60_000);

  it("plan+dot module view accepts cloudflare managed resources", async () => {
    const plan = {
      format_version: "1.2",
      terraform_version: "1.11.5",
      resource_changes: [
        {
          address: "cloudflare_zone.tfdraw_dev",
          mode: "managed",
          type: "cloudflare_zone",
          name: "tfdraw_dev",
          change: {
            actions: ["no-op"],
            after: {
              id: "8aad82763aa1144a148989b4600c44f3",
              name: "tfdraw.dev",
              type: "full",
            },
          },
        },
        {
          address: "cloudflare_dns_record.tfdraw_dev_root",
          mode: "managed",
          type: "cloudflare_dns_record",
          name: "tfdraw_dev_root",
          change: {
            actions: ["no-op"],
            after: {
              id: "d0b1a3afb332de0311e1a45d17676c35",
              name: "tfdraw.dev",
              type: "CNAME",
              content: "master.ainur-chb.pages.dev",
              zone_id: "8aad82763aa1144a148989b4600c44f3",
            },
          },
        },
      ],
    };
    const dot = `digraph {
      "[root] cloudflare_zone.tfdraw_dev (expand)" [label = "cloudflare_zone.tfdraw_dev", shape = "box"]
      "[root] cloudflare_dns_record.tfdraw_dev_root (expand)" [label = "cloudflare_dns_record.tfdraw_dev_root", shape = "box"]
      "[root] cloudflare_dns_record.tfdraw_dev_root (expand)" -> "[root] cloudflare_zone.tfdraw_dev (expand)"
    }`;

    const res = await terraformPlanParsing(
      textFileLike(JSON.stringify(plan)),
      textFileLike(dot),
      null,
      { semanticLayout: false },
    );

    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.meta?.layoutEngine).toBe("elk");
    const nodePaths = body.elements
      .map((element: { customData?: { nodePath?: unknown } }) =>
        typeof element.customData?.nodePath === "string"
          ? element.customData.nodePath
          : null,
      )
      .filter(Boolean);
    expect(nodePaths).toContain("cloudflare_zone.tfdraw_dev");
    expect(nodePaths).toContain("cloudflare_dns_record.tfdraw_dev_root");
    const visibleCloudflareCards = body.elements.filter(
      (element: {
        type?: string;
        isDeleted?: boolean;
        customData?: { resourceType?: unknown };
      }) =>
        element.type === "rectangle" &&
        element.isDeleted !== true &&
        typeof element.customData?.resourceType === "string" &&
        element.customData.resourceType.startsWith("cloudflare_"),
    );
    expect(visibleCloudflareCards.length).toBeGreaterThan(0);
  }, 60_000);

  it("state-only module view shows generic non-aws managed resources", async () => {
    const res = await terraformPlanParsing(
      null,
      null,
      textFileLike(
        JSON.stringify({
          version: 4,
          resources: [
            {
              mode: "managed",
              type: "random_id",
              name: "suffix",
              instances: [
                {
                  attributes: {
                    id: "abc123",
                    hex: "abc123",
                  },
                },
              ],
            },
          ],
        }),
      ),
      { semanticLayout: false },
    );

    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.meta?.layoutEngine).toBe("elk");
    const visibleGenericCards = body.elements.filter(
      (element: {
        type?: string;
        isDeleted?: boolean;
        customData?: { resourceType?: unknown; nodePath?: unknown };
      }) =>
        element.type === "rectangle" &&
        element.isDeleted !== true &&
        element.customData?.resourceType === "random_id" &&
        element.customData?.nodePath === "random_id.suffix",
    );
    expect(visibleGenericCards.length).toBeGreaterThan(0);
  }, 60_000);
});

describe("sanitizeTerraformPlanNodes", () => {
  it("removes non-policy data sources and strips incoming/outgoing references", () => {
    const nodes = {
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": resource(
            "aws_lambda_function.fn",
            "managed",
            "aws_lambda_function",
          ),
        },
        edges_new: ["data.aws_region.current"],
        edges_existing: ["data.aws_region.current"],
        edges_data_flow: [
          "data.aws_region.current",
          { target: "data.aws_region.current", type: "lookup" },
        ] as unknown as string[],
      },
      "data.aws_region.current": {
        resources: {
          "data.aws_region.current": resource(
            "data.aws_region.current",
            "data",
            "aws_region",
          ),
        },
        edges_new: ["aws_lambda_function.fn"],
        edges_existing: ["aws_lambda_function.fn"],
        edges_data_flow: ["aws_lambda_function.fn"],
      },
    };

    const sanitized = sanitizeTerraformPlanNodes(nodes);

    expect(sanitized["data.aws_region.current"]).toBeUndefined();
    expect(sanitized["aws_lambda_function.fn"].edges_new).toEqual([]);
    expect(sanitized["aws_lambda_function.fn"].edges_existing).toEqual([]);
    expect(sanitized["aws_lambda_function.fn"].edges_data_flow).toEqual([]);
  });

  it("keeps aws_iam_policy_document data sources with non-empty statements", () => {
    const nodes = {
      "data.aws_iam_policy_document.assume": {
        resources: {
          "data.aws_iam_policy_document.assume": resource(
            "data.aws_iam_policy_document.assume",
            "data",
            "aws_iam_policy_document",
            {
              change: {
                after: {
                  statement: [
                    { actions: ["sts:AssumeRole"], resources: ["*"] },
                  ],
                },
              },
            },
          ),
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
    };

    expect(
      sanitizeTerraformPlanNodes(nodes)["data.aws_iam_policy_document.assume"],
    ).toBe(nodes["data.aws_iam_policy_document.assume"]);
  });

  it("removes empty aws_iam_policy_document placeholders", () => {
    const nodes = {
      "data.aws_iam_policy_document.empty": {
        resources: {
          "data.aws_iam_policy_document.empty": resource(
            "data.aws_iam_policy_document.empty",
            "data",
            "aws_iam_policy_document",
            {
              change: { after: { statement: [] } },
            },
          ),
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
    };

    expect(
      sanitizeTerraformPlanNodes(nodes)["data.aws_iam_policy_document.empty"],
    ).toBeUndefined();
  });

  it("sanitizes mixed graphs before ELK renders resource rectangles", async () => {
    const nodes = sanitizeTerraformPlanNodes({
      "aws_lambda_function.fn": {
        resources: {
          "aws_lambda_function.fn": resource(
            "aws_lambda_function.fn",
            "managed",
            "aws_lambda_function",
          ),
        },
        edges_new: [
          "data.aws_region.current",
          "data.aws_iam_policy_document.assume",
        ],
        edges_existing: [],
        edges_data_flow: [],
      },
      "data.aws_region.current": {
        resources: {
          "data.aws_region.current": resource(
            "data.aws_region.current",
            "data",
            "aws_region",
          ),
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
      "data.aws_iam_policy_document.assume": {
        resources: {
          "data.aws_iam_policy_document.assume": resource(
            "data.aws_iam_policy_document.assume",
            "data",
            "aws_iam_policy_document",
            {
              values: {
                statement: [{ actions: ["sts:AssumeRole"], resources: ["*"] }],
              },
            },
          ),
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
    } as Record<string, TerraformPlanGraphNode>) as TerraformPlanNodesMap;
    nodes[TERRAFORM_MODULE_TREE_KEY] = buildTerraformModuleTree(nodes);

    const { elements } = await buildTerraformElkExcalidrawScene(nodes);
    const labels = renderedLabels(elements);

    expect(labels).toContain("fn");
    expect(labels).toContain("assume");
    expect(labels).not.toContain("data.aws_region.current");
  });
});
