import { readFileSync } from "fs";
import { join } from "path";

import { describe, expect, it } from "vitest";

import { loadStagingMultiStatePlanDotBundlesFromDb } from "../test-fixtures/terraformPresetFixtures";

import { terraformPlanParsingFromSources } from "./terraformPlanParsing";

type SceneEl = {
  id: string;
  type?: string;
  name?: string;
  x?: number;
  width?: number;
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

describe("staging pipeline region overlap", () => {
  it("keeps west resources out of east region frames and separates horizontal bounds", async () => {
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
      { pipelineLayout: true },
    );
    expect(res.ok).toBe(true);
    const body = await res.json();
    const elements = body.elements as SceneEl[];

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
  }, 180_000);
});
