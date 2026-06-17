/**
 * Semantic-placement audit metrics for the pipeline view (research diagnostic).
 *
 * Quantifies the "dataflow readability" + "no overlaps / no broken hierarchies"
 * gap described in docs/pipeline-semantic-placement-audit.md across pipeline
 * toggle combinations on staging-extended-localstack-v2. Thin consumer of
 * diagnosePipelineScene (terraformPipelineCollisionDiagnostics).
 *
 * Run:
 *   VITEST_TERRAFORM_VERBOSE=1 yarn vitest run \
 *     packages/excalidraw/components/terraformPipelineSemanticAudit.test.ts
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
  return {
    bounds: { width: round(maxX - minX), height: round(maxY - minY) },
    elementCount: live.length,
    diagnostics: diagnosePipelineScene(elements),
  };
}

describe("pipeline semantic placement audit", () => {
  it(
    "staging-extended-localstack-v2 — dataflow & topology metrics across configs",
    async () => {
      const configs: Array<[string, Record<string, unknown>]> = [
        ["defaults (classic+compact+stacked)", {}],
        [
          "canonical (compound+full+packed+pullLeft+ancillary)",
          {
            pipelineLayoutVariant: "compound",
            pipelineCompact: false,
            pipelinePacked: true,
            pipelinePackedPullLeft: true,
            pipelineIncludeAncillary: true,
          },
        ],
        [
          "compound+compact+packed+pullLeft",
          {
            pipelineLayoutVariant: "compound",
            pipelineCompact: true,
            pipelinePacked: true,
            pipelinePackedPullLeft: true,
          },
        ],
        [
          "SEMANTIC compound+compact+packed+pullLeft",
          {
            pipelineLayoutVariant: "compound",
            pipelineCompact: true,
            pipelinePacked: true,
            pipelinePackedPullLeft: true,
            pipelineSemanticPlacement: true,
          },
        ],
        [
          "SEMANTIC canonical (compound+full+packed+pullLeft+ancillary)",
          {
            pipelineLayoutVariant: "compound",
            pipelineCompact: false,
            pipelinePacked: true,
            pipelinePackedPullLeft: true,
            pipelineIncludeAncillary: true,
            pipelineSemanticPlacement: true,
          },
        ],
      ];

      const out: Record<string, Awaited<ReturnType<typeof layout>>> = {};
      for (const [label, opts] of configs) {
        out[label] = await layout("staging-extended-localstack-v2", opts);
      }
      // eslint-disable-next-line no-console -- intentional diagnostic output
      console.log(
        `\n[pipeline:semantic-audit]\n${JSON.stringify(out, null, 2)}`,
      );
      expect(Object.keys(out).length).toBe(configs.length);

      // Semantic placement gate: no overlaps, no broken hierarchies, TFD order kept.
      for (const [label, result] of Object.entries(out)) {
        if (!label.startsWith("SEMANTIC")) {
          continue;
        }
        const d = result.diagnostics;
        expect(d.collisionCount, `${label} collisions`).toBe(0);
        expect(
          d.bandInterleave.regionYIntervalSharedPairs,
          `${label} region band-share`,
        ).toBe(0);
        expect(
          d.bandInterleave.accountYIntervalSharedPairs,
          `${label} account band-share`,
        ).toBe(0);
        expect(d.semanticEdgeViolations, `${label} edge order`).toEqual([]);
      }
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 4,
  );
});
