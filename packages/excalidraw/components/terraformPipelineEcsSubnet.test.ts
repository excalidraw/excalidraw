import { describe, expect, it } from "vitest";

import {
  loadStagingMultiStatePlanDotBundlesFromDb,
  readStagingMultiStatePipelineTfdFromDb,
} from "../test-fixtures/terraformPresetFixtures";

import { buildPipelineAtomGeoMap } from "./terraformPipelineGeo";
import { buildPipelineAtomGraph } from "./terraformPipelineAtoms";
import { extractPrimaryTopologyZones } from "./terraformTopologyPlacement";
import { applyDeclaredDataFlowFromMany } from "./terraformDeclaredDataFlow";
import {
  mergePlanJsons,
  namespacePlanDotBundles,
} from "./terraformImportMerge";
import { buildTerraformLocalImportNodesMap } from "./terraformPlanParsing";
import { terraformPlanParsingFromSources } from "./terraformPlanParsing";
import type { TerraformPipelineVerticalSolverMode } from "./terraformPipelineLayoutMode";

import graphlibDot from "@dagrejs/graphlib-dot";

type SceneEl = {
  id: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  frameId?: string | null;
  customData?: {
    terraformTopologyRole?: string;
    terraformVisibilityRole?: string;
    nodePath?: string;
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

function boundsContain(
  outer: SceneEl,
  inner: SceneEl,
  pad = 2,
): boolean {
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

describe("ECS pipeline subnet containment", () => {
  async function importPipeline(
    mode: TerraformPipelineVerticalSolverMode = "track-rows",
  ) {
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
      { pipelineLayout: true, pipelineVerticalSolverMode: mode },
    );
    expect(res.ok).toBe(true);
    return (await res.json()).elements as SceneEl[];
  }

  it("ecs-edge producer geo resolves to private subnets", async () => {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const { bundles: namespaced, stackIds } = namespacePlanDotBundles(bundles);
    const merged = mergePlanJsons(
      namespaced.map((b) => b.plan),
      namespaced.map((b) => b.label),
    );
    const graph = graphlibDot.read("digraph G {}\n");
    const nodes = buildTerraformLocalImportNodesMap(merged.plan, graph, [], {
      adjacency: {},
      priorStatePlans: merged.sourcePlans,
      stackIds,
    });
    const tfd = readStagingMultiStatePipelineTfdFromDb();
    applyDeclaredDataFlowFromMany(nodes, [tfd]);
    const atomGraph = buildPipelineAtomGraph(nodes, merged.plan, [tfd])!;
    const zones = extractPrimaryTopologyZones(
      merged.plan as Parameters<typeof extractPrimaryTopologyZones>[0],
    );
    const zoneHits = zones.filter((z) =>
      z.addresses.some((a) => a.includes("aws_ecs_service.producer")),
    );
    expect(zoneHits.length).toBeGreaterThan(0);

    const geoMap = buildPipelineAtomGeoMap(atomGraph, nodes, merged.plan);
    const producer = [...geoMap.entries()].find(([a]) =>
      a.includes("aws_ecs_service.producer"),
    );
    expect(producer).toBeDefined();
    expect(producer![1].tier).not.toBe("regional");
    expect(producer![1].subnetSignature.length).toBeGreaterThan(0);
  }, 120_000);

  it("consumer lambda geo resolves to private subnets", async () => {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const { bundles: namespaced, stackIds } = namespacePlanDotBundles(bundles);
    const merged = mergePlanJsons(
      namespaced.map((b) => b.plan),
      namespaced.map((b) => b.label),
    );
    const graph = graphlibDot.read("digraph G {}\n");
    const nodes = buildTerraformLocalImportNodesMap(merged.plan, graph, [], {
      adjacency: {},
      priorStatePlans: merged.sourcePlans,
      stackIds,
    });
    const tfd = readStagingMultiStatePipelineTfdFromDb();
    applyDeclaredDataFlowFromMany(nodes, [tfd]);
    const atomGraph = buildPipelineAtomGraph(nodes, merged.plan, [tfd])!;
    const geoMap = buildPipelineAtomGeoMap(atomGraph, nodes, merged.plan);
    const consumer = [...geoMap.entries()].find(([a]) =>
      a.includes("consumer_lambda") && a.includes("aws_lambda_function"),
    );
    expect(consumer).toBeDefined();
    expect(consumer![1].tier).toBe("private");
    expect(consumer![1].vpcId).toMatch(/^vpc-/);
    expect(consumer![1].subnetSignature.length).toBeGreaterThan(0);
  }, 120_000);

  it("ecs producer primaryCluster is contained in a subnetZone frame", async () => {
    const elements = await importPipeline("track-rows");
    const producer = elements.find(
      (e) =>
        e.type === "rectangle" &&
        e.customData?.terraformVisibilityRole === "resource" &&
        e.customData?.nodePath?.includes("aws_ecs_service.producer"),
    );
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
  }, 180_000);

  it("consumer lambda primaryCluster is contained in a subnetZone frame", async () => {
    const elements = await importPipeline("track-rows");
    const lambda = elements.find(
      (e) =>
        e.type === "rectangle" &&
        e.customData?.terraformVisibilityRole === "resource" &&
        e.customData?.nodePath?.includes("consumer_lambda") &&
        e.customData?.nodePath?.includes("aws_lambda_function"),
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
  }, 180_000);

  it("ecs security group satellite shares subnetZone with producer", async () => {
    const elements = await importPipeline("track-rows");
    const sg = elements.find(
      (e) =>
        e.type === "rectangle" &&
        e.customData?.nodePath?.includes("aws_security_group.ecs_service"),
    );
    expect(sg).toBeDefined();
    const sgZone = ancestorFrameWithRole(
      elements,
      sg!.frameId ?? sg!.id,
      "subnetZone",
    );
    expect(sgZone).toBeDefined();
    const producer = elements.find(
      (e) =>
        e.type === "rectangle" &&
        e.customData?.nodePath?.includes("aws_ecs_service.producer"),
    )!;
    const producerZone = ancestorFrameWithRole(
      elements,
      producer.frameId ?? producer.id,
      "subnetZone",
    );
    expect(producerZone?.id).toBe(sgZone?.id);
  }, 180_000);
});
