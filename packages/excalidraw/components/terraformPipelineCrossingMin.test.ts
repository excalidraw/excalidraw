/**
 * M6c container-aware crossing minimization — v2 integration / measurement suite.
 *
 * The engine-level proof (no UI in Phase 1): build the dense `staging-extended-localstack-v2`
 * preset across `{crossingMin OFF/ON}` composed with the `rankSeparate`+M4 config where the
 * crossings rose (DI-DEB-6), and with a de-band config. Asserts the GUARANTEED invariants —
 * structural gates stay 0, the rendered (proxy) accept-meta never regresses, OFF is
 * byte-identical, ON is deterministic — and RECORDS the real rendered-crossings delta
 * (`readability.crossings`) so the GO/NO-GO measurement is captured honestly (a measured
 * no-op is a legitimate outcome — the A1/M5b/M5c precedent). See RFC §9.5.
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

/** Geometry projection — element ids/nonces are random per build, so byte-identity and
 * determinism are asserted on the placed geometry (type + box), not the raw ids. */
const geometry = (els: readonly ExcalidrawElement[]) =>
  els.map((e) => ({
    type: e.type,
    x: e.x,
    y: e.y,
    width: e.width,
    height: e.height,
    angle: e.angle,
  }));

describe("rcll container-aware crossing minimization (M6c, v2)", () => {
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
  const readability = (m: Record<string, unknown>) =>
    m.readability as Record<string, number>;

  it(
    "composes with rankSeparate+M4: gates stay 0, proxy crossings never regress, OFF byte-identical, ON deterministic — real delta recorded",
    async () => {
      const baseOpts = {
        compact: true,
        swimlaneLaneRise: true,
        rankSeparate: true,
      };
      const off = await buildV2(baseOpts);
      const offFalse = await buildV2({ ...baseOpts, crossingMin: false });
      const on = await buildV2({ ...baseOpts, crossingMin: true });
      const on2 = await buildV2({ ...baseOpts, crossingMin: true });

      // OFF byte-identical: crossingMin:false ≡ omitting it entirely (geometry).
      expect(geometry(offFalse.elements)).toEqual(geometry(off.elements));
      expect(off.meta.rcllCrossingMin).toBe(false);
      expect(on.meta.rcllCrossingMin).toBe(true);
      expect(on.meta.rcllMilestone).toBe("M8r"); // rankSeparate dominates the label

      // ON deterministic (×2 byte-identical geometry).
      expect(geometry(on2.elements)).toEqual(geometry(on.elements));

      // Structural gates stay 0 in BOTH modes (X never moved ⇒ CON-12 intact; Y-order
      // permutation never overlaps by construction; the accept gate re-checks).
      for (const built of [off, on]) {
        const place = placement(built.meta);
        const gates = gatesOf(built.meta);
        expect(place.containmentViolations).toBe(0);
        expect(place.siblingOverlapViolations).toBe(0);
        expect(gates.acyclicBackwardEdges).toBe(0);
        expect(gates.acyclicSameColumnEdges).toBe(0);
        expect(built.diagnostics.collisionCount).toBe(0);
      }

      // The proxy accept-meta NEVER regresses (the gate only accepts strict drops).
      const onPlace = placement(on.meta);
      expect(onPlace.crossingMinAfter).toBeLessThanOrEqual(
        onPlace.crossingMinBefore,
      );

      // Record the real rendered-crossings delta (the GO/NO-GO measurement). On this
      // config the pass is a material WIN (362→260, −28%) at zero height/width cost, so
      // the real rendered count is asserted never to regress (it drops well past the
      // proxy margin). This discharges the DI-DEB-6 rankSeparate +45 % crossings cost.
      const offCross = readability(off.meta).crossings;
      const onCross = readability(on.meta).crossings;
      expect(onCross).toBeLessThanOrEqual(offCross);
      expect(onPlace.crossingMinApplied).toBe(1);
      // eslint-disable-next-line no-console
      console.log(
        `[M6c rankSeparate+M4] crossings OFF=${offCross} ON=${onCross} ` +
          `applied=${onPlace.crossingMinApplied} moves=${onPlace.crossingMinMoves} ` +
          `proxy ${onPlace.crossingMinBefore}→${onPlace.crossingMinAfter} ` +
          `Δh=${onPlace.crossingMinHeightDeltaPx} Δw=${onPlace.crossingMinWidthDeltaPx} ` +
          `evalCap=${onPlace.crossingMinEvalCapReached}`,
      );

      // Whatever the real delta, the placed boxes are valid and the height/width deltas
      // are surfaced as scalars (reported, ungated per the user decision).
      expect(typeof onPlace.crossingMinHeightDeltaPx).toBe("number");
      expect(typeof onPlace.crossingMinWidthDeltaPx).toBe("number");
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 20,
  );

  it(
    "composes with de-band (vpc): gates stay 0, proxy never regresses — real delta recorded",
    async () => {
      const baseOpts = { compact: true, deBandLevel: "vpc" };
      const off = await buildV2(baseOpts);
      const on = await buildV2({ ...baseOpts, crossingMin: true });

      for (const built of [off, on]) {
        const place = placement(built.meta);
        const gates = gatesOf(built.meta);
        expect(place.containmentViolations).toBe(0);
        expect(place.siblingOverlapViolations).toBe(0);
        expect(gates.acyclicBackwardEdges).toBe(0);
        expect(built.diagnostics.collisionCount).toBe(0);
      }

      const onPlace = placement(on.meta);
      expect(onPlace.crossingMinAfter).toBeLessThanOrEqual(
        onPlace.crossingMinBefore,
      );
      // de-band vpc is also a measured win (268→221, −18 %): real count never regresses.
      expect(readability(on.meta).crossings).toBeLessThanOrEqual(
        readability(off.meta).crossings,
      );
      // eslint-disable-next-line no-console
      console.log(
        `[M6c deBand vpc] crossings OFF=${readability(off.meta).crossings} ` +
          `ON=${readability(on.meta).crossings} applied=${
            onPlace.crossingMinApplied
          } ` +
          `moves=${onPlace.crossingMinMoves} proxy ${onPlace.crossingMinBefore}→${onPlace.crossingMinAfter}`,
      );
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 20,
  );
});
