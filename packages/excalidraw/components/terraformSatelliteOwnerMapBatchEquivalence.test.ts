import graphlibDot from "@dagrejs/graphlib-dot";
import { describe, expect, it } from "vitest";

import { getTerraformImportPresetSourcesFromDb } from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";

import { resolveSourcesWithTfdComposition } from "./terraformImportCompositionResolve";
import {
  buildTerraformLocalImportNodesMap,
  withTerraformPlanNodeKeyIndex,
} from "./terraformPlanParsing";
import { isPrimaryVisibleResourceType } from "./terraformPrimaryVisibility";
import {
  buildNodesByTypeIndex,
  getFallbackScanCount,
  resetFallbackScanCount,
} from "./terraformTopologySatelliteEngine";
import { buildArnIndexForTopology } from "./terraformTopologyIamLinks";
import {
  buildAllSatellitePrimaryMappings,
  collectTopologySatelliteAddressesFromRegistry,
} from "./terraformTopologySatelliteRegistry";

import type { TerraformImportPresetSources } from "./terraformImportPresetsTypes";
import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

/**
 * T2 - equivalence test for `buildAllSatellitePrimaryMappings`, the batch satellite->primary
 * resolver added to replace the inline per-primary loop in `buildSatelliteOwnerMap`.
 *
 * Two independent guarantees, both checked against staging-extended-localstack-v2 (the
 * satellite-heavy RCLL fixture):
 *
 * 1. `buildAllSatellitePrimaryMappings` produces the exact same satellite->primary map as a
 *    reference resolver written with DIFFERENT control flow: instead of "iterate primaries in
 *    sorted order, first writer wins" (production's trick), the reference collects ALL
 *    claimants per satellite up front, then explicitly picks the lexicographically-first
 *    claimant. Equivalent semantics, different code path - a real cross-check rather than a
 *    renamed copy.
 * 2. The fixture actually exercises contested satellites (a satellite claimed by more than one
 *    primary) and multiple satellite kinds, so the equivalence check isn't vacuous.
 */

function resourceTypeForNode(
  nodes: TerraformPlanNodesMap,
  address: string,
): string {
  const node = nodes[address] as
    | { resources?: Record<string, { type?: unknown }> }
    | undefined;
  const first = Object.values(node?.resources ?? {})[0];
  return typeof first?.type === "string" ? first.type : "";
}

/** Independent reference: collect every (satellite, primary) claim, then resolve ties explicitly. */
function naiveBuildSatelliteOwnerMap(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  primaryAddresses: readonly string[],
  plan: unknown,
): Map<string, string> {
  const claimsBySatellite = new Map<string, string[]>();

  for (const primaryAddress of primaryAddresses) {
    const satellites = collectTopologySatelliteAddressesFromRegistry(
      nodes,
      arnIndex,
      [primaryAddress],
      plan,
    );
    for (const sat of satellites) {
      const claimants = claimsBySatellite.get(sat) ?? [];
      claimants.push(primaryAddress);
      claimsBySatellite.set(sat, claimants);
    }
  }

  const out = new Map<string, string>();
  for (const [sat, claimants] of claimsBySatellite) {
    const winner = [...claimants].sort()[0]!;
    out.set(sat, winner);
  }
  return out;
}

async function loadFixtureNodesAndPlan() {
  const raw = getTerraformImportPresetSourcesFromDb(
    "staging-extended-localstack-v2",
  );
  const sources = resolveSourcesWithTfdComposition(
    raw! as TerraformImportPresetSources,
  );
  const bundle = sources.planDotBundles[0]!;
  const graph = graphlibDot.read("digraph G {}\n");
  const nodes = buildTerraformLocalImportNodesMap(bundle.plan, graph, [], {});
  return { nodes, plan: bundle.plan };
}

describe("buildAllSatellitePrimaryMappings equivalence (T2)", () => {
  it("matches an independently-written reference resolver on staging-extended-localstack-v2", async () => {
    const { nodes, plan } = await loadFixtureNodesAndPlan();

    const primaryAddresses = Object.keys(nodes)
      .filter((key) => !key.startsWith("__"))
      .filter((addr) =>
        isPrimaryVisibleResourceType(resourceTypeForNode(nodes, addr)),
      )
      .sort();
    expect(primaryAddresses.length).toBeGreaterThan(20);

    const { batchResult, naiveResult } = withTerraformPlanNodeKeyIndex(
      nodes,
      () => {
        const arnIndex = buildArnIndexForTopology(nodes);
        return {
          batchResult: buildAllSatellitePrimaryMappings(
            nodes,
            arnIndex,
            primaryAddresses,
            plan,
          ),
          naiveResult: naiveBuildSatelliteOwnerMap(
            nodes,
            arnIndex,
            primaryAddresses,
            plan,
          ),
        };
      },
    );

    // Non-vacuous: the fixture must actually produce a meaningful satellite set.
    expect(batchResult.size).toBeGreaterThan(20);
    expect(naiveResult.size).toBe(batchResult.size);

    expect(Object.fromEntries(batchResult)).toEqual(
      Object.fromEntries(naiveResult),
    );
  }, 60_000);

  it("resolves a contested satellite to the lexicographically-first primary, matching production semantics", async () => {
    const { nodes, plan } = await loadFixtureNodesAndPlan();

    const primaryAddresses = Object.keys(nodes)
      .filter((key) => !key.startsWith("__"))
      .filter((addr) =>
        isPrimaryVisibleResourceType(resourceTypeForNode(nodes, addr)),
      )
      .sort();

    const { batchResult, claimsBySatellite } = withTerraformPlanNodeKeyIndex(
      nodes,
      () => {
        const arnIndex = buildArnIndexForTopology(nodes);
        const claims = new Map<string, string[]>();
        for (const primaryAddress of primaryAddresses) {
          for (const sat of collectTopologySatelliteAddressesFromRegistry(
            nodes,
            arnIndex,
            [primaryAddress],
            plan,
          )) {
            const list = claims.get(sat) ?? [];
            list.push(primaryAddress);
            claims.set(sat, list);
          }
        }
        return {
          batchResult: buildAllSatellitePrimaryMappings(
            nodes,
            arnIndex,
            primaryAddresses,
            plan,
          ),
          claimsBySatellite: claims,
        };
      },
    );

    const contested = [...claimsBySatellite.entries()].filter(
      ([, claimants]) => claimants.length > 1,
    );
    expect(contested.length).toBeGreaterThan(0);

    for (const [sat, claimants] of contested) {
      const expectedWinner = [...claimants].sort()[0]!;
      expect(batchResult.get(sat)).toBe(expectedWinner);
    }
  }, 60_000);

  it("buildNodesByTypeIndex partitions every real node path into exactly one type bucket", async () => {
    const { nodes } = await loadFixtureNodesAndPlan();
    const nodesByType = buildNodesByTypeIndex(nodes);
    const allBucketed = [...nodesByType.values()].flat();
    const realPaths = Object.keys(nodes).filter(
      (k) => k !== "__module_tree__" && !k.startsWith("__"),
    );
    expect(new Set(allBucketed)).toEqual(new Set(realPaths));
    expect(allBucketed.length).toBe(realPaths.length); // non-vacuous: no path duplicated across buckets
    expect(nodesByType.size).toBeGreaterThan(5);
  }, 60_000);

  it("every plugin scan site uses the nodesByType index — zero fallback scans", async () => {
    const { nodes, plan } = await loadFixtureNodesAndPlan();

    const primaryAddresses = Object.keys(nodes)
      .filter((key) => !key.startsWith("__"))
      .filter((addr) =>
        isPrimaryVisibleResourceType(resourceTypeForNode(nodes, addr)),
      )
      .sort();

    resetFallbackScanCount();
    withTerraformPlanNodeKeyIndex(nodes, () => {
      const arnIndex = buildArnIndexForTopology(nodes);
      buildAllSatellitePrimaryMappings(nodes, arnIndex, primaryAddresses, plan);
    });
    // A nonzero count means some scan site never received nodesByType despite the
    // index being supplied — i.e. it's still doing the full O(N) scan silently.
    expect(getFallbackScanCount()).toBe(0);
  }, 60_000);
});
