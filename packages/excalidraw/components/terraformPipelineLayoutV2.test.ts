/**
 * Integration test for pipeline view v2 on staging-extended-localstack-v2.
 *
 * Gates the v2 correctness invariants (no overlaps, TFD left-to-right order
 * preserved, deterministic) and the headline quality goal (square/flatter — not
 * taller than v1 classic stacked). Reuses diagnosePipelineScene as the scorecard.
 *
 * Run:
 *   VITEST_TERRAFORM_VERBOSE=1 yarn vitest run \
 *     packages/excalidraw/components/terraformPipelineLayoutV2.test.ts
 */
import { describe, expect, it } from "vitest";

import graphlibDot from "@dagrejs/graphlib-dot";
import { getCommonBounds } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getTerraformImportPresetSourcesFromDb } from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";
import { STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS } from "../test-fixtures/terraformPresetFixtures";

import { DECLARED_DATAFLOW_ORDERED_KEY } from "./terraformDeclaredDataFlow";
import { diagnosePipelineScene } from "./terraformPipelineCollisionDiagnostics";
import {
  getTerraformResourceTypeFromNodePath,
  isPrimaryVisibleResourceType,
} from "./terraformPrimaryVisibility";
import { resolveSourcesWithTfdComposition } from "./terraformImportCompositionResolve";
import { layoutTerraformViaWorkers } from "./terraformLayoutWorkerClient";
import {
  applyTfdOverlayToNodes,
  buildTerraformLocalImportNodesMap,
} from "./terraformPlanParsing";

import type { TerraformImportPresetSources } from "./terraformImportPresetsTypes";

const round = (n: number) => Math.round(n * 100) / 100;

async function layout(presetId: string, options: Record<string, unknown>) {
  const raw = getTerraformImportPresetSourcesFromDb(presetId);
  const sources = resolveSourcesWithTfdComposition(
    raw! as TerraformImportPresetSources,
  );
  const bundle = sources.planDotBundles[0]!;
  const graph = graphlibDot.read("digraph G {}\n");
  const nodes = buildTerraformLocalImportNodesMap(bundle.plan, graph, [], {});
  applyTfdOverlayToNodes(nodes, sources.tfdTexts, sources.tfdLabels);
  expect(nodes[DECLARED_DATAFLOW_ORDERED_KEY]?.length ?? 0).toBeGreaterThan(0);

  const body = await layoutTerraformViaWorkers(
    {
      planDotBundles: sources.planDotBundles,
      states: [],
      stateLabels: [],
      tfdTexts: sources.tfdTexts,
      tfdLabels: sources.tfdLabels,
    },
    { semanticLayout: false, layoutMode: "pipeline", ...options },
  );
  const elements = body.elements as ExcalidrawElement[];
  const live = elements.filter((e) => !e.isDeleted);
  const [minX, minY, maxX, maxY] = getCommonBounds(live);
  const width = round(maxX - minX);
  const height = round(maxY - minY);
  return {
    bounds: { width, height },
    aspect: round(width / Math.max(1, height)),
    elementCount: live.length,
    elements: live,
    meta: body.meta as Record<string, unknown>,
    diagnostics: diagnosePipelineScene(elements),
  };
}

/**
 * Ancillary ("Unconnected") primaryCluster frames whose primary address is a
 * primary-visible type, classified by whether they kept their grouping. The bug
 * being guarded: a primary-visible unconnected resource degrading to the bare
 * fallback card (no satellites, not expandable). A properly grouped card is
 * either expandable (compact builder / compact retry) or has nested satellites
 * (full builder).
 */
function classifyAncillaryPrimaries(elements: readonly ExcalidrawElement[]): {
  total: number;
  bare: { address: string; resourceType: string }[];
} {
  const cd = (e: ExcalidrawElement) =>
    (e.customData ?? {}) as Record<string, unknown>;
  const ancillaryFrames = elements.filter(
    (e) =>
      e.type === "frame" &&
      cd(e).terraformPipelineAncillary === true &&
      cd(e).terraformTopologyRole === "primaryCluster",
  );
  const bare: { address: string; resourceType: string }[] = [];
  for (const frame of ancillaryFrames) {
    const address = cd(frame).terraformPrimaryAddress;
    if (typeof address !== "string") {
      continue;
    }
    const resourceType = getTerraformResourceTypeFromNodePath(address);
    if (!isPrimaryVisibleResourceType(resourceType)) {
      continue; // non-primary leftovers may legitimately be bare
    }
    const members = elements.filter((e) => e.frameId === frame.id);
    const primaryCard = members.find((e) => e.id === address);
    const isExpandable =
      cd(primaryCard ?? frame).terraformPipelineExpandable === true;
    const satelliteCount = members.filter(
      (e) => e.type !== "frame" && e.id !== address,
    ).length;
    if (!isExpandable && satelliteCount === 0) {
      bare.push({ address, resourceType });
    }
  }
  return { total: ancillaryFrames.length, bare };
}

/**
 * Collisions where either side is an ancillary ("Unconnected") element — the only
 * collisions this feature could introduce. Pre-existing collisions inside the
 * dataflow regions (untouched by the grouping/strip wiring) are excluded.
 */
function ancillaryCollisions(
  scene: Awaited<ReturnType<typeof layout>>,
): { category: string; a: string; b: string }[] {
  const ancillaryIds = new Set(
    scene.elements
      .filter(
        (e) =>
          (e.customData as Record<string, unknown> | undefined)
            ?.terraformPipelineAncillary === true,
      )
      .map((e) => e.id),
  );
  return scene.diagnostics.collisions
    .filter((c) => ancillaryIds.has(c.a.id) || ancillaryIds.has(c.b.id))
    .map((c) => ({ category: c.category, a: c.a.id, b: c.b.id }));
}

describe("pipeline view v2", () => {
  it(
    "staging-extended-localstack-v2 — square, overlap-free, TFD-ordered, deterministic",
    async () => {
      const classic = await layout("staging-extended-localstack-v2", {
        pipelineLayoutVariant: "classic",
        pipelineCompact: true,
      });
      const v2 = await layout("staging-extended-localstack-v2", {
        pipelineLayoutVariant: "v2",
        pipelineCompact: true,
      });

      // eslint-disable-next-line no-console -- intentional diagnostic output
      console.log(
        `\n[pipeline:v2]\n${JSON.stringify(
          {
            classic: {
              bounds: classic.bounds,
              aspect: classic.aspect,
              crossings: classic.diagnostics.dataflow.crossings,
              edgeViolations: classic.diagnostics.semanticEdgeViolations.length,
              collisions: classic.diagnostics.collisionCount,
              fractionNearStraight:
                classic.diagnostics.dataflow.fractionNearStraight,
            },
            v2: {
              bounds: v2.bounds,
              aspect: v2.aspect,
              sideBySideRows: v2.meta.pipelineV2SideBySideRows,
              crossings: v2.diagnostics.dataflow.crossings,
              edgeViolations: v2.diagnostics.semanticEdgeViolations.length,
              collisions: v2.diagnostics.collisionCount,
              fractionNearStraight:
                v2.diagnostics.dataflow.fractionNearStraight,
            },
          },
          null,
          2,
        )}`,
      );

      // It is the v2 variant.
      expect(v2.meta.pipelineVariant).toBe("v2");
      expect(v2.elementCount).toBeGreaterThan(0);

      // Correctness: no overlaps / broken hierarchies.
      expect(v2.diagnostics.collisionCount, "v2 collisions").toBe(0);

      // STRICT TFD order: the column-aware packer pins every cluster to its
      // global depth column, so no edge runs backwards — by construction.
      expect(
        v2.diagnostics.semanticEdgeViolations,
        "v2 backward TFD edges (must be zero)",
      ).toEqual([]);

      // Wins vs v1 classic stacked: shorter, squarer, fewer crossings. Pure-sink
      // fan-out bundles spill *beside* their source (elastic depth) instead of
      // stacking under it, so the drawing reads near-square — not just "less
      // tall". (Compact lands ≈ 1:1 aspect on this preset.)
      expect(v2.bounds.height, "v2 shorter than classic stacked").toBeLessThan(
        classic.bounds.height,
      );
      expect(v2.aspect, "v2 reads near-square").toBeGreaterThan(0.8);
      expect(v2.aspect, "v2 squarer than classic").toBeGreaterThan(
        classic.aspect,
      );
      expect(
        v2.diagnostics.dataflow.crossings,
        "v2 fewer crossings than classic",
      ).toBeLessThan(classic.diagnostics.dataflow.crossings);

      // Determinism: a second build is byte-identical in geometry + crossings.
      const v2b = await layout("staging-extended-localstack-v2", {
        pipelineLayoutVariant: "v2",
        pipelineCompact: true,
      });
      expect(v2b.bounds, "v2 determinism (bounds)").toEqual(v2.bounds);
      expect(
        v2b.diagnostics.dataflow.crossings,
        "v2 determinism (crossings)",
      ).toBe(v2.diagnostics.dataflow.crossings);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 4,
  );
});

describe("pipeline all-resources respects primary grouping", () => {
  it(
    "every layout keeps unconnected primaries grouped; v2 nests the strips overlap-free",
    async () => {
      const variants = ["classic", "compound", "v2"] as const;
      const scenes = {} as Record<
        typeof variants[number],
        Awaited<ReturnType<typeof layout>>
      >;
      for (const variant of variants) {
        scenes[variant] = await layout("staging-extended-localstack-v2", {
          pipelineLayoutVariant: variant,
          pipelineCompact: false, // Full mode — exercises the full builder + fallback path
          pipelineIncludeAncillary: true,
        });
      }

      const summary = Object.fromEntries(
        variants.map((variant) => {
          const scene = scenes[variant];
          const ancillary = classifyAncillaryPrimaries(scene.elements);
          return [
            variant,
            {
              ancillaryPrimaries: ancillary.total,
              barePrimaries: ancillary.bare,
              stripCount: scene.meta.pipelineAncillaryStripCount ?? 0,
              collisions: scene.diagnostics.collisionCount,
              ancillaryCollisions: ancillaryCollisions(scene),
              edgeViolations: scene.diagnostics.semanticEdgeViolations.length,
            },
          ];
        }),
      );
      // eslint-disable-next-line no-console -- intentional diagnostic output
      console.log(
        `\n[pipeline:all-resources]\n${JSON.stringify(summary, null, 2)}`,
      );

      // The preset must actually contain unconnected primary-visible resources,
      // otherwise this test proves nothing.
      expect(
        classifyAncillaryPrimaries(scenes.v2.elements).total,
        "preset has unconnected primary resources to group",
      ).toBeGreaterThan(0);

      for (const variant of variants) {
        const scene = scenes[variant];
        const ancillary = classifyAncillaryPrimaries(scene.elements);
        // The core invariant: no primary-visible unconnected resource degrades
        // to a bare fallback card — each keeps its cluster grouping.
        expect(
          ancillary.bare,
          `${variant}: primary-visible ancillary resources on the bare-fallback path`,
        ).toEqual([]);
        // Grouping/placement must not introduce overlaps involving the new
        // ancillary strips/cards (pre-existing dataflow-region collisions are
        // untouched by this feature and excluded).
        expect(
          ancillaryCollisions(scene),
          `${variant}: collisions involving ancillary elements`,
        ).toEqual([]);
        expect(
          scene.diagnostics.semanticEdgeViolations,
          `${variant}: backward TFD edges with all-resources`,
        ).toEqual([]);
      }

      // v2 must actually render the strips (the new wiring) and report them.
      expect(
        scenes.v2.meta.pipelineAncillaryStripCount,
        "v2 emitted ancillary strips",
      ).toBeGreaterThan(0);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 6,
  );
});
