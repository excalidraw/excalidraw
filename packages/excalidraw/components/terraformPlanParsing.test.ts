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
const STATE_FIXTURE = path.join(
  FIXTURE_DIR,
  "terraform_allplanmodules.tfstate",
);
const hasAllplanmodulesState = fs.existsSync(STATE_FIXTURE);

function tierFromSubnetZoneName(
  name: string,
): "public" | "intra" | "private" | "other" {
  const n = name.toLowerCase();
  if (/\bpublic\b/.test(n) || n.includes("public-")) {
    return "public";
  }
  if (/\bintra\b/.test(n) || n.includes("intra")) {
    return "intra";
  }
  if (/\bprivate\b/.test(n) || n.includes("private")) {
    return "private";
  }
  return "other";
}

function collectSubnetZoneFrames(elements: unknown[]) {
  return (
    elements as Array<{
      type?: string;
      name?: string;
      customData?: {
        terraformTopologyRole?: string;
        terraformSubnetIds?: string[];
      };
    }>
  ).filter(
    (e) =>
      e.type === "frame" &&
      e.customData?.terraformTopologyRole === "subnetZone",
  );
}

function expectAllplanmodulesCoalescedSubnetZones(body: {
  meta?: { subnetCount?: number };
  elements: unknown[];
}) {
  const subnetZones = collectSubnetZoneFrames(body.elements);
  const byTier = {
    public: [] as typeof subnetZones,
    intra: [] as typeof subnetZones,
    private: [] as typeof subnetZones,
  };
  for (const z of subnetZones) {
    const tier = tierFromSubnetZoneName(z.name ?? "");
    if (tier === "public" || tier === "intra" || tier === "private") {
      byTier[tier].push(z);
    }
  }
  expect(byTier.public).toHaveLength(1);
  expect(byTier.intra).toHaveLength(1);
  expect(byTier.private).toHaveLength(1);
  expect(byTier.public[0]!.customData?.terraformSubnetIds).toHaveLength(2);
  expect(byTier.intra[0]!.customData?.terraformSubnetIds).toHaveLength(2);
  expect(byTier.private[0]!.customData?.terraformSubnetIds).toHaveLength(2);
  expect(body.meta?.subnetCount).toBe(6);
}

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

  it("state-only semantic returns 400 when no aws resources", async () => {
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
              name: "x",
              instances: [{ attributes: { id: "abc" } }],
            },
          ],
        }),
      ),
      { semanticLayout: true },
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Semantic layout requires AWS/i);
  });

  it("plan+dot with invalid state JSON shape returns 400", async () => {
    const planText = fs.readFileSync(PLAN_FIXTURE, "utf8");
    const dotText = fs.readFileSync(DOT_FIXTURE, "utf8");

    const res = await terraformPlanParsing(
      textFileLike(planText),
      textFileLike(dotText),
      textFileLike("{}"),
      {},
    );

    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/resources/i);
  });

  it.skipIf(!hasAllplanmodulesState)(
    "allplanmodules state-only semantic import runs topology pipeline",
    async () => {
      const stateText = fs.readFileSync(STATE_FIXTURE, "utf8");

      const res = await terraformPlanParsing(
        null,
        null,
        textFileLike(stateText),
        { semanticLayout: true },
      );

      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.meta?.layoutEngine).toBe("topology");
      expect(body.meta?.importSource).toBe("state-only");
      expect(body.meta?.plannedChanges).toBe(false);
      expect(body.meta?.accountCount).toBeGreaterThan(0);
      const frames = body.elements.filter((e: any) => e.type === "frame");
      expect(frames.length).toBeGreaterThan(0);
    },
    120_000,
  );

  it.skipIf(!hasAllplanmodulesState)(
    "allplanmodules state-only semantic: one subnet zone per tier with two subnets each",
    async () => {
      const stateText = fs.readFileSync(STATE_FIXTURE, "utf8");

      const res = await terraformPlanParsing(
        null,
        null,
        textFileLike(stateText),
        { semanticLayout: true },
      );

      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.meta?.layoutEngine).toBe("topology");
      expectAllplanmodulesCoalescedSubnetZones(body);
    },
    120_000,
  );

  it("allplanmodules plan+dot semantic: one subnet zone per tier with two subnets each", async () => {
    const planText = fs.readFileSync(PLAN_FIXTURE, "utf8");
    const dotText = fs.readFileSync(DOT_FIXTURE, "utf8");

    const res = await terraformPlanParsing(
      textFileLike(planText),
      textFileLike(dotText),
      null,
      { semanticLayout: true },
    );

    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.meta?.layoutEngine).toBe("topology");
    expectAllplanmodulesCoalescedSubnetZones(body);
  }, 120_000);

  it("allplanmodules semantic: writer lambda environment unknown-after lists SQS dependency", async () => {
    const planText = fs.readFileSync(PLAN_FIXTURE, "utf8");
    const dotText = fs.readFileSync(DOT_FIXTURE, "utf8");

    const res = await terraformPlanParsing(
      textFileLike(planText),
      textFileLike(dotText),
      null,
      { semanticLayout: true },
    );

    expect(res.ok).toBe(true);
    const body = await res.json();
    const writerAddr =
      "module.workload_writer_lambda.module.lambda.aws_lambda_function.this[0]";
    const writerTile = (body.elements as Array<{ customData?: Record<string, unknown> }>).find(
      (e) => e.customData?.nodePath === writerAddr,
    );
    expect(writerTile).toBeTruthy();
    const resources = writerTile?.customData?.terraformResources as
      | Array<{
          attributes?: Array<{
            key?: string;
            unknownAfter?: boolean;
            value?: unknown;
            unknownAfterPreview?: Array<{
              key?: string;
              resolvesTo?: string | null;
              nodePath?: string | null;
            }>;
          }>;
        }>
      | undefined;
    const envAttr = resources?.[0]?.attributes?.find((a) => a.key === "environment");
    expect(envAttr).toEqual(
      expect.objectContaining({
        unknownAfter: true,
        value: "Known after apply",
      }),
    );
    const preview = envAttr?.unknownAfterPreview ?? [];
    expect(preview).toHaveLength(1);
    expect(preview[0]).toEqual(
      expect.objectContaining({
        key: "queue_url",
        kind: "new",
        resolvesTo: "module.application_job_queue.queue_url",
      }),
    );
    expect(String(preview[0]?.nodePath ?? "")).toMatch(/aws_sqs_queue/);
    expect(preview.find((r) => r.key === "DATA_BUCKET")).toBeUndefined();
    expect(preview.find((r) => r.key === "test")).toBeUndefined();
  }, 120_000);

  it.skipIf(!hasAllplanmodulesState)(
    "allplanmodules state-only import runs ELK pipeline",
    async () => {
      const stateText = fs.readFileSync(STATE_FIXTURE, "utf8");

      const res = await terraformPlanParsing(
        null,
        null,
        textFileLike(stateText),
        {},
      );

      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.type).toBe("excalidraw");
      expect(body.meta?.layoutEngine).toBe("elk");
      expect(body.elements.length).toBeGreaterThan(0);
    },
    60_000,
  );

  it.skipIf(!hasAllplanmodulesState)(
    "allplanmodules plan+dot+state merge runs without throwing",
    async () => {
      const planText = fs.readFileSync(PLAN_FIXTURE, "utf8");
      const dotText = fs.readFileSync(DOT_FIXTURE, "utf8");
      const stateText = fs.readFileSync(STATE_FIXTURE, "utf8");

      const planOnlyRes = await terraformPlanParsing(
        textFileLike(planText),
        textFileLike(dotText),
        null,
        {},
      );
      expect(planOnlyRes.ok).toBe(true);
      const planOnlyBody = await planOnlyRes.json();

      const res = await terraformPlanParsing(
        textFileLike(planText),
        textFileLike(dotText),
        textFileLike(stateText),
        {},
      );

      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.type).toBe("excalidraw");
      expect(body.elements.length).toBeGreaterThan(0);
      expect(body.meta?.vertexCount).toBeGreaterThanOrEqual(
        planOnlyBody.meta?.vertexCount ?? 0,
      );
    },
    120_000,
  );

  it("runs full local pipeline on allplanmodules fixtures without throwing", async () => {
    const planText = fs.readFileSync(PLAN_FIXTURE, "utf8");
    const dotText = fs.readFileSync(DOT_FIXTURE, "utf8");

    const res = await terraformPlanParsing(
      textFileLike(planText),
      textFileLike(dotText),
      null,
      {},
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
    expect(labels.some((label) => label === "logs")).toBe(true);

    const terraformResources = body.elements
      .flatMap((element: any) => element.customData?.terraformResources || [])
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
  }, 60_000);

  it("semanticLayout returns topology frames and topology meta", async () => {
    const planText = fs.readFileSync(PLAN_FIXTURE, "utf8");
    const dotText = fs.readFileSync(DOT_FIXTURE, "utf8");

    const res = await terraformPlanParsing(
      textFileLike(planText),
      textFileLike(dotText),
      null,
      { semanticLayout: true },
    );

    expect(res.ok).toBe(true);
    const body = await res.json();
    const plan = JSON.parse(planText);
    expect(body.meta?.layoutEngine).toBe("topology");
    expect(body.meta?.accountCount).toBeGreaterThan(0);
    expect(typeof body.meta?.primaryResourceCount).toBe("number");
    expect(body.meta?.primaryResourceCount).toBeGreaterThanOrEqual(0);
    expect(typeof body.meta?.regionalPrimaryCount).toBe("number");
    expect(body.meta?.regionalPrimaryCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(body.elements)).toBe(true);
    const frames = body.elements.filter((e: any) => e.type === "frame");
    expect(frames.length).toBeGreaterThan(0);

    const represented = new Set<string>();
    const representedSubnetIds = new Set<string>();
    for (const element of body.elements as any[]) {
      if (typeof element.customData?.nodePath === "string") {
        represented.add(element.customData.nodePath);
      }
      for (const subnetId of element.customData?.terraformSubnetIds || []) {
        representedSubnetIds.add(subnetId);
      }
      for (const resource of element.customData?.terraformResources || []) {
        if (typeof resource.address === "string") {
          represented.add(resource.address);
        }
      }
    }
    for (const rc of plan.resource_changes || []) {
      if (rc.type === "aws_vpc") {
        represented.add(rc.address);
      }
      const after = rc.change?.after || rc.change?.before || {};
      if (rc.type === "aws_subnet" && representedSubnetIds.has(after.id)) {
        represented.add(rc.address);
      }
      if (rc.type === "aws_iam_policy_document") {
        represented.add(rc.address);
      }
    }
    const omitted = (plan.resource_changes || []).filter(
      (rc: any) => !represented.has(rc.address),
    );
    const omittedTypes = omitted.map((rc: any) => rc.type).sort();
    expect(omittedTypes).toEqual(
      [
        ...Array(6).fill("aws_route_table_association"),
        "aws_sqs_queue_policy",
        "aws_sqs_queue_policy",
        "aws_sqs_queue_redrive_allow_policy",
        "aws_sqs_queue_redrive_policy",
        "terraform_data",
        "terraform_data",
        "terraform_data",
      ].sort(),
    );
    expect(body.meta?.representedResourceCount).toBe(96);
    expect(body.meta?.omittedResourceCount).toBe(3);

    const zd = body.meta?.zoneRouteAnchorDebug as
      | Array<{
          zoneContentBodyHPx: number;
          routeAnchorBodyHPx: number;
        }>
      | undefined;
    if (Array.isArray(zd) && zd.length > 0) {
      expect(
        zd.some((r) => r.zoneContentBodyHPx < r.routeAnchorBodyHPx - 1),
      ).toBe(true);
    }
  }, 60_000);

  /**
   * Serialized semantic response (same contract as saved scenes): frames must fully contain
   * direct children or Excalidraw will clip — catches route-table / primaryCluster overflow.
   */
  it("allplanmodules semantic: topology frames contain direct children (layout sanity)", async () => {
    const planText = fs.readFileSync(PLAN_FIXTURE, "utf8");
    const dotText = fs.readFileSync(DOT_FIXTURE, "utf8");

    const res = await terraformPlanParsing(
      textFileLike(planText),
      textFileLike(dotText),
      null,
      { semanticLayout: true },
    );
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.meta?.layoutEngine).toBe("topology");

    type SerEl = {
      type?: string;
      id?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      frameId?: string | null;
      isDeleted?: boolean;
      customData?: { terraformTopologyRole?: string };
    };

    const elements = body.elements as SerEl[];
    /** Library AWS glyphs / small markers can extend a few px past shrink-wrapped frames. */
    const eps = 12;
    const axisBounds = (el: SerEl) => {
      const w = el.width ?? 0;
      const h = el.height ?? 0;
      return {
        minX: el.x ?? 0,
        minY: el.y ?? 0,
        maxX: (el.x ?? 0) + w,
        maxY: (el.y ?? 0) + h,
      };
    };
    const isTopoFrame = (e: SerEl) =>
      e.type === "frame" && Boolean(e.customData?.terraformTopologyRole);

    const frames = elements.filter(isTopoFrame);
    expect(frames.length).toBeGreaterThan(0);

    for (const frame of frames) {
      const fid = frame.id;
      if (!fid) {
        continue;
      }
      const kids = elements.filter((e) => e.frameId === fid && !e.isDeleted);
      if (kids.length === 0) {
        continue;
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const c of kids) {
        const b = axisBounds(c);
        minX = Math.min(minX, b.minX);
        minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX);
        maxY = Math.max(maxY, b.maxY);
      }
      const fb = axisBounds(frame);
      const role = frame.customData?.terraformTopologyRole ?? frame.id;
      expect(fb.minX, `${role} left`).toBeLessThanOrEqual(minX + eps);
      expect(fb.minY, `${role} top`).toBeLessThanOrEqual(minY + eps);
      expect(fb.maxX, `${role} right`).toBeGreaterThanOrEqual(maxX - eps);
      expect(fb.maxY, `${role} bottom`).toBeGreaterThanOrEqual(maxY - eps);
    }
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
