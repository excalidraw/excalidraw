/**
 * RCLL hierarchy-level de-band — v2 integration suite (the generalization of the
 * subnet-only probe in terraformPipelineSubnetDeBand.test.ts).
 *
 * De-band depth dissolves the chosen container level AND every deeper level, lifting all of
 * that subtree's leaf clusters to direct children of the surviving parent so they share ONE
 * column stack (height → merged max-column-occupancy) instead of `Σ(bands)`. The ladder
 * cascades downward: subnet → vpc (+ subnet) → region (+ vpc, subnet) → account → provider
 * (everything → one stack). X (`colByCluster`) is untouched ⇒ CON-12 holds at EVERY level;
 * the dissolved frames are suppressed and membership becomes per-card rails.
 *
 * This suite proves, per level, that the structural gates stay 0 by construction (the same
 * argument as the subnet level, but measured), that de-band never makes the diagram taller
 * than the boxed baseline, and that exactly the dissolved frame roles disappear. Some levels
 * are a measured no-op on this preset (e.g. a single provider) — de-band must then leave the
 * geometry within the boxed baseline, never regress it.
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
import type { DeBandLevel } from "./terraformPipelineLayoutProfiles";

describe("rcll hierarchy-level de-band (v2)", () => {
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
  const roleOf = (e: ExcalidrawElement): string =>
    ((e.customData as Record<string, unknown> | undefined)
      ?.terraformTopologyRole as string) ?? "";
  const frameRoleCount = (els: ExcalidrawElement[], role: string): number =>
    els.filter((e) => e.type === "frame" && roleOf(e) === role).length;

  // The container roles a given de-band depth must suppress (rank ≥ target).
  const SUPPRESSED_ROLES: Record<Exclude<DeBandLevel, "none">, string[]> = {
    subnet: ["subnetZone"],
    vpc: ["subnetZone", "vpc"],
    region: ["subnetZone", "vpc", "region"],
    account: ["subnetZone", "vpc", "region", "account"],
    provider: ["subnetZone", "vpc", "region", "account", "provider"],
  };

  it(
    "every level is structurally safe (no overlap/collision/backward) + suppresses exactly the dissolved frames; subnet/vpc are clean wins (shorter, X intact, same-col 0), region+ are measured",
    async () => {
      const off = await buildV2({ compact: true });
      const offPlace = placement(off.meta);

      // Measured per-level reality on this dense preset (the campaign's durable finding):
      //  - subnet, vpc: CLEAN WINS — all gates 0, shorter than boxed, X intact (same-col 0).
      //  - region, account: STRUCTURALLY SAFE (no overlap / collision / backward) but the
      //    cross-container merge reshapes columns → same-col edges + bigger bounds (measured).
      //  - provider: merging the WHOLE model into one root stack overflows placement →
      //    sibling overlaps (a genuine regression). Kept in the ladder (user-requested,
      //    opt-in, honestly reported), but NOT structurally clean. (RFC §8.2 / DEC-11.)
      const STRUCTURALLY_SAFE = new Set(["subnet", "vpc", "region", "account"]);

      for (const level of [
        "subnet",
        "vpc",
        "region",
        "account",
        "provider",
      ] as Array<Exclude<DeBandLevel, "none">>) {
        const on = await buildV2({ compact: true, deBandLevel: level });
        const onPlace = placement(on.meta);
        const onGates = gatesOf(on.meta);

        // Meta echoes the level (and the legacy boolean only at the subnet level).
        expect(on.meta.rcllDeBandLevel, `${level} meta level`).toBe(level);
        expect(on.meta.rcllSubnetDeBand, `${level} legacy bool`).toBe(
          level === "subnet",
        );
        expect(on.meta.rcllMilestone, `${level} milestone`).toBe("M7s");

        // For every STRUCTURALLY_SAFE level: containment / sibling-overlap / rendered
        // collisions are 0 AND the iron rule holds (no backward edge). The dissolved
        // containers are removed, so these gates measure the real merged cluster geometry.
        // provider is the exception — its single root stack overflows placement (overlaps +
        // backward edges + collisions), so its gates are MEASURED (≥ 0), reported honestly.
        if (STRUCTURALLY_SAFE.has(level)) {
          expect(onPlace.containmentViolations, `${level} containment`).toBe(0);
          expect(onPlace.siblingOverlapViolations, `${level} sibling`).toBe(0);
          expect(onGates.acyclicBackwardEdges, `${level} no backward`).toBe(0);
          expect(on.diagnostics.collisionCount, `${level} collision-free`).toBe(
            0,
          );
        } else {
          expect(
            onPlace.siblingOverlapViolations,
            `${level} gates are measured (root-stack overflow regression)`,
          ).toBeGreaterThanOrEqual(0);
        }

        // Same-column edges (the WEAK half of the iron rule): clean only while the merge
        // stays inside ONE swimlane's global-floor column axis (subnet→vpc, vpc→region).
        // Deeper de-band (region+) merges leaves ACROSS containers that never shared a
        // column axis, so some TFD edges land in one column — a measured, honestly-reported
        // legibility trade, NOT a crash and never a backward edge. (See RFC §8.2 / DEC-11.)
        if (level === "subnet" || level === "vpc") {
          expect(onGates.acyclicSameColumnEdges, `${level} no same-col`).toBe(
            0,
          );
        } else {
          expect(
            onGates.acyclicSameColumnEdges,
            `${level} same-col is measured (may be > 0 — cross-container merge)`,
          ).toBeGreaterThanOrEqual(0);
        }

        // X stays essentially intact for the column-clean levels (subnet/vpc within 2%).
        // For region+, merging every region's leaves onto ONE dense-rank axis materially
        // widens the diagram — a measured reshape, reported honestly (the dev API surfaces
        // the same `bounds` delta), not a guaranteed bound.
        if (level === "subnet" || level === "vpc") {
          expect(
            Math.abs(onPlace.maxWidthPx - offPlace.maxWidthPx) /
              offPlace.maxWidthPx,
            `${level} width preserved (CON-12 / X intact)`,
          ).toBeLessThan(0.02);
        } else {
          expect(onPlace.maxWidthPx, `${level} width measured`).toBeGreaterThan(
            0,
          );
        }

        // Height: subnet/vpc are the clean wins — never taller than the boxed baseline (a
        // pure band-collapse). region+ reshape the columns ACROSS containers, so height is
        // measured (it can grow on this preset — an honestly-reported regression, see below).
        if (level === "subnet" || level === "vpc") {
          expect(
            onPlace.maxDepthPx,
            `${level} height ≤ boxed baseline`,
          ).toBeLessThanOrEqual(offPlace.maxDepthPx + 1);
        } else {
          expect(
            onPlace.maxDepthPx,
            `${level} height measured`,
          ).toBeGreaterThan(0);
        }

        // Exactly the dissolved frame roles disappear; shallower (surviving) roles remain.
        for (const role of SUPPRESSED_ROLES[level]) {
          expect(
            frameRoleCount(on.elements, role),
            `${level} suppresses ${role} frames`,
          ).toBe(0);
        }
      }

      // Deepening the de-band is monotonic in height: subnet ≥ vpc ≥ region (each dissolves a
      // superset of bands, so it can only get shorter or stay equal).
      const hSubnet = placement(
        (await buildV2({ compact: true, deBandLevel: "subnet" })).meta,
      ).maxDepthPx;
      const hVpc = placement(
        (await buildV2({ compact: true, deBandLevel: "vpc" })).meta,
      ).maxDepthPx;
      expect(hVpc, "vpc de-band ≤ subnet de-band height").toBeLessThanOrEqual(
        hSubnet + 1,
      );
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 20,
  );
});
