/**
 * RCLL subnet de-band (Phase 1a) — v2 integration suite.
 *
 * Subnet de-band collapses each VPC's subnet lanes: every subnet's clusters become DIRECT
 * VPC children, so the whole VPC shares ONE column stack instead of stacking each subnet
 * into its own disjoint Y band (`layoutLanesOnAxis` :607-617). Height drops from `Σ(subnet
 * bands)` toward the merged max-column-occupancy. X (`colByCluster`) is untouched ⇒ CON-12
 * holds. The subnet frame is suppressed (resources parent to the VPC frame); subnet
 * membership becomes a Phase-1b annotation, not built here.
 *
 * Internal/measurement-only — `subnetDeBand` is not threaded to the dialog/URL. Default OFF.
 *
 * MEASURED (2026-06-19, the durable artifact): the FIRST lever to materially move v2's
 * height after M4/de-density/junctions all no-op'd — Compact 14374→10147 (−29.4%),
 * Full 27763→20091 (−27.6%); width ~unchanged (−0.5%, X intact); all gates 0; rendered
 * collisions 0 (the suppressed subnet frames no longer overlap).
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

describe("rcll subnet de-band (Phase 1a, v2)", () => {
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
      meta: scene.meta,
      elements: scene.elements as ExcalidrawElement[],
      diagnostics: diagnosePipelineScene(scene.elements as ExcalidrawElement[]),
    };
  }

  const placement = (m: Record<string, unknown>) =>
    (m.rcllStageMeta as Record<string, Record<string, number>>).placement;
  const gatesOf = (m: Record<string, unknown>) =>
    m.gates as Record<string, number>;

  it(
    "collapses subnet lanes → shorter VPC stacks, all gates 0, X preserved, deterministic, frames parent-clean (Compact + Full)",
    async () => {
      for (const compact of [true, false]) {
        const mode = compact ? "compact" : "full";
        const off = await buildV2({ compact });
        const on = await buildV2({ compact, subnetDeBand: true });
        const on2 = await buildV2({ compact, subnetDeBand: true });

        // The win: the merged column stack is materially shorter than the Σ(subnet
        // bands) stack. (Measured ~−28/−29% on v2; assert a real drop, not the exact px.)
        expect(
          placement(on.meta).maxDepthPx,
          `${mode} de-band height < banded height`,
        ).toBeLessThan(placement(off.meta).maxDepthPx);

        // X is untouched (`colByCluster` is the de-band's invariant) — width within 2%.
        const offW = placement(off.meta).maxWidthPx;
        const onW = placement(on.meta).maxWidthPx;
        expect(
          Math.abs(onW - offW) / offW,
          `${mode} width preserved (CON-12 / X intact)`,
        ).toBeLessThan(0.02);

        // Milestone rolls up to the de-band tag.
        expect(on.meta.rcllMilestone, `${mode} milestone`).toBe("M7s");
        expect(on.meta.rcllSubnetDeBand, `${mode} meta flag`).toBe(true);
        expect(off.meta.rcllSubnetDeBand, `${mode} OFF meta flag`).toBe(false);

        // Every structural gate holds on the merged geometry (the pre-pass removes the
        // subnet nodes from the tree, so containment/siblingOverlap measure the correct
        // cluster-in-VPC / cluster-cluster geometry — no exemption needed).
        const onPlace = placement(on.meta);
        const onGates = gatesOf(on.meta);
        expect(onPlace.containmentViolations, `${mode} containment`).toBe(0);
        expect(
          onPlace.siblingOverlapViolations,
          `${mode} sibling overlap`,
        ).toBe(0);
        expect(
          onGates.acyclicBackwardEdges,
          `${mode} iron rule: no backward edge`,
        ).toBe(0);
        expect(
          onGates.acyclicSameColumnEdges,
          `${mode} iron rule: no same-column edge`,
        ).toBe(0);
        expect(on.diagnostics.collisionCount, `${mode} collision-free`).toBe(0);

        // Frame parenting is clean (the CRITICAL regression Codex flagged): the subnet
        // frame is SUPPRESSED, and NO element points at a dangling (missing) frame parent.
        // Element ids are remapped by convertToExcalidrawElements, so detect the frame role
        // via `customData.terraformTopologyRole` (gate-fix 3313c2d52), not the skeleton id.
        const frameElsOn = on.elements.filter((e) => e.type === "frame");
        const frameIds = new Set(frameElsOn.map((e) => e.id));
        const roleOf = (e: ExcalidrawElement): string =>
          ((e.customData as Record<string, unknown> | undefined)
            ?.terraformTopologyRole as string) ?? "";
        expect(
          off.elements.filter(
            (e) => e.type === "frame" && roleOf(e) === "subnetZone",
          ).length,
          `${mode} OFF has subnet frames (control)`,
        ).toBeGreaterThan(0);
        expect(
          frameElsOn.filter((e) => roleOf(e) === "subnetZone").length,
          `${mode} subnet frames suppressed`,
        ).toBe(0);
        expect(
          frameElsOn.filter((e) => roleOf(e) === "vpc").length,
          `${mode} VPC frames still emitted`,
        ).toBeGreaterThan(0);
        const dangling = on.elements.filter(
          (e) =>
            typeof e.frameId === "string" &&
            e.frameId !== null &&
            !frameIds.has(e.frameId),
        );
        expect(
          dangling.map((e) => `${e.type}:${e.id}->${e.frameId}`),
          `${mode} no element parented to a missing (suppressed-subnet) frame`,
        ).toEqual([]);

        // Determinism (CON-8): a second ON build is byte-identical.
        expect(geometry(on.elements), `${mode} ON deterministic`).toEqual(
          geometry(on2.elements),
        );

        // De-band is a REAL change (not a silent no-op): geometry differs from OFF.
        expect(
          geometry(on.elements),
          `${mode} de-band changes geometry`,
        ).not.toEqual(geometry(off.elements));

        // Phase 1b: subnet membership is restored as per-card rails + a tier legend.
        // Element ids are remapped by convertToExcalidrawElements, so detect rails/legend
        // via customData (which survives), not the skeleton id prefix.
        const cdOf = (e: ExcalidrawElement): Record<string, unknown> =>
          (e.customData as Record<string, unknown> | undefined) ?? {};
        const isChip = (e: ExcalidrawElement): boolean =>
          cdOf(e).terraformSubnetChip === true;
        const legend = on.elements.filter(
          (e) => cdOf(e).terraformSubnetLegend === true,
        );
        const rails = on.elements.filter(
          (e) => isChip(e) && cdOf(e).terraformSubnetLegend !== true,
        );
        expect(rails.length, `${mode} rails emitted`).toBeGreaterThan(0);
        expect(legend.length, `${mode} legend rows emitted`).toBeGreaterThan(0);
        // OFF has no annotation (it is de-band-only).
        expect(
          off.elements.filter(isChip).length,
          `${mode} OFF has no subnet annotation`,
        ).toBe(0);
        // Coverage: every annotation rail covers a distinct de-banded card; every chip
        // carries NO topology role (so the gates/diagnostics above ignored them).
        for (const e of on.elements.filter(isChip)) {
          expect(
            (e.customData as Record<string, unknown>).terraformTopologyRole,
            `${mode} chip is gate-invisible`,
          ).toBeUndefined();
        }
      }
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 8,
  );
});
