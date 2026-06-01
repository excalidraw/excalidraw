import { describe, expect, it } from "vitest";

import {
  loadStagingMultiStatePlanDotBundlesFromDb,
  readStagingMultiStatePipelineTfdFromDb,
  STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
} from "../test-fixtures/terraformPresetFixtures";

import { terraformPlanParsingFromSources } from "./terraformPlanParsing";

type SceneEl = {
  id: string;
  type?: string;
  name?: string | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  frameId?: string | null;
  customData?: {
    terraformTopologyRole?: string;
    terraformSubnetIds?: string[];
    nodePath?: string;
    terraformVisibilityRole?: string;
  };
};

function parentFrameId(elements: SceneEl[], childId: string): string | null {
  for (const el of elements) {
    if (el.type !== "frame" || !("children" in el)) {
      continue;
    }
    const children = (el as { children?: readonly string[] }).children;
    if (children?.includes(childId)) {
      return el.id;
    }
  }
  return null;
}

function ancestorFrameWithRole(
  elements: SceneEl[],
  startId: string,
  role: string,
): SceneEl | null {
  const byId = new Map(elements.map((e) => [e.id, e]));
  let current: string | null | undefined = startId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const el = byId.get(current);
    if (el?.type === "frame" && el.customData?.terraformTopologyRole === role) {
      return el;
    }
    current = el?.frameId ?? parentFrameId(elements, current);
  }
  return null;
}

function boundsContain(outer: SceneEl, inner: SceneEl, pad = 2): boolean {
  const ox = outer.x ?? 0;
  const oy = outer.y ?? 0;
  const ow = outer.width ?? 0;
  const oh = outer.height ?? 0;
  const ix = inner.x ?? 0;
  const iy = inner.y ?? 0;
  const iw = inner.width ?? 0;
  const ih = inner.height ?? 0;
  return (
    ix >= ox - pad &&
    iy >= oy - pad &&
    ix + iw <= ox + ow + pad &&
    iy + ih <= oy + oh + pad
  );
}

function resourceTile(
  elements: SceneEl[],
  nodePathPart: string,
): SceneEl | undefined {
  return elements.find(
    (e) =>
      e.type === "rectangle" &&
      e.customData?.terraformVisibilityRole === "resource" &&
      typeof e.customData?.nodePath === "string" &&
      e.customData.nodePath.includes(nodePathPart),
  );
}

describe("semantic topology subnet containment", () => {
  async function importSemantic() {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const tfd = readStagingMultiStatePipelineTfdFromDb();
    const res = await terraformPlanParsingFromSources(
      {
        planDotBundles: bundles,
        states: [],
        stateLabels: [],
        tfdTexts: [tfd],
        tfdLabels: ["pipeline.tfd"],
      },
      { semanticLayout: true },
    );
    expect(res.ok).toBe(true);
    return (await res.json()).elements as SceneEl[];
  }

  it(
    "ecs-edge producer primaryCluster is contained in a subnetZone frame",
    async () => {
      const elements = await importSemantic();
      const producer = resourceTile(elements, "aws_ecs_service.producer");
      expect(producer).toBeDefined();

      const cluster = ancestorFrameWithRole(
        elements,
        producer!.frameId ?? producer!.id,
        "primaryCluster",
      );
      expect(cluster).toBeDefined();

      const subnetZone = ancestorFrameWithRole(
        elements,
        cluster!.frameId ?? cluster!.id,
        "subnetZone",
      );
      expect(subnetZone).toBeDefined();
      expect(boundsContain(subnetZone!, cluster!)).toBe(true);
      expect(subnetZone!.name).toMatch(/private/i);
      expect(
        Array.isArray(subnetZone!.customData?.terraformSubnetIds) &&
          subnetZone!.customData!.terraformSubnetIds!.length > 0,
      ).toBe(true);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );

  it(
    "consumer lambda primaryCluster is contained in a subnetZone frame",
    async () => {
      const elements = await importSemantic();
      const lambda = resourceTile(
        elements,
        "module.consumer_lambda.module.lambda.aws_lambda_function",
      );
      expect(lambda).toBeDefined();

      const cluster = ancestorFrameWithRole(
        elements,
        lambda!.frameId ?? lambda!.id,
        "primaryCluster",
      );
      expect(cluster).toBeDefined();

      const subnetZone = ancestorFrameWithRole(
        elements,
        cluster!.frameId ?? cluster!.id,
        "subnetZone",
      );
      expect(subnetZone).toBeDefined();
      expect(boundsContain(subnetZone!, cluster!)).toBe(true);
      expect(subnetZone!.name).toMatch(/private/i);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );
});
