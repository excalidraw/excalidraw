import { describe, expect, it } from "vitest";

import graphlibDot from "@dagrejs/graphlib-dot";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getTerraformImportPresetSourcesFromDb } from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";
import { STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS } from "../test-fixtures/terraformPresetFixtures";

import { diagnosePipelineScene } from "./terraformPipelineCollisionDiagnostics";
import { resolveSourcesWithTfdComposition } from "./terraformImportCompositionResolve";
import { buildTerraformPipelineRcllExcalidrawScene } from "./terraformPipelineLayoutRcll";
import {
  applyTfdOverlayToNodes,
  buildTerraformLocalImportNodesMap,
} from "./terraformPlanParsing";

import type { TerraformImportPresetSources } from "./terraformImportPresetsTypes";

type GeomCell = {
  type: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
};

const TARGET_VPC_PATH = [
  "aws",
  "000000000003",
  "us-west-2",
  "vpc-a0fcf7a066cd52312",
] as const;
const TARGET_VPC_SCOPE_KEY = TARGET_VPC_PATH.join("\0");

const primaryFrameGeometryByAddress = (
  els: readonly ExcalidrawElement[],
): Map<string, GeomCell> => {
  const out = new Map<string, GeomCell>();
  for (const e of els) {
    const cd = e.customData as
      | { terraformTopologyRole?: unknown; terraformPrimaryAddress?: unknown }
      | undefined;
    if (
      e.type !== "frame" ||
      e.isDeleted ||
      cd?.terraformTopologyRole !== "primaryCluster" ||
      typeof cd.terraformPrimaryAddress !== "string"
    ) {
      continue;
    }
    out.set(cd.terraformPrimaryAddress, {
      type: e.type,
      x: e.x,
      y: e.y,
      width: e.width,
      height: e.height,
      angle: e.angle,
    });
  }
  return out;
};

const frameGeometryByTopology = (
  els: readonly ExcalidrawElement[],
): Map<string, GeomCell> => {
  const out = new Map<string, GeomCell>();
  for (const e of els) {
    const cd = e.customData as
      | {
          terraformTopologyKey?: unknown;
          terraformTopologyPath?: unknown;
          terraformTopologyRole?: unknown;
        }
      | undefined;
    if (e.type !== "frame" || e.isDeleted || !cd) {
      continue;
    }
    const cell: GeomCell = {
      type: e.type,
      name: typeof e.name === "string" ? e.name : undefined,
      x: e.x,
      y: e.y,
      width: e.width,
      height: e.height,
      angle: e.angle,
    };
    if (typeof cd.terraformTopologyKey === "string") {
      out.set(`key:${cd.terraformTopologyKey}`, cell);
    }
    if (Array.isArray(cd.terraformTopologyPath)) {
      out.set(
        `path:${cd.terraformTopologyPath
          .filter((part): part is string => typeof part === "string")
          .join("\0")}`,
        cell,
      );
      if (typeof cd.terraformTopologyRole === "string") {
        out.set(
          `role-path:${cd.terraformTopologyRole}:${cd.terraformTopologyPath
            .filter((part): part is string => typeof part === "string")
            .join("\0")}`,
          cell,
        );
      }
    }
  }
  return out;
};

const findFrameByRolePath = (
  els: readonly ExcalidrawElement[],
  role: string,
  path: readonly string[],
): GeomCell | undefined =>
  frameGeometryByTopology(els).get(`role-path:${role}:${path.join("\0")}`);

const ancillaryAllocationForScope = (
  meta: Record<string, unknown>,
  scopeKey: string,
):
  | {
      scopeKey: string;
      wrapWidth: number;
      allocatedWidthPx: number;
      rowSavings: number;
      cardCount: number;
    }
  | undefined => {
  const allocator = meta.rcllAncillaryAllocator as
    | {
        allocations?: unknown;
      }
    | undefined;
  const allocations = Array.isArray(allocator?.allocations)
    ? allocator.allocations
    : [];
  return allocations.find(
    (
      allocation,
    ): allocation is {
      scopeKey: string;
      wrapWidth: number;
      allocatedWidthPx: number;
      rowSavings: number;
      cardCount: number;
    } =>
      typeof allocation === "object" &&
      allocation !== null &&
      (allocation as { scopeKey?: unknown }).scopeKey === scopeKey &&
      typeof (allocation as { wrapWidth?: unknown }).wrapWidth === "number" &&
      typeof (allocation as { allocatedWidthPx?: unknown }).allocatedWidthPx ===
        "number" &&
      typeof (allocation as { rowSavings?: unknown }).rowSavings === "number" &&
      typeof (allocation as { cardCount?: unknown }).cardCount === "number",
  );
};

async function buildV2(options: Record<string, unknown>) {
  const raw = getTerraformImportPresetSourcesFromDb(
    "staging-extended-localstack-v2",
  );
  const sources = resolveSourcesWithTfdComposition(
    raw! as TerraformImportPresetSources,
  );
  const bundle = sources.planDotBundles[0]!;
  const graph = graphlibDot.read("digraph G {}\n");
  const nodes = buildTerraformLocalImportNodesMap(bundle.plan, graph, [], {});
  applyTfdOverlayToNodes(nodes, sources.tfdTexts, sources.tfdLabels);
  const scene = await buildTerraformPipelineRcllExcalidrawScene(
    nodes,
    bundle.plan,
    options,
  );
  const elements = scene.elements as ExcalidrawElement[];
  return {
    meta: scene.meta,
    elements,
    diagnostics: diagnosePipelineScene(elements),
  };
}

const placement = (m: Record<string, unknown>) =>
  (m.rcllStageMeta as Record<string, Record<string, number>>).placement;

// DI-ANC-6 — the read-only diagnostic the allocator emits per scope.
const BAND_BLOCK_STATUSES = new Set([
  "no-breakpoint",
  "gap-exists-current-algo-missed",
  "all-candidates-fail-validation",
  "root-capped",
  "ancestor-capped",
  "shared-slack-consumed",
  "served-best-achievable",
]);

const ancillaryDiagnostics = (
  meta: Record<string, unknown>,
): Record<string, unknown>[] => {
  const allocator = meta.rcllAncillaryAllocator as
    | { diagnostics?: unknown }
    | undefined;
  return Array.isArray(allocator?.diagnostics)
    ? (allocator!.diagnostics as Record<string, unknown>[])
    : [];
};

describe("RCLL All Resources ancillary bands", () => {
  it(
    "locks reported v2 VPC Unconnected width to allocator slack in compact and full",
    async () => {
      const baseOptions = {
        swimlaneLaneRise: true,
        rankSeparate: true,
        reorder: true,
        crossingMin: true,
        straighten: true,
        columnCompact: true,
        staircaseBandOverlap: true,
        deBandLevel: "none",
      };

      for (const compact of [true, false]) {
        const mode = compact ? "compact" : "full";
        const dataflow = await buildV2({ ...baseOptions, compact });
        const allResources = await buildV2({
          ...baseOptions,
          compact,
          includeAncillary: true,
        });

        const allocation = ancillaryAllocationForScope(
          allResources.meta,
          TARGET_VPC_SCOPE_KEY,
        );
        expect(allocation, `${mode} target VPC allocation`).toBeDefined();
        expect(
          allocation!.allocatedWidthPx,
          `${mode} target VPC receives right-slack allocation`,
        ).toBeGreaterThan(0);
        expect(
          allocation!.rowSavings,
          `${mode} target VPC allocation reduces ancillary rows`,
        ).toBeGreaterThan(0);

        const dataflowVpc = findFrameByRolePath(
          dataflow.elements,
          "vpc",
          TARGET_VPC_PATH,
        );
        const allVpc = findFrameByRolePath(
          allResources.elements,
          "vpc",
          TARGET_VPC_PATH,
        );
        const targetStrip = findFrameByRolePath(
          allResources.elements,
          "ancillaryStrip",
          TARGET_VPC_PATH,
        );

        expect(dataflowVpc, `${mode} target VPC dataflow frame`).toBeDefined();
        expect(allVpc, `${mode} target VPC all-resources frame`).toBeDefined();
        expect(
          targetStrip,
          `${mode} target VPC Unconnected frame`,
        ).toBeDefined();
        expect(targetStrip!.name, `${mode} target frame label`).toBe(
          "Unconnected",
        );
        expect(
          targetStrip!.width,
          `${mode} target strip width matches allocator wrap`,
        ).toBe(allocation!.wrapWidth);
        expect(
          targetStrip!.width,
          `${mode} target strip is wider than pre-allocation VPC hull`,
        ).toBeGreaterThan(dataflowVpc!.width);
        expect(
          allVpc!.width,
          `${mode} target VPC hull widens to contain strip`,
        ).toBeGreaterThan(dataflowVpc!.width);
        expect(
          allVpc!.x,
          `${mode} VPC left contains strip`,
        ).toBeLessThanOrEqual(targetStrip!.x);
        expect(
          allVpc!.x + allVpc!.width,
          `${mode} VPC right contains strip`,
        ).toBeGreaterThanOrEqual(targetStrip!.x + targetStrip!.width);

        // DI-ANC-6 — the read-only diagnostic is populated per scope and the
        // dev probe can surface it. Every entry carries a known status; the
        // target VPC entry exists with a final band box. We do NOT pin the
        // target's status (that is the evidence the probe reads), only that it
        // is well-formed and consistent with the live allocation.
        const diags = ancillaryDiagnostics(allResources.meta);
        expect(diags.length, `${mode} diagnostics emitted`).toBeGreaterThan(0);
        for (const d of diags) {
          expect(
            BAND_BLOCK_STATUSES.has(d.bandBlockStatus as string),
            `${mode} ${String(d.scopeKey)} has a known bandBlockStatus`,
          ).toBe(true);
        }
        const targetDiag = diags.find(
          (d) => d.scopeKey === TARGET_VPC_SCOPE_KEY,
        );
        expect(targetDiag, `${mode} target VPC diagnostic`).toBeDefined();
        expect(
          targetDiag!.finalBand,
          `${mode} target VPC final band box surfaced`,
        ).not.toBeNull();
        // the target widened in this config, so its accepted width matches the
        // allocation and it is served at its best achievable width.
        expect(
          targetDiag!.acceptedWrapWidth,
          `${mode} target diagnostic accepted width matches allocation`,
        ).toBe(allocation!.wrapWidth);
        // The target widened here, so it is NOT a no-breakpoint / boxed-in case.
        // Its precise status is the evidence the probe reads — on v2 full it is
        // `shared-slack-consumed` (a larger within-ceiling widening exists but
        // contention spent the shared ancestor slack), which is exactly the kind
        // of missed gap PR2 targets. We assert it is a widen-capable status
        // rather than pinning a single value across compact/full.
        expect(
          [
            "served-best-achievable",
            "shared-slack-consumed",
            "gap-exists-current-algo-missed",
          ].includes(targetDiag!.bandBlockStatus as string),
          `${mode} target is a widen-capable status, got ${String(
            targetDiag!.bandBlockStatus,
          )}`,
        ).toBe(true);

        const allocator = allResources.meta.rcllAncillaryAllocator as Record<
          string,
          number
        >;
        expect(allocator.fallbackDropCount, `${mode} no fallback drops`).toBe(
          0,
        );
        const placementMeta = placement(allResources.meta);
        expect(
          placementMeta.containmentViolations,
          `${mode} containment remains clean`,
        ).toBe(0);
        expect(
          placementMeta.siblingOverlapViolations,
          `${mode} sibling overlaps remain clean`,
        ).toBe(0);
        expect(
          allResources.diagnostics.collisionCount,
          `${mode} rendered collisions remain clean`,
        ).toBe(0);
      }
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 12,
  );

  it(
    "does not widen compact-ish full-detail v2 when de-band is off",
    async () => {
      const baseOptions = {
        compact: false,
        swimlaneLaneRise: true,
        rankSeparate: true,
        reorder: true,
        crossingMin: true,
        straighten: true,
        columnCompact: true,
        staircaseBandOverlap: true,
        deBandLevel: "none",
      };
      const dataflow = await buildV2(baseOptions);
      const allResources = await buildV2({
        ...baseOptions,
        includeAncillary: true,
      });

      const dataflowPlace = placement(dataflow.meta);
      const allPlace = placement(allResources.meta);
      expect(allResources.meta.pipelineAncillaryApplied).toBe(true);
      expect(allResources.meta.pipelineAncillaryCount).toBeGreaterThan(0);
      const allocator = allResources.meta.rcllAncillaryAllocator as Record<
        string,
        number
      >;
      expect(
        Number.isInteger(allocator.allocationCount),
        "allocator reports deterministic allocation count",
      ).toBe(true);
      expect(
        Number.isInteger(allocator.fallbackDropCount),
        "allocator reports deterministic fallback drops",
      ).toBe(true);
      expect(
        allocator.allocatedWidthPx,
        "allocator never reports negative width",
      ).toBeGreaterThanOrEqual(0);
      expect(
        allocator.rowSavings,
        "allocator never reports negative row savings",
      ).toBeGreaterThanOrEqual(0);
      expect(
        allPlace.maxWidthPx,
        "ancillary bands must reserve height without widening RCLL placement",
      ).toBeLessThanOrEqual(dataflowPlace.maxWidthPx);

      const dataflowPrimary = primaryFrameGeometryByAddress(dataflow.elements);
      const allPrimary = primaryFrameGeometryByAddress(allResources.elements);
      for (const [address, box] of dataflowPrimary) {
        const allBox = allPrimary.get(address);
        expect(allBox, `${address} primary frame still present`).toBeDefined();
        expect(allBox!.type, `${address} primary frame type unchanged`).toBe(
          box.type,
        );
        expect(allBox!.x, `${address} primary frame x unchanged`).toBe(box.x);
        expect(allBox!.width, `${address} primary frame width unchanged`).toBe(
          box.width,
        );
        expect(
          allBox!.height,
          `${address} primary frame height unchanged`,
        ).toBe(box.height);
        expect(allBox!.angle, `${address} primary frame angle unchanged`).toBe(
          box.angle,
        );
        expect(
          allBox!.y,
          `${address} primary frame may only move down for inserted rows`,
        ).toBeGreaterThanOrEqual(box.y);
      }
      expect(
        allPlace.siblingOverlapViolations,
        "ancillary bands stay disjoint from normal siblings",
      ).toBe(0);
      expect(allResources.diagnostics.collisionCount).toBe(0);

      const allResources2 = await buildV2({
        ...baseOptions,
        includeAncillary: true,
      });
      expect(
        allResources2.meta.rcllAncillaryAllocator,
        "allocator meta deterministic",
      ).toEqual(allResources.meta.rcllAncillaryAllocator);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 6,
  );
});
