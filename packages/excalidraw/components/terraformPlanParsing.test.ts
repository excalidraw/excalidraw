import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildTerraformElkExcalidrawScene } from "./terraformElkLayout";
import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  buildTerraformModuleTree,
  resolveTerraformPlanNodeKey,
  sanitizeTerraformPlanNodes,
  terraformPlanParsing,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FIXTURE_DIR = path.resolve(__dirname, "../../backend/terraform");
const PLAN_FIXTURE = path.join(FIXTURE_DIR, "allplanmodules.json");
const DOT_FIXTURE = path.join(FIXTURE_DIR, "allplanmodules.dot");

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

const renderedLabels = (elements: Array<{ type?: string; originalText?: string }>) =>
  elements
    .filter((element) => element.type === "text")
    .map((element) => element.originalText)
    .filter(Boolean) as string[];

function elementBounds(
  elements: Array<{
    type?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }>,
) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const element of elements) {
    if (
      typeof element.x !== "number" ||
      typeof element.y !== "number" ||
      typeof element.width !== "number" ||
      typeof element.height !== "number"
    ) {
      continue;
    }
    minX = Math.min(minX, element.x);
    minY = Math.min(minY, element.y);
    maxX = Math.max(maxX, element.x + element.width);
    maxY = Math.max(maxY, element.y + element.height);
  }

  return { width: maxX - minX, height: maxY - minY };
}

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
          "module.network.aws_vpc.main": { address: "module.network.aws_vpc.main" },
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
    expect(sub.resourceAddresses).toEqual(["module.network.module.sub.aws_subnet.a"]);
    expect(sub.modules).toEqual({});
  });

  it("ignores reserved __ keys on the nodes map", () => {
    const nodes = {
      "aws_instance.a": {
        resources: { "aws_instance.a": { address: "aws_instance.a" } },
      },
    };
    const map = { ...nodes } as Record<string, (typeof nodes)["aws_instance.a"]> & {
      __other__?: unknown;
    };
    map.__other__ = { misc: true };

    const tree = buildTerraformModuleTree(map as Parameters<typeof buildTerraformModuleTree>[0]);
    expect(tree.resourceAddresses).toEqual(["aws_instance.a"]);
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
});

describe("terraformPlanParsing", () => {
  beforeAll(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it(
    "runs full local pipeline on allplanmodules fixtures without throwing",
    async () => {
      const planText = fs.readFileSync(PLAN_FIXTURE, "utf8");
      const dotText = fs.readFileSync(DOT_FIXTURE, "utf8");

      const res = await terraformPlanParsing(
        textFileLike(planText),
        textFileLike(dotText),
        null,
      );

      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/json");

      const body = await res.json();
      expect(body.type).toBe("excalidraw");
      expect(body.version).toBe(2);
      expect(body.source).toBe("terraform-local-parse");
      expect(Array.isArray(body.elements)).toBe(true);
      expect(body.meta?.layoutEngine).toBe("elk");
      expect(body.meta?.skippedLayout).toBeUndefined();
      expect(body.meta?.vertexCount).toBeGreaterThan(0);
      expect(body.elements.length).toBeGreaterThan(0);
      const bounds = elementBounds(body.elements);
      expect(bounds.width / bounds.height).toBeLessThan(2);
      expect(body.appState).toMatchObject({
        viewBackgroundColor: "#ffffff",
        gridSize: null,
      });

      const labels = renderedLabels(body.elements);
      expect(labels).not.toContain("data.aws_region.current");
      expect(labels).not.toContain("data.aws_partition.current");
      expect(labels).not.toContain("data.aws_caller_identity.current");
      expect(labels).not.toContain("data.external.archive_prepare[0]");
      expect(labels.some((label) => label.includes("data.aws_iam_policy_document."))).toBe(
        true,
      );

      const terraformResources = body.elements
        .flatMap(
          (element: any) => element.customData?.terraformResources || [],
        )
        .filter(Boolean);
      expect(
        terraformResources.some(
          (resource: any) => (resource.attributes || []).length > 0,
        ),
      ).toBe(true);
      expect(
        terraformResources.some((resource: any) =>
          (resource.attributes || []).some(
            (attribute: any) => attribute.changed || attribute.unknownAfter,
          ),
        ),
      ).toBe(true);
    },
    60_000,
  );
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
                  statement: [{ actions: ["sts:AssumeRole"], resources: ["*"] }],
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

    expect(sanitizeTerraformPlanNodes(nodes)["data.aws_iam_policy_document.assume"]).toBe(
      nodes["data.aws_iam_policy_document.assume"],
    );
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

    expect(sanitizeTerraformPlanNodes(nodes)["data.aws_iam_policy_document.empty"]).toBeUndefined();
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
        edges_new: ["data.aws_region.current", "data.aws_iam_policy_document.assume"],
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

    expect(labels).toContain("aws_lambda_function.fn");
    expect(labels).toContain("data.aws_iam_policy_document.assume");
    expect(labels).not.toContain("data.aws_region.current");
  });
});
