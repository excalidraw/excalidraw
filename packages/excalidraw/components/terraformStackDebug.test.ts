import { describe, expect, it } from "vitest";

import {
  loadStagingMultiStatePlanDotBundlesFromDb,
  readStagingMultiStatePipelineTfdFromDb,
} from "../test-fixtures/terraformPresetFixtures";

import { analyzeTerraformNestedLayout } from "./terraformNestedLayoutDebug";
import { terraformPlanParsingFromSources } from "./terraformPlanParsing";

describe("staging multi-state import", () => {
  it("imports semantic layout without per-stack visual frames", async () => {
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
    const body = await res.json();
    expect(body.meta?.stackIds?.length).toBe(9);
    expect(body.elements.length).toBeGreaterThan(0);

    const stackFrames = body.elements.filter(
      (e: { type?: string; customData?: { terraformTopologyRole?: string } }) =>
        e.type === "frame" && e.customData?.terraformTopologyRole === "stack",
    );
    expect(stackFrames).toHaveLength(0);

    const nested = analyzeTerraformNestedLayout(body.elements);
    expect(nested.orphanExplodeParents).toBe(0);

    const apiGateways = body.elements.filter(
      (e: { customData?: { resourceType?: string; nodePath?: string } }) =>
        e.customData?.resourceType === "aws_api_gateway_rest_api" ||
        e.customData?.nodePath?.endsWith(
          "module.api.aws_api_gateway_rest_api.private",
        ),
    );
    expect(apiGateways.length).toBeGreaterThanOrEqual(5);
    expect(apiGateways.some((e: { isDeleted?: boolean }) => !e.isDeleted)).toBe(
      true,
    );

    const framesById = new Map<
      string,
      {
        terraformTopologyRole?: string;
        terraformTopologyPath?: string[];
      }
    >(
      body.elements
        .filter(
          (e: { type?: string; id?: string }) => e.type === "frame" && e.id,
        )
        .map(
          (e: {
            id: string;
            customData?: {
              terraformTopologyRole?: string;
              terraformTopologyPath?: string[];
            };
          }) => [e.id, e.customData ?? {}],
        ),
    );
    const privateApiTiles = apiGateways.filter(
      (e: { customData?: { nodePath?: string }; isDeleted?: boolean }) =>
        !e.isDeleted &&
        typeof e.customData?.nodePath === "string" &&
        e.customData.nodePath.endsWith(
          "module.api.aws_api_gateway_rest_api.private",
        ),
    );
    expect(privateApiTiles.length).toBeGreaterThanOrEqual(5);
    for (const api of privateApiTiles) {
      const clusterFrame = framesById.get(
        (api as { frameId?: string }).frameId ?? "",
      );
      expect(clusterFrame?.terraformTopologyRole).toBe("primaryCluster");
      const path = clusterFrame?.terraformTopologyPath ?? [];
      expect(path.length).toBeGreaterThanOrEqual(4);
      expect(path[2]).toMatch(/^vpc-/);
    }

    const ecsEdgeLb = body.elements.filter(
      (e: { customData?: { nodePath?: string; resourceType?: string } }) =>
        e.customData?.nodePath?.startsWith("10-east-ecs-edge::aws_lb.") &&
        e.customData?.resourceType === "aws_lb",
    );
    expect(ecsEdgeLb.length).toBeGreaterThanOrEqual(1);

    const ecsEdgeListener = body.elements.find(
      (e: { customData?: { nodePath?: string } }) =>
        e.customData?.nodePath === "10-east-ecs-edge::aws_lb_listener.http",
    );
    const ecsEdgeTg = body.elements.find(
      (e: { customData?: { nodePath?: string } }) =>
        e.customData?.nodePath === "10-east-ecs-edge::aws_lb_target_group.ecs",
    );
    expect(ecsEdgeListener).toBeDefined();
    expect(ecsEdgeTg).toBeDefined();
    expect(ecsEdgeListener!.isDeleted).not.toBe(true);
    expect(ecsEdgeTg!.isDeleted).not.toBe(true);
    expect(ecsEdgeListener!.frameId).toBe(ecsEdgeLb[0]!.frameId);
    expect(ecsEdgeTg!.frameId).toBe(ecsEdgeLb[0]!.frameId);

    const ecsEdgeSg = body.elements.find(
      (e: { customData?: { nodePath?: string } }) =>
        e.customData?.nodePath === "10-east-ecs-edge::aws_security_group.alb",
    );
    expect(ecsEdgeSg).toBeDefined();
    expect(ecsEdgeSg!.frameId).toBe(ecsEdgeLb[0]!.frameId);

    const duplicateUnqualifiedSg = body.elements.filter(
      (e: { customData?: { nodePath?: string; resourceType?: string } }) =>
        e.customData?.nodePath === "aws_security_group.alb" &&
        e.customData?.resourceType === "aws_security_group",
    );
    expect(duplicateUnqualifiedSg).toHaveLength(0);

    const stackIds: string[] = body.meta?.stackIds ?? [];
    const qualifiedPaths = new Set(
      body.elements
        .map(
          (e: { customData?: { nodePath?: string } }) => e.customData?.nodePath,
        )
        .filter(
          (p: unknown): p is string =>
            typeof p === "string" && p.includes("::"),
        ),
    );
    const barePaths = body.elements
      .map(
        (e: { customData?: { nodePath?: string } }) => e.customData?.nodePath,
      )
      .filter(
        (p: unknown): p is string =>
          typeof p === "string" && !p.includes("::") && /^aws_/.test(p),
      );
    for (const bare of barePaths) {
      const hasQualifiedAlias = stackIds.some((stackId) =>
        qualifiedPaths.has(`${stackId}::${bare}`),
      );
      expect(hasQualifiedAlias).toBe(false);
    }

    const declared = body.elements.filter(
      (e: { type?: string; customData?: { terraformEdgeLayer?: string } }) =>
        e.type === "arrow" &&
        e.customData?.terraformEdgeLayer === "declaredDataFlow",
    );
    expect(declared).toHaveLength(20);
  }, 180_000);

  it("imports module layout quickly via ELK fast path for dense multi-stack graph", async () => {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const tfd = readStagingMultiStatePipelineTfdFromDb();
    const t0 = performance.now();
    const res = await terraformPlanParsingFromSources(
      {
        planDotBundles: bundles,
        states: [],
        stateLabels: [],
        tfdTexts: [tfd],
        tfdLabels: ["pipeline.tfd"],
      },
      { semanticLayout: false },
    );
    const ms = performance.now() - t0;
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.meta?.layoutEngine).toBe("elk");
    expect(body.meta?.elkFastPath).toBe(true);
    expect(body.meta?.moduleGridLayout).toBe(true);
    expect(body.meta?.modulePacking?.mode).toBe("default");
    expect(body.elements.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(15_000);

    const stackGroupFrames = body.elements.filter(
      (e: { type?: string; name?: string }) =>
        e.type === "frame" &&
        typeof e.name === "string" &&
        /^\d{2}-/.test(e.name),
    );
    expect(stackGroupFrames.length).toBeGreaterThanOrEqual(9);

    const rootFrame = body.elements.find(
      (e: { type?: string; name?: string }) =>
        e.type === "frame" && e.name === "Root module",
    );
    expect(rootFrame).toBeDefined();
    const rootChildFrames = body.elements.filter(
      (e: { type?: string; frameId?: string | null }) =>
        e.type === "frame" && e.frameId === rootFrame!.id,
    );
    expect(rootChildFrames.length).toBeGreaterThanOrEqual(9);

    const xs = rootChildFrames.map((e: { x?: number }) => e.x ?? 0);
    const ys = rootChildFrames.map((e: { y?: number }) => e.y ?? 0);
    const xSpread = Math.max(...xs) - Math.min(...xs);
    const ySpread = Math.max(...ys) - Math.min(...ys);
    expect(xSpread).toBeGreaterThan(ySpread);

    const moduleApiFrames = body.elements.filter(
      (e: { type?: string; name?: string }) =>
        e.type === "frame" && e.name?.includes("/ module.api"),
    );
    expect(moduleApiFrames.length).toBeGreaterThanOrEqual(5);
    const frameNames = new Set(
      moduleApiFrames.map((e: { name?: string }) => e.name),
    );
    expect(frameNames.size).toBeGreaterThanOrEqual(5);
  }, 60_000);
});
