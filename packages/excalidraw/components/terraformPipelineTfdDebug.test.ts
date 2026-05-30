import { describe, expect, it } from "vitest";

import graphlibDot from "@dagrejs/graphlib-dot";

import {
  loadStagingMultiStatePlanDotBundlesFromDb,
  readStagingMultiStatePipelineTfdFromDb,
} from "../test-fixtures/terraformPresetFixtures";

import { applyDeclaredDataFlowFromMany } from "./terraformDeclaredDataFlow";
import {
  namespacePlanDotBundles,
  mergePlanJsons,
} from "./terraformImportMerge";
import { buildTerraformLocalImportNodesMap } from "./terraformPlanParsing";
import { terraformPlanParsingFromSources } from "./terraformPlanParsing";

type SceneElement = {
  id: string;
  type?: string;
  frameId?: string | null;
  children?: readonly string[];
  customData?: {
    terraformTopologyRole?: string;
    terraformTopologyPath?: string[];
    terraformVisibilityRole?: string;
    nodePath?: string;
  };
};

function parentFrameId(
  elements: SceneElement[],
  childId: string,
): string | null {
  for (const el of elements) {
    if (el.type !== "frame" || !el.children) {
      continue;
    }
    if (el.children.includes(childId)) {
      return el.id;
    }
  }
  return null;
}

function ancestorFrameWithRole(
  elements: SceneElement[],
  startId: string,
  role: string,
): SceneElement | null {
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

function primaryResourceForNodePath(
  elements: SceneElement[],
  nodePathSuffix: string,
): SceneElement | undefined {
  return elements.find(
    (e) =>
      e.type === "rectangle" &&
      e.customData?.terraformVisibilityRole === "resource" &&
      typeof e.customData.nodePath === "string" &&
      e.customData.nodePath.endsWith(nodePathSuffix),
  );
}

function expectSameSubnetZone(
  elements: SceneElement[],
  nodePathSuffixA: string,
  nodePathSuffixB: string,
): void {
  const a = primaryResourceForNodePath(elements, nodePathSuffixA);
  const b = primaryResourceForNodePath(elements, nodePathSuffixB);
  expect(a).toBeDefined();
  expect(b).toBeDefined();
  const zoneA = ancestorFrameWithRole(
    elements,
    a!.frameId ?? a!.id,
    "subnetZone",
  );
  const zoneB = ancestorFrameWithRole(
    elements,
    b!.frameId ?? b!.id,
    "subnetZone",
  );
  expect(zoneA).toBeDefined();
  expect(zoneB).toBeDefined();
  expect(zoneA!.id).toBe(zoneB!.id);
}

function expectDifferentSubnetZone(
  elements: SceneElement[],
  nodePathSuffixA: string,
  nodePathSuffixB: string,
): void {
  const a = primaryResourceForNodePath(elements, nodePathSuffixA);
  const b = primaryResourceForNodePath(elements, nodePathSuffixB);
  expect(a).toBeDefined();
  expect(b).toBeDefined();
  const zoneA = ancestorFrameWithRole(
    elements,
    a!.frameId ?? a!.id,
    "subnetZone",
  );
  const zoneB = ancestorFrameWithRole(
    elements,
    b!.frameId ?? b!.id,
    "subnetZone",
  );
  expect(zoneA).toBeDefined();
  expect(zoneB).toBeDefined();
  expect(zoneA!.id).not.toBe(zoneB!.id);
}

describe("staging pipeline.tfd resolution", () => {
  it("new stack-qualified pipeline.tfd resolves all 20 edges", async () => {
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
    const { edges, errors } = applyDeclaredDataFlowFromMany(nodes, [tfd]);
    expect(errors).toEqual([]);
    expect(edges).toHaveLength(20);
  }, 120_000);

  it("new pipeline.tfd draws all 20 declared arrows in semantic layout", async () => {
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
    const declared = body.elements.filter(
      (e: { type?: string; customData?: { terraformEdgeLayer?: string } }) =>
        e.type === "arrow" &&
        e.customData?.terraformEdgeLayer === "declaredDataFlow",
    );
    expect(declared).toHaveLength(20);
  }, 180_000);

  it("pipeline layout draws 20 declared arrows and omits unbound resources", async () => {
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
      { pipelineLayout: true },
    );
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.meta?.layoutEngine).toBe("pipeline");

    const declared = body.elements.filter(
      (e: { type?: string; customData?: { terraformEdgeLayer?: string } }) =>
        e.type === "arrow" &&
        e.customData?.terraformEdgeLayer === "declaredDataFlow",
    );
    expect(declared).toHaveLength(20);

    const resourceRects = body.elements.filter(
      (e: {
        type?: string;
        customData?: { terraformVisibilityRole?: string; nodePath?: string };
      }) =>
        e.type === "rectangle" &&
        e.customData?.terraformVisibilityRole === "resource" &&
        typeof e.customData?.nodePath === "string",
    );
    const nodePaths = new Set<string>(
      resourceRects.map(
        (e: { customData: { nodePath: string } }) => e.customData.nodePath,
      ),
    );
    expect(nodePaths.has("10-east-ecs-edge::aws_lb.ecs")).toBe(true);
    expect(nodePaths.has("10-east-ecs-edge::aws_lb_listener.http")).toBe(true);
    expect(nodePaths.has("01-west-network::aws_vpc.main")).toBe(false);

    const lbClusters = body.elements.filter(
      (e: {
        type?: string;
        name?: string;
        customData?: { terraformTopologyRole?: string };
      }) =>
        e.type === "frame" &&
        e.customData?.terraformTopologyRole === "primaryCluster" &&
        String(e.name ?? "").includes("aws_lb"),
    );
    expect(lbClusters.length).toBe(1);

    const apiPrimaries = [...nodePaths].filter((p) =>
      p.includes("aws_api_gateway_rest_api"),
    );
    expect(apiPrimaries).toHaveLength(5);

    const ssmRects = resourceRects.filter(
      (e: { customData: { nodePath: string } }) =>
        e.customData.nodePath.includes("aws_ssm_parameter"),
    );
    expect(ssmRects).toHaveLength(5);

    expect(body.meta?.geoInstanceCount).toBeGreaterThanOrEqual(2);
    expect(body.meta?.atomCount).toBe(19);
    expect(body.meta?.declaredEdgeCount).toBe(20);
    expect(body.meta?.columnCount).toBe(7);

    const frames = body.elements.filter(
      (e: { type?: string; id?: string }) => e.type === "frame",
    );
    const frameIds = frames.map((e: { id: string }) => e.id);
    expect(frameIds.length).toBe(new Set(frameIds).size);

    const vpcFrames = frames.filter(
      (e: { customData?: { terraformTopologyRole?: string } }) =>
        e.customData?.terraformTopologyRole === "vpc",
    );
    expect(vpcFrames.length).toBe(2);

    const lambdaRects = resourceRects.filter(
      (e: { customData: { nodePath: string } }) =>
        e.customData.nodePath.includes("aws_lambda_function") &&
        e.customData.nodePath.includes("api"),
    );
    expect(lambdaRects.length).toBe(5);
    const lambdaXs = lambdaRects.map((e: { x: number }) => e.x);
    expect(Math.max(...lambdaXs) - Math.min(...lambdaXs)).toBeLessThan(8);

    const ssmXs = ssmRects.map((e: { x: number }) => e.x);
    expect(Math.max(...ssmXs) - Math.min(...ssmXs)).toBeLessThan(8);

    const zoneFrames = frames.filter(
      (e: {
        customData?: { terraformTopologyRole?: string };
        height?: number;
      }) =>
        e.customData?.terraformTopologyRole === "subnetZone" ||
        e.customData?.terraformTopologyRole === "regionalBand",
    );
    for (const zf of zoneFrames) {
      if (zf.customData?.terraformTopologyRole === "regionalBand") {
        continue;
      }
      expect(zf.height ?? 0).toBeGreaterThanOrEqual(80);
    }

    const rectByPath = new Map<
      string,
      { id: string; y: number; height: number }
    >(
      resourceRects.map(
        (e: {
          id: string;
          y: number;
          height: number;
          customData: { nodePath: string };
        }) => [e.customData.nodePath, { id: e.id, y: e.y, height: e.height }],
      ),
    );

    const midY = (e: { y: number; height: number }) => e.y + e.height / 2;

    const trunkPaths = [
      "10-east-ecs-edge::aws_lb.ecs",
      "10-east-ecs-edge::aws_ecs_service.producer",
      "20-east-messaging::module.queue.module.queue.aws_sqs_queue.this[0]",
      "20-east-messaging::module.consumer_lambda.module.lambda.aws_lambda_function.this[0]",
    ];
    const trunkMidYs = trunkPaths.map((p) => midY(rectByPath.get(p)!));
    expect(Math.max(...trunkMidYs) - Math.min(...trunkMidYs)).toBeLessThan(4);

    const apiRects = [...nodePaths]
      .filter((p) => p.includes("aws_api_gateway_rest_api"))
      .map((p) => rectByPath.get(p)!)
      .sort((a, b) => midY(a) - midY(b));
    const apiLambdaRects = resourceRects
      .filter(
        (e: { customData: { nodePath: string } }) =>
          e.customData.nodePath.includes("aws_lambda_function") &&
          e.customData.nodePath.includes("api"),
      )
      .sort(
        (a: { y: number; height: number }, b: { y: number; height: number }) =>
          midY(a) - midY(b),
      );
    const ssmSorted = [...ssmRects].sort(
      (a: { y: number; height: number }, b: { y: number; height: number }) =>
        midY(a) - midY(b),
    );

    expect(apiRects.length).toBe(5);
    expect(apiLambdaRects.length).toBe(5);
    for (let lane = 0; lane < 5; lane++) {
      expect(
        Math.abs(midY(apiRects[lane]!) - midY(apiLambdaRects[lane]!)),
      ).toBeLessThan(4);
      expect(
        Math.abs(midY(apiLambdaRects[lane]!) - midY(ssmSorted[lane]!)),
      ).toBeLessThan(4);
    }

    const findArrow = (sourcePath: string, targetPath: string) => {
      const src = rectByPath.get(sourcePath);
      const tgt = rectByPath.get(targetPath);
      if (!src || !tgt) {
        return undefined;
      }
      return declared.find(
        (a: {
          startBinding?: { elementId?: string };
          endBinding?: { elementId?: string };
          points?: readonly (readonly number[])[];
        }) =>
          a.startBinding?.elementId === src.id &&
          a.endBinding?.elementId === tgt.id,
      );
    };

    const arrowDeltaY = (arrow: {
      points?: readonly (readonly number[])[];
    }) => {
      const pts = arrow.points;
      if (!pts || pts.length < 2) {
        return Infinity;
      }
      const end = pts[pts.length - 1]!;
      return Math.abs(end[1] ?? 0);
    };

    const horizontalPairs: [string, string][] = [
      [
        "10-east-ecs-edge::aws_ecs_service.producer",
        "20-east-messaging::module.queue.module.queue.aws_sqs_queue.this[0]",
      ],
      [
        "40-east-api-1::module.api.aws_api_gateway_rest_api.private",
        "40-east-api-1::module.api.module.lambda_service.module.lambda.aws_lambda_function.this[0]",
      ],
      [
        "41-east-api-2::module.api.aws_api_gateway_rest_api.private",
        "41-east-api-2::module.api.module.lambda_service.module.lambda.aws_lambda_function.this[0]",
      ],
      [
        "40-east-api-1::module.api.module.lambda_service.module.lambda.aws_lambda_function.this[0]",
        "40-east-api-1::module.api.aws_ssm_parameter.api_name",
      ],
    ];

    for (const [src, tgt] of horizontalPairs) {
      const arrow = findArrow(src, tgt);
      expect(arrow).toBeTruthy();
      expect(arrowDeltaY(arrow!)).toBeLessThan(4);
    }

    const fanoutArrow = findArrow(
      "20-east-messaging::module.consumer_lambda.module.lambda.aws_lambda_function.this[0]",
      "40-east-api-1::module.api.aws_api_gateway_rest_api.private",
    );
    expect(fanoutArrow).toBeTruthy();
    expect(arrowDeltaY(fanoutArrow!)).toBeGreaterThan(4);

    const insideVertically = (
      inner: { y: number; height: number },
      outer: { y: number; height: number },
      tolerance = 1,
    ) =>
      inner.y >= outer.y - tolerance &&
      inner.y + inner.height <= outer.y + outer.height + tolerance;

    const lambdaPrimaryFromApiPermission = (nodePath: string) => {
      const stack = nodePath.split("::")[0] ?? nodePath;
      return `${stack}::module.api.module.lambda_service.module.lambda.aws_lambda_function.this[0]`;
    };

    const permissionRects = body.elements.filter(
      (e: {
        type?: string;
        y: number;
        height: number;
        customData?: { resourceType?: string; nodePath?: string };
      }) =>
        e.type === "rectangle" &&
        e.customData?.resourceType === "aws_lambda_permission" &&
        typeof e.customData?.nodePath === "string" &&
        e.customData.nodePath.includes("east-api"),
    );
    expect(permissionRects.length).toBeGreaterThanOrEqual(5);

    const clusterPrimaryAddress = (frame: {
      customData?: { terraformTopologyPath?: string[] };
    }) => {
      const path = frame.customData?.terraformTopologyPath;
      return path?.[path.length - 1];
    };

    for (const perm of permissionRects) {
      const lambdaPrimary = lambdaPrimaryFromApiPermission(
        perm.customData.nodePath,
      );
      const cluster = frames.find(
        (e: {
          customData?: {
            terraformTopologyRole?: string;
            terraformTopologyPath?: string[];
          };
          y: number;
          height: number;
        }) =>
          e.customData?.terraformTopologyRole === "primaryCluster" &&
          clusterPrimaryAddress(e) === lambdaPrimary,
      );
      expect(cluster).toBeTruthy();
      expect(insideVertically(perm, cluster!)).toBe(true);
    }

    const api5Permission = permissionRects.find(
      (p: { customData: { nodePath: string } }) =>
        p.customData.nodePath.startsWith("44-east-api-5::"),
    );
    expect(api5Permission).toBeTruthy();

    const api5LambdaPrimary =
      "44-east-api-5::module.api.module.lambda_service.module.lambda.aws_lambda_function.this[0]";
    const api5Cluster = frames.find(
      (e: {
        customData?: {
          terraformTopologyRole?: string;
          terraformTopologyPath?: string[];
        };
        x: number;
        y: number;
        width: number;
        height: number;
      }) =>
        e.customData?.terraformTopologyRole === "primaryCluster" &&
        clusterPrimaryAddress(e) === api5LambdaPrimary,
    );
    expect(api5Cluster).toBeTruthy();

    const subnetZones = zoneFrames.filter(
      (e: { customData?: { terraformTopologyRole?: string } }) =>
        e.customData?.terraformTopologyRole === "subnetZone",
    );
    const api5ClusterCx = api5Cluster!.x + api5Cluster!.width / 2;
    const api5Zone = subnetZones.find(
      (z: { x: number; width: number; y: number; height: number }) =>
        api5ClusterCx >= z.x &&
        api5ClusterCx <= z.x + z.width &&
        insideVertically(api5Cluster!, z),
    );
    expect(api5Zone).toBeTruthy();
    expect(insideVertically(api5Permission!, api5Zone!)).toBe(true);

    const sceneElements = body.elements as SceneElement[];
    const subnetZoneFrames = sceneElements.filter(
      (e) =>
        e.type === "frame" &&
        e.customData?.terraformTopologyRole === "subnetZone",
    );
    expect(subnetZoneFrames.length).toBeLessThan(body.meta?.atomCount ?? 0);

    // Shared east-network VPC: fanout lanes coalesce per column and tier.
    expectSameSubnetZone(
      sceneElements,
      "41-east-api-2::module.api.aws_api_gateway_rest_api.private",
      "42-east-api-3::module.api.aws_api_gateway_rest_api.private",
    );
    expectSameSubnetZone(
      sceneElements,
      "40-east-api-1::module.api.aws_api_gateway_rest_api.private",
      "44-east-api-5::module.api.aws_api_gateway_rest_api.private",
    );
    expectSameSubnetZone(
      sceneElements,
      "41-east-api-2::module.api.module.lambda_service.module.lambda.aws_lambda_function.this[0]",
      "42-east-api-3::module.api.module.lambda_service.module.lambda.aws_lambda_function.this[0]",
    );
    expectDifferentSubnetZone(
      sceneElements,
      "41-east-api-2::module.api.aws_api_gateway_rest_api.private",
      "41-east-api-2::module.api.module.lambda_service.module.lambda.aws_lambda_function.this[0]",
    );
  }, 180_000);
});
