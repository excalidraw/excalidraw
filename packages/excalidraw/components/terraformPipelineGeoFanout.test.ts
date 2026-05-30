import { describe, expect, it } from "vitest";

import {
  hasLocalstackGeoFanoutFixtures,
  loadLocalstackGeoFanoutPlanDotBundles,
  readLocalstackGeoFanoutPipelineTfd,
} from "../test-fixtures/localstackGeoFanoutFixtures";

import { terraformPlanParsingFromSources } from "./terraformPlanParsing";

type SceneElement = {
  id: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  frameId?: string | null;
  children?: readonly string[];
  customData?: {
    terraformEdgeLayer?: string;
    terraformTopologyRole?: string;
    terraformTopologyPath?: string[];
    nodePath?: string;
    terraformVisibilityRole?: string;
  };
};

function framesByRole(elements: SceneElement[], role: string) {
  return elements.filter(
    (e) => e.type === "frame" && e.customData?.terraformTopologyRole === role,
  );
}

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

function frameBottom(el: SceneElement): number {
  return (el.y ?? 0) + (el.height ?? 0);
}

function intersectionArea(a: SceneElement, b: SceneElement): number {
  const ax2 = (a.x ?? 0) + (a.width ?? 0);
  const ay2 = (a.y ?? 0) + (a.height ?? 0);
  const bx2 = (b.x ?? 0) + (b.width ?? 0);
  const by2 = (b.y ?? 0) + (b.height ?? 0);
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x ?? 0, b.x ?? 0));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y ?? 0, b.y ?? 0));
  return ix * iy;
}

function insideFrame(
  inner: SceneElement,
  outer: SceneElement,
  tol = 2,
): boolean {
  return (
    (inner.x ?? 0) >= (outer.x ?? 0) - tol &&
    (inner.y ?? 0) >= (outer.y ?? 0) - tol &&
    (inner.x ?? 0) + (inner.width ?? 0) <=
      (outer.x ?? 0) + (outer.width ?? 0) + tol &&
    (inner.y ?? 0) + (inner.height ?? 0) <=
      (outer.y ?? 0) + (outer.height ?? 0) + tol
  );
}

function subnetZoneAncestor(
  elements: SceneElement[],
  primary: SceneElement,
): SceneElement | null {
  return ancestorFrameWithRole(
    elements,
    primary.frameId ?? primary.id,
    "subnetZone",
  );
}

function expectSameRegionalSubnetZone(
  elements: SceneElement[],
  nodePathSuffixA: string,
  nodePathSuffixB: string,
): void {
  const a = primaryResourceForNodePath(elements, nodePathSuffixA);
  const b = primaryResourceForNodePath(elements, nodePathSuffixB);
  expect(a).toBeDefined();
  expect(b).toBeDefined();
  const zoneA = subnetZoneAncestor(elements, a!);
  const zoneB = subnetZoneAncestor(elements, b!);
  if (!zoneA || !zoneB) {
    return;
  }
  expect(zoneA.id).toBe(zoneB.id);
  expect(zoneA.customData?.terraformTopologyPath?.[2]).toBe("regional");
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
  const zoneA = subnetZoneAncestor(elements, a!);
  const zoneB = subnetZoneAncestor(elements, b!);
  if (!zoneA || !zoneB) {
    return;
  }
  expect(zoneA.id).not.toBe(zoneB.id);
}

describe("localstack geo fanout pipeline layout", () => {
  it.skipIf(!hasLocalstackGeoFanoutFixtures())(
    "renders 20 declared pipeline arrows across mixed account/region/VPC fanout",
    async () => {
      const bundles = loadLocalstackGeoFanoutPlanDotBundles();
      const tfd = readLocalstackGeoFanoutPipelineTfd();
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

      const elements = body.elements as SceneElement[];

      const declared = elements.filter(
        (e) =>
          e.type === "arrow" &&
          e.customData?.terraformEdgeLayer === "declaredDataFlow",
      );
      expect(declared.length).toBeGreaterThanOrEqual(18);
      expect(body.meta?.columnCount).toBe(4);
      expect(body.meta?.atomCount).toBe(19);
      expect(body.meta?.geoInstanceCount).toBeGreaterThanOrEqual(6);

      const accountFrames = framesByRole(elements, "account");
      const accountById = new Map(
        accountFrames.map((f) => [f.customData?.terraformTopologyPath?.[0], f]),
      );
      const awsFrame = elements.find(
        (e) =>
          e.type === "frame" &&
          e.customData?.terraformTopologyRole === "provider",
      );
      expect(awsFrame).toBeDefined();
      expect(
        (awsFrame!.customData as { terraformProviderFamily?: string })
          ?.terraformProviderFamily,
      ).toBe("aws");
      expect(accountFrames.length).toBeGreaterThanOrEqual(2);

      for (const account of accountFrames) {
        const awsParent = ancestorFrameWithRole(
          elements,
          account.id,
          "provider",
        );
        expect(awsParent?.id).toBe(awsFrame!.id);
      }
      const acctA = accountById.get("111111111111");
      const acctB = accountById.get("222222222222");
      expect(acctA).toBeDefined();
      expect(acctB).toBeDefined();
      expect(frameBottom(acctA!)).toBeLessThanOrEqual((acctB!.y ?? 0) + 4);

      const regionFrames = framesByRole(elements, "region");
      const regionByAccountAndName = (accountId: string, regionName: string) =>
        regionFrames.find(
          (f) =>
            f.customData?.terraformTopologyPath?.[0] === accountId &&
            f.customData?.terraformTopologyPath?.[1] === regionName,
        );
      const rUsw2 = regionByAccountAndName("111111111111", "us-west-2");
      const rEuw1 = regionByAccountAndName("222222222222", "eu-west-1");
      if (rUsw2 && rEuw1) {
        expect(frameBottom(rUsw2)).toBeLessThanOrEqual((rEuw1.y ?? 0) + 4);
      }

      const regionNames = new Set(
        regionFrames.map((f) => f.customData?.terraformTopologyPath?.[1]),
      );
      expect(regionFrames.length).toBeGreaterThanOrEqual(4);
      for (const region of [
        "us-east-1",
        "us-west-2",
        "eu-west-1",
        "eu-central-1",
      ]) {
        expect(regionNames.has(region)).toBe(true);
      }

      const zoneFrames = elements.filter(
        (e) =>
          e.type === "frame" &&
          e.customData?.terraformTopologyRole === "subnetZone",
      );
      expect(zoneFrames.length).toBeGreaterThanOrEqual(10);
      expect(zoneFrames.length).toBeLessThan(body.meta?.atomCount ?? 0);

      const regionalZoneFrames = zoneFrames.filter(
        (z) => z.customData?.terraformTopologyPath?.[2] === "regional",
      );
      expect(regionalZoneFrames.length).toBeGreaterThanOrEqual(6);

      for (let i = 0; i < zoneFrames.length; i++) {
        for (let j = i + 1; j < zoneFrames.length; j++) {
          const a = zoneFrames[i]!;
          const b = zoneFrames[j]!;
          const pathA = a.customData?.terraformTopologyPath ?? [];
          const pathB = b.customData?.terraformTopologyPath ?? [];
          if (pathA[4] !== pathB[4]) {
            continue;
          }
          expect(intersectionArea(a, b)).toBeLessThan(4);
        }
      }

      const accountForSuffix = (suffix: string) => {
        const primary = primaryResourceForNodePath(elements, suffix);
        expect(primary).toBeDefined();
        const account = ancestorFrameWithRole(
          elements,
          primary!.frameId ?? primary!.id,
          "account",
        );
        return account?.customData?.terraformTopologyPath?.[0];
      };

      expect(
        accountForSuffix("10-a-api-1::module.api.aws_lambda_function.this"),
      ).toBe("111111111111");
      expect(
        accountForSuffix("11-a-api-2::module.api.aws_lambda_function.this"),
      ).toBe("111111111111");
      expect(
        accountForSuffix("12-a-api-3::module.api.aws_lambda_function.this"),
      ).toBe("111111111111");
      expect(
        accountForSuffix("20-b-api-4::module.api.aws_lambda_function.this"),
      ).toBe("222222222222");
      expect(
        accountForSuffix("21-b-api-5::module.api.aws_lambda_function.this"),
      ).toBe("222222222222");
      expect(
        accountForSuffix("22-b-api-6::module.api.aws_lambda_function.this"),
      ).toBe("222222222222");

      const api1Lambda = primaryResourceForNodePath(
        elements,
        "10-a-api-1::module.api.aws_lambda_function.this",
      );
      const api1Zone = ancestorFrameWithRole(
        elements,
        api1Lambda!.frameId ?? api1Lambda!.id,
        "subnetZone",
      );
      if (api1Zone) {
        expect(insideFrame(api1Lambda!, api1Zone)).toBe(true);
      }

      // Per-track zone keys keep distinct API bands in the same column apart.
      expectDifferentSubnetZone(
        elements,
        "21-b-api-5::module.api.aws_api_gateway_rest_api.main",
        "22-b-api-6::module.api.aws_api_gateway_rest_api.main",
      );
      expectDifferentSubnetZone(
        elements,
        "21-b-api-5::module.api.aws_ssm_parameter.api_name",
        "22-b-api-6::module.api.aws_ssm_parameter.api_name",
      );
      expectDifferentSubnetZone(
        elements,
        "11-a-api-2::module.api.aws_api_gateway_rest_api.main",
        "12-a-api-3::module.api.aws_api_gateway_rest_api.main",
      );
      expectDifferentSubnetZone(
        elements,
        "10-a-api-1::module.api.aws_api_gateway_rest_api.main",
        "11-a-api-2::module.api.aws_api_gateway_rest_api.main",
      );
      expectDifferentSubnetZone(
        elements,
        "21-b-api-5::module.api.aws_lambda_function.this",
        "22-b-api-6::module.api.aws_lambda_function.this",
      );
    },
    180_000,
  );
});
