/**
 * RCLL sibling-separation ranking (`rankSeparate`, RFC §9.6 / DEC-13) — v2 integration suite.
 *
 * `rankSeparate` is the whole-model-global Sander base-node layering: rank EVERY leaf
 * cluster in ONE longest-path pass over the whole-model leaf DAG augmented with
 * sibling-separation constraints (one-way hull pair A→B ⇒ all-to-all leaf precedence;
 * mutual cycle ⇒ co-axial). One-way sibling lanes get disjoint column ranges so the M4
 * lane rise can lift them beside each other (trade width for height). The container span
 * is derived from its leaves — never an independent local frame, which is what the round-3
 * per-container ranker got wrong (7 backward + 1 same-column on v2; see §9.5 / DI-DEB-5).
 *
 * Internal/measurement-only — `rankSeparate` is NOT threaded to the dialog/URL. Default OFF.
 *
 * MEASURED (round 4, 2026-06-20): the global pass keeps CON-12 forward (gates 0/0, was 7+1)
 * and, composed with the EXISTING M4 lane-rise (`swimlaneLaneRise`), drops v2 Compact height
 * 14374 → 8377 (−42%). `rankSeparate` ALONE is taller (separation pushes right; M4 does the
 * Y reclamation) — so the height win is asserted on the composed config, the gates on both.
 * Cost: width +28%, crossings +45% (opt-in, default OFF; cross-container crossing-min is a
 * separate milestone). The unmodified M4 already delivers the win ⇒ the round-3-planned M4
 * occupied-set-disjointness change is unnecessary and is NOT built.
 */
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
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
};

const geometry = (els: readonly ExcalidrawElement[]): GeomCell[] =>
  els.map((e) => ({
    type: e.type,
    x: e.x,
    y: e.y,
    width: e.width,
    height: e.height,
    angle: e.angle,
  }));

describe("rcll rankSeparate (RFC §9.6 / DEC-13, v2)", () => {
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
    return {
      meta: scene.meta as Record<string, unknown>,
      elements: scene.elements as ExcalidrawElement[],
      diagnostics: diagnosePipelineScene(scene.elements as ExcalidrawElement[]),
    };
  }

  const placement = (m: Record<string, unknown>) =>
    (m.rcllStageMeta as Record<string, Record<string, number>>).placement;
  const gatesOf = (m: Record<string, unknown>) =>
    m.gates as Record<string, number>;

  it(
    "global pass keeps CON-12 forward (was 7+1), separation fires, composes with M4 for the height win — deterministic, OFF unchanged (Compact + Full)",
    async () => {
      for (const compact of [true, false]) {
        const mode = compact ? "compact" : "full";

        const off = await buildV2({ compact });
        const offExplicit = await buildV2({ compact, rankSeparate: false });
        const rs = await buildV2({ compact, rankSeparate: true });
        const rs2 = await buildV2({ compact, rankSeparate: true });
        const rsM4 = await buildV2({
          compact,
          rankSeparate: true,
          swimlaneLaneRise: true,
        });

        const rsPlace = placement(rs.meta);
        const rsGates = gatesOf(rs.meta);

        // 1. THE round-3 fix: the whole-model-global layering keeps EVERY collapsed-TFD
        //    edge forward. Round 3's per-container shifts inverted 7 cross-account edges
        //    + 1 same-column; the single global frame makes that impossible by construction.
        expect(
          rsGates.acyclicBackwardEdges,
          `${mode} iron rule: no backward edge (round-3 had 7)`,
        ).toBe(0);
        expect(
          rsGates.acyclicSameColumnEdges,
          `${mode} iron rule: no same-column edge (round-3 had 1)`,
        ).toBe(0);

        // 2. Separation actually FIRED (strengthened bar — 0/0 is also satisfiable by the
        //    no-op fallback, so prove it did real work): pairs found, ranks moved, no fallback.
        expect(
          rsPlace.rankSeparatePairCount,
          `${mode} one-way pairs found`,
        ).toBeGreaterThan(0);
        expect(
          rsPlace.rankSeparateChangedRankCount,
          `${mode} ranks moved`,
        ).toBeGreaterThan(0);
        expect(rsPlace.rankSeparateApplied, `${mode} applied`).toBe(1);
        expect(
          rsPlace.rankSeparateFallback,
          `${mode} fallbackReason === none (0)`,
        ).toBe(0);

        // 3. The height win is on the COMPOSED config: rankSeparate alone pushes lanes
        //    right (taller); the EXISTING M4 lane-rise reclaims the Y. The round-3-planned
        //    M4 occupied-set modification is therefore unnecessary and was not built.
        expect(
          placement(rsM4.meta).maxDepthPx,
          `${mode} rankSep+M4 height < base (the −42% win)`,
        ).toBeLessThan(placement(off.meta).maxDepthPx);

        // 4. Structural + readability gates hold on the staggered geometry.
        expect(rsPlace.containmentViolations, `${mode} containment`).toBe(0);
        expect(
          rsPlace.siblingOverlapViolations,
          `${mode} sibling overlap`,
        ).toBe(0);
        expect(rs.diagnostics.collisionCount, `${mode} collision-free`).toBe(0);

        // 5. Milestone + meta identity (mirrors subnetDeBand).
        expect(rs.meta.rcllMilestone, `${mode} milestone`).toBe("M8r");
        expect(rs.meta.rcllRankSeparate, `${mode} ON meta flag`).toBe(true);
        expect(off.meta.rcllRankSeparate, `${mode} OFF meta flag`).toBe(false);

        // 6. rankSeparate is a REAL change (not a silent no-op): geometry differs from OFF.
        expect(
          geometry(rs.elements),
          `${mode} rankSeparate changes geometry`,
        ).not.toEqual(geometry(off.elements));

        // 7. OFF byte-identical: default and explicit `rankSeparate:false` are the same
        //    scene (the flag is the only difference, and OFF takes the base floor verbatim).
        expect(
          geometry(offExplicit.elements),
          `${mode} OFF (explicit false) === default`,
        ).toEqual(geometry(off.elements));

        // 8. Determinism (CON-8): a second ON build is byte-identical.
        expect(geometry(rs.elements), `${mode} ON deterministic`).toEqual(
          geometry(rs2.elements),
        );
      }
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 12,
  );
});
