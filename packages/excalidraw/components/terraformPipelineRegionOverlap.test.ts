import { readFileSync } from "fs";
import { join } from "path";

import { describe, expect, it } from "vitest";

import { loadStagingMultiStatePlanDotBundlesFromDb } from "../test-fixtures/terraformPresetFixtures";

import { terraformPlanParsingFromSources } from "./terraformPlanParsing";

import type { TerraformPipelineVerticalSolverMode } from "./terraformPipelineLayoutMode";

type SceneEl = {
  id: string;
  type?: string;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  frameId?: string | null;
  customData?: {
    terraformTopologyRole?: string;
    terraformTopologyPath?: string[];
    terraformVisibilityRole?: string;
    nodePath?: string;
  };
};

function readStagingPipelineTfdFromRepo(): string {
  return readFileSync(
    join(
      process.cwd(),
      "packages/backend/terraform/staging-multi-state/pipeline.tfd",
    ),
    "utf8",
  );
}

function descendantsOfFrame(
  elements: SceneEl[],
  frameId: string,
): SceneEl[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  return elements.filter((el) => {
    let cur: string | null | undefined = el.frameId;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      if (cur === frameId) {
        return true;
      }
      cur = byId.get(cur)?.frameId;
    }
    return false;
  });
}

function regionFramesForName(elements: SceneEl[], regionName: string) {
  return elements.filter(
    (e) =>
      e.type === "frame" &&
      e.customData?.terraformTopologyRole === "region" &&
      e.customData?.terraformTopologyPath?.[1] === regionName,
  );
}

function ancestorRegionFrame(
  elements: SceneEl[],
  startId: string,
  regionName: string,
): SceneEl | null {
  const byId = new Map(elements.map((e) => [e.id, e]));
  let current: string | null | undefined = startId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const el = byId.get(current);
    if (
      el?.type === "frame" &&
      el.customData?.terraformTopologyRole === "region" &&
      el.customData?.terraformTopologyPath?.[1] === regionName
    ) {
      return el;
    }
    current = el?.frameId ?? null;
  }
  return null;
}

function rectsOverlap(
  a: { x?: number; y?: number; width?: number; height?: number },
  b: { x?: number; y?: number; width?: number; height?: number },
  tolerance = 4,
): boolean {
  const ax = a.x ?? 0;
  const ay = a.y ?? 0;
  const ar = ax + (a.width ?? 0);
  const ab = ay + (a.height ?? 0);
  const bx = b.x ?? 0;
  const by = b.y ?? 0;
  const br = bx + (b.width ?? 0);
  const bb = by + (b.height ?? 0);
  return (
    ax < br - tolerance &&
    ar > bx + tolerance &&
    ay < bb - tolerance &&
    ab > by + tolerance
  );
}

function assertStagingRegionContainment(elements: SceneEl[]): void {
  const eastRegions = regionFramesForName(elements, "us-east-1");
  const westRegions = regionFramesForName(elements, "us-west-2");
  expect(eastRegions.length).toBeGreaterThanOrEqual(2);
  expect(westRegions.length).toBeGreaterThanOrEqual(1);

  const mismatches: string[] = [];
  for (const rf of eastRegions) {
    const desc = descendantsOfFrame(elements, rf.id);
    for (const r of desc) {
      if (
        r.type === "rectangle" &&
        r.customData?.terraformVisibilityRole === "resource" &&
        typeof r.customData?.nodePath === "string" &&
        /(50|51|52|53)-west-/.test(r.customData.nodePath)
      ) {
        mismatches.push(r.customData.nodePath);
      }
    }
  }
  expect(mismatches).toEqual([]);

  const westPrimaries = elements.filter(
    (e) =>
      e.type === "rectangle" &&
      e.customData?.terraformVisibilityRole === "resource" &&
      typeof e.customData?.nodePath === "string" &&
      /(50|51|52|53)-west-/.test(e.customData.nodePath) &&
      e.customData.nodePath.includes("aws_api_gateway_rest_api"),
  );
  expect(westPrimaries.length).toBeGreaterThan(0);

  const firstWestColumn = Math.min(
    ...westRegions.map((w) =>
      Number(w.customData?.terraformTopologyPath?.[2] ?? Infinity),
    ),
  );
  const eastOnlyMaxRight = Math.max(
    ...eastRegions
      .filter(
        (f) =>
          Number(f.customData?.terraformTopologyPath?.[3] ?? 0) <
          firstWestColumn,
      )
      .map((f) => (f.x ?? 0) + (f.width ?? 0)),
    0,
  );
  const westLeft = Math.min(...westPrimaries.map((e) => e.x ?? 0));
  if (eastOnlyMaxRight > 0) {
    expect(westLeft).toBeGreaterThanOrEqual(eastOnlyMaxRight - 4);
  }

  const westStackResources = elements.filter(
    (e) =>
      e.type === "rectangle" &&
      e.customData?.terraformVisibilityRole === "resource" &&
      typeof e.customData?.nodePath === "string" &&
      /(50|51|52|53)-west-/.test(e.customData.nodePath),
  );
  expect(westStackResources.length).toBeGreaterThan(0);

  const bboxMismatches: string[] = [];
  for (const rf of eastRegions) {
    const maxColumn = Number(rf.customData?.terraformTopologyPath?.[3] ?? 0);
    if (maxColumn >= firstWestColumn) {
      continue;
    }
    for (const resource of westStackResources) {
      if (rectsOverlap(rf, resource)) {
        bboxMismatches.push(resource.customData!.nodePath!);
      }
    }
  }
  expect(bboxMismatches).toEqual([]);

  for (const resource of westStackResources) {
    const westRegion = ancestorRegionFrame(
      elements,
      resource.frameId ?? resource.id,
      "us-west-2",
    );
    expect(westRegion).toBeDefined();
    expect(rectsOverlap(westRegion!, resource)).toBe(true);
  }
}

describe("staging pipeline region overlap", () => {
  it.each([
    "none",
    "track-rows",
    "track-rows-reorder",
    "straight-y",
    "straight-reorder",
    "straight-relay",
    "constrained-ls",
    "elk",
    "exact-qp",
  ] as const)(
    "keeps west resources out of east region frames (%s)",
    async (pipelineVerticalSolverMode: TerraformPipelineVerticalSolverMode) => {
      const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
      const tfd = readStagingPipelineTfdFromRepo();
      const res = await terraformPlanParsingFromSources(
        {
          planDotBundles: bundles,
          states: [],
          stateLabels: [],
          tfdTexts: [tfd],
          tfdLabels: ["pipeline.tfd"],
        },
        { pipelineLayout: true, pipelineVerticalSolverMode },
      );
      expect(res.ok).toBe(true);
      const body = await res.json();
      assertStagingRegionContainment(body.elements as SceneEl[]);
    },
    180_000,
  );
});
