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
        // Experimental view (Phase A width-budgeted columns + Phase B barycenter
        // ordering) vs its exact default twin — same toggles, engine off vs on.
        [
          "default twin (compound+full+packed)",
          {
            pipelineLayoutVariant: "compound",
            pipelineCompact: false,
            pipelinePacked: true,
          },
        ],
        [
          "EXPERIMENTAL (compound+full+packed)",
          {
            layoutMode: "experimental",
            pipelineLayoutVariant: "compound",
            pipelineCompact: false,
            pipelinePacked: true,
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

      // Experimental view gate. The invariants must always hold: no overlaps /
      // no broken hierarchies and TFD left-to-right order preserved. The Phase A
      // slack-window column spreading also reliably yields a flatter scene
      // (lower height) than its default twin — the "wider/flatter" goal.
      // NOTE: crossings currently rise vs the default's tuned ASAP+packed-shift
      // ordering; lane-level Phase B does not yet absorb the intra-column
      // crossings spreading introduces (cluster-level ordering is the follow-up).
      const exp = out["EXPERIMENTAL (compound+full+packed)"]!;
      const base = out["default twin (compound+full+packed)"]!;
      const e = exp.diagnostics;
      expect(e.collisionCount, "experimental collisions").toBe(0);
      expect(e.semanticEdgeViolations, "experimental edge order").toEqual([]);
      expect(
        exp.bounds.height,
        "experimental height vs default twin (flatter)",
      ).toBeLessThanOrEqual(base.bounds.height);

      // Determinism: a second build is byte-identical in geometry.
      const exp2 = await layout("staging-extended-localstack-v2", {
        layoutMode: "experimental",
        pipelineLayoutVariant: "compound",
        pipelineCompact: false,
        pipelinePacked: true,
      });
      expect(exp2.bounds, "experimental determinism (bounds)").toEqual(
        exp.bounds,
      );
      expect(
        exp2.diagnostics.dataflow.crossings,
        "experimental determinism (crossings)",
      ).toBe(e.dataflow.crossings);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 4,
  );
});
