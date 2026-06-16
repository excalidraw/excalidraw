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
    meta: body.meta as Record<string, unknown>,
    diagnostics: diagnosePipelineScene(elements),
  };
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

      // Wins vs v1 classic stacked: shorter (2-D side-by-side packing of
      // column-disjoint hulls), squarer, and fewer crossings. (Full squareness
      // needs the elastic-depth / bundle-packing follow-up; this is the strict,
      // order-safe baseline.)
      expect(v2.bounds.height, "v2 shorter than classic stacked").toBeLessThan(
        classic.bounds.height,
      );
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
