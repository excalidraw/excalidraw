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
  customData?: {
    terraformTopologyRole?: string;
    terraformTopologyPath?: string[];
    nodePath?: string;
    terraformVisibilityRole?: string;
    terraformPipelineOverview?: boolean;
  };
};

function intersectionArea(a: SceneElement, b: SceneElement): number {
  const ax2 = (a.x ?? 0) + (a.width ?? 0);
  const ay2 = (a.y ?? 0) + (a.height ?? 0);
  const bx2 = (b.x ?? 0) + (b.width ?? 0);
  const by2 = (b.y ?? 0) + (b.height ?? 0);
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x ?? 0, b.x ?? 0));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y ?? 0, b.y ?? 0));
  return ix * iy;
}

function ancestorSubnetZone(
  elements: SceneElement[],
  el: SceneElement,
): SceneElement | null {
  const byId = new Map(elements.map((e) => [e.id, e]));
  let current: string | null | undefined = el.frameId ?? el.id;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const node = byId.get(current);
    if (
      node?.type === "frame" &&
      node.customData?.terraformTopologyRole === "subnetZone"
    ) {
      return node;
    }
    current = node?.frameId ?? null;
  }
  return null;
}

function columnIndexForPrimary(
  elements: SceneElement[],
  primary: SceneElement,
): number | null {
  const zone = ancestorSubnetZone(elements, primary);
  const path = zone?.customData?.terraformTopologyPath;
  if (!path || path.length < 5) {
    return null;
  }
  const col = Number(path[4]);
  return Number.isFinite(col) ? col : null;
}

/** Tier-0 pipeline atom cards only (exclude IAM/SG satellites inside a cluster). */
function pipelinePrimaryTier0Resources(elements: SceneElement[]): SceneElement[] {
  return elements.filter((e) => {
    if (e.type !== "rectangle") {
      return false;
    }
    const cd = e.customData as Record<string, unknown> | undefined;
    if (cd?.terraformVisibilityRole !== "resource") {
      return false;
    }
    if (cd.terraformPipelineOverview !== true) {
      return false;
    }
    const explode = cd.terraformExplodeParentKeys;
    if (Array.isArray(explode) && explode.length > 0) {
      return false;
    }
    return typeof cd.nodePath === "string";
  });
}

describe("pipeline layout overlap guards", () => {
  it.skipIf(!hasLocalstackGeoFanoutFixtures())(
    "primary resource cards in the same pipeline column do not intersect",
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
      const primaries = pipelinePrimaryTier0Resources(elements);
      expect(primaries.length).toBeGreaterThan(5);

      const byColumn = new Map<number, SceneElement[]>();
      for (const p of primaries) {
        const col = columnIndexForPrimary(elements, p);
        if (col == null) {
          continue;
        }
        const list = byColumn.get(col) ?? [];
        list.push(p);
        byColumn.set(col, list);
      }

      for (const [, group] of byColumn) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const a = group[i]!;
            const b = group[j]!;
            expect(
              intersectionArea(a, b),
              `overlap in column: ${a.customData?.nodePath} vs ${b.customData?.nodePath}`,
            ).toBeLessThan(4);
          }
        }
      }
    },
    180_000,
  );

  it.skipIf(!hasLocalstackGeoFanoutFixtures())(
    "adjacent pipeline columns do not horizontally overlap primary cards",
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
      const elements = body.elements as SceneElement[];
      const primaries = pipelinePrimaryTier0Resources(elements);

      const byColumn = new Map<number, SceneElement[]>();
      for (const p of primaries) {
        const col = columnIndexForPrimary(elements, p);
        if (col == null) {
          continue;
        }
        const list = byColumn.get(col) ?? [];
        list.push(p);
        byColumn.set(col, list);
      }

      const cols = [...byColumn.keys()].sort((a, b) => a - b);
      for (let c = 0; c < cols.length - 1; c++) {
        const left = byColumn.get(cols[c]!) ?? [];
        const right = byColumn.get(cols[c + 1]!) ?? [];
        for (const a of left) {
          for (const b of right) {
            expect(
              intersectionArea(a, b),
              `horizontal overlap col ${cols[c]} vs ${cols[c + 1]}: ${a.customData?.nodePath} / ${b.customData?.nodePath}`,
            ).toBeLessThan(4);
          }
        }
      }
    },
    180_000,
  );
});
