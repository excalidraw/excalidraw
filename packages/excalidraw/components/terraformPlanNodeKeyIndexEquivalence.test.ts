import graphlibDot from "@dagrejs/graphlib-dot";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS } from "../test-fixtures/terraformPresetFixtures";

import {
  stagingMultiStateLayoutSources,
  stagingMultiStatePipelineLayoutSources,
} from "./terraformLayoutSnapshotFixtures";

import * as terraformPlanParsingModule from "./terraformPlanParsing";

import {
  collectKnownStackIdsFromNodes,
  parseStackAddress,
  preferTopologyNodeKeyAmongAliases,
  prefixStackAddress,
  topologyBareAddressKey,
} from "./terraformStackAddress";

import type { TerraformPlanGraphNode } from "./terraformPlanParsing";

/**
 * T4 - equivalence test for the scoped TerraformPlanNodeKeyIndex fast path added to
 * resolveTerraformPlanNodeKey. Three independent guarantees:
 *
 * 1. A naive, from-scratch reference resolver (below) checked against the indexed path
 *    (resolveTerraformPlanNodeKey called inside withTerraformPlanNodeKeyIndex) across every fixture used
 *    by terraformLayoutSnapshot.test.ts, on a corpus of addresses harvested from real call sites during an
 *    actual fixture build (not just structural node-key/edge addresses).
 * 2. A synthetic construction-time regression test proving buildTerraformLocalImportNodesMap's
 *    depends_on resolution (which runs entirely outside any withTerraformPlanNodeKeyIndex scope) is
 *    unaffected by the new indexed path.
 * 3. A nested-scope test proving withTerraformPlanNodeKeyIndex's "previous"-restoration semantics.
 */

// ---------------------------------------------------------------------------
// 1. Independent, deliberately brute-force reference resolver.
//
// This is NOT a copy of resolveTerraformPlanNodeKey's control flow - it re-derives the same semantics from
// the doc comment ("Map a Terraform address (plan / prior_state / depends_on) to a key in nodes") and from
// reading the production function, but is written from scratch using the most obvious brute-force
// approach: scan every key in nodes, bucket candidates, and apply the same disambiguation rules
// (qualified-stack match preferred, ambiguity -> null). It reuses only small pure string utilities the
// plan explicitly allows reusing (topologyBareAddressKey, and an inline reimplementation of the private
// stripTerraformAddressIndexes helper) plus the stack-address helpers from terraformStackAddress.ts
// (parseStackAddress / prefixStackAddress / collectKnownStackIdsFromNodes /
// preferTopologyNodeKeyAmongAliases) - none of these are the multi-stage scan control flow being tested.
// ---------------------------------------------------------------------------

const MODULE_TREE_KEY = "__module_tree__";

/** stripTerraformAddressIndexes is private to terraformPlanParsing.tsx; same trivial regex, reimplemented. */
function naiveStripInstanceIndexes(address: string): string {
  return address.replace(/\[[^\]]+\]/g, "");
}

function naiveRealKeys(nodes: Record<string, unknown>): string[] {
  return Object.keys(nodes).filter(
    (k) => k !== MODULE_TREE_KEY && !k.startsWith("__"),
  );
}

/**
 * Brute-force resolver: for the given address, walk every real key in nodes and decide the match using the
 * same high-level rules resolveTerraformPlanNodeKey documents: prefer an exact stack-qualified match, fall
 * back to bare-address aliasing, then to known-stack-id qualification, then to instance-index-stripped
 * graph-id matching; ambiguity (more than one candidate at any decisive stage) resolves to null.
 */
function naiveResolveTerraformPlanNodeKey(
  nodes: Record<string, TerraformPlanGraphNode>,
  address: string,
): string | null {
  if (!address || typeof address !== "string" || address === MODULE_TREE_KEY) {
    return null;
  }

  const realKeys = naiveRealKeys(nodes);
  const parsedAddress = parseStackAddress(address);
  const bareKey = topologyBareAddressKey(address);

  if (parsedAddress) {
    const stackAliases: string[] = [];
    const exactMatches: string[] = [];
    for (const k of realKeys) {
      if (topologyBareAddressKey(k) !== bareKey) {
        continue;
      }
      const kParsed = parseStackAddress(k);
      if (kParsed?.stackId === parsedAddress.stackId) {
        stackAliases.push(k);
        if (kParsed.address === parsedAddress.address) {
          exactMatches.push(k);
        }
      } else if (!kParsed) {
        stackAliases.push(k);
        if (k === parsedAddress.address) {
          exactMatches.push(k);
        }
      }
    }
    if (exactMatches.length === 1) {
      return exactMatches[0]!;
    }
    if (stackAliases.length > 0) {
      return preferTopologyNodeKeyAmongAliases(stackAliases);
    }
  } else {
    const qualifiedMatches = realKeys.filter(
      (k) => parseStackAddress(k) && topologyBareAddressKey(k) === bareKey,
    );
    if (qualifiedMatches.length === 1) {
      return qualifiedMatches[0]!;
    }
    if (qualifiedMatches.length > 1) {
      return null;
    }
    if (
      Object.prototype.hasOwnProperty.call(nodes, address) &&
      nodes[address]
    ) {
      return address;
    }
  }

  const graphId = naiveStripInstanceIndexes(address);
  const knownStackIds = collectKnownStackIdsFromNodes(nodes);

  if (knownStackIds.length > 0 && !address.includes("::")) {
    const qualifiedCandidates = new Set<string>();
    for (const stackId of knownStackIds) {
      const qualified = prefixStackAddress(stackId, address);
      if (nodes[qualified]) {
        qualifiedCandidates.add(qualified);
      }
      const qualifiedStripped = prefixStackAddress(stackId, graphId);
      if (nodes[qualifiedStripped]) {
        qualifiedCandidates.add(qualifiedStripped);
      }
    }
    if (qualifiedCandidates.size === 1) {
      return [...qualifiedCandidates][0]!;
    }
    if (qualifiedCandidates.size > 1) {
      return null;
    }
  }

  const graphMatches = realKeys.filter(
    (k) => naiveStripInstanceIndexes(k) === graphId,
  );
  if (graphMatches.length === 1) {
    return graphMatches[0]!;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 2. Harvested real-call-site corpus.
//
// resolveTerraformPlanNodeKey is imported by name in ~40 production files. We harvest by spying directly
// on the live module namespace object (vi.spyOn) rather than `vi.mock(..., { importActual })`: this module
// has a circular import with terraformDeclaredDataFlow.ts (terraformPlanParsing.tsx statically imports
// applyDeclaredDataFlow from it, which in turn statically imports resolveTerraformPlanNodeKey back from
// terraformPlanParsing.tsx). `importActual()` re-evaluates that whole subgraph as a *separate* module
// instance, so a `vi.mock` wrapper only sees calls that happen to route through the mock registry's
// instance - it silently misses every call made from within that real subgraph (confirmed empirically:
// `vi.mock` + `importActual` harvested 0 calls across a full fixture build, while terraformDeclaredDataFlow
// alone, called directly, clearly does call resolveTerraformPlanNodeKey). `vi.spyOn` mutates the one
// shared module export in place instead of creating a parallel instance, so every caller - regardless of
// which side of the circular import it's on - goes through the spy. This is self-contained to this test
// file's setup (no permanent scaffolding), deterministic (same fixtures every run), and fast (it just
// drives the existing fixture builds the snapshot test already exercises - no extra work).
// ---------------------------------------------------------------------------

type HarvestedCall = {
  nodes: Record<string, TerraformPlanGraphNode>;
  address: string;
};

describe("resolveTerraformPlanNodeKey indexed path equivalence", () => {
  beforeAll(() => {
    if (process.env.VITEST_TERRAFORM_VERBOSE !== "1") {
      vi.spyOn(console, "log").mockImplementation(() => {});
    }
  });

  async function harvestFromFixtureBuild(
    sources: Parameters<
      typeof terraformPlanParsingModule.terraformPlanParsingFromSources
    >[0],
    layoutMode: "module" | "semantic" | "pipeline",
  ) {
    const res =
      await terraformPlanParsingModule.terraformPlanParsingFromSources(
        sources,
        {
          semanticLayout: layoutMode === "semantic",
          layoutMode,
        },
      );
    expect(res.ok).toBe(true);
  }

  it(
    "equivalence: indexed path matches the independent naive resolver across every harvested real call-site address",
    async () => {
      const harvestedCalls: HarvestedCall[] = [];
      const originalResolve =
        terraformPlanParsingModule.resolveTerraformPlanNodeKey;
      const spy = vi
        .spyOn(terraformPlanParsingModule, "resolveTerraformPlanNodeKey")
        .mockImplementation((nodes, address) => {
          harvestedCalls.push({ nodes, address });
          return originalResolve(nodes, address);
        });

      try {
        await harvestFromFixtureBuild(
          stagingMultiStateLayoutSources(),
          "semantic",
        );
        await harvestFromFixtureBuild(
          stagingMultiStateLayoutSources(),
          "module",
        );
        await harvestFromFixtureBuild(
          stagingMultiStatePipelineLayoutSources(),
          "pipeline",
        );
      } finally {
        spy.mockRestore();
      }

      expect(harvestedCalls.length).toBeGreaterThan(0);

      const { withTerraformPlanNodeKeyIndex, resolveTerraformPlanNodeKey } =
        terraformPlanParsingModule;

      // De-duplicate by (nodes ref, address) - repeated calls with the same pair are redundant work for
      // the equivalence check, not new corpus signal. Scope the dedupe key per nodes ref (via a counter)
      // so addresses that happen to repeat across different fixture builds never collide.
      const nodesRefIds = new WeakMap<object, number>();
      const seen = new Set<string>();
      let nextRefId = 0;
      let comparisons = 0;
      let discrepancies = 0;
      const discrepancyDetails: string[] = [];

      for (const { nodes, address } of harvestedCalls) {
        let refId = nodesRefIds.get(nodes);
        if (refId === undefined) {
          refId = nextRefId++;
          nodesRefIds.set(nodes, refId);
        }
        const key = `${refId} ${address}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        const indexedResult = withTerraformPlanNodeKeyIndex(nodes, () =>
          resolveTerraformPlanNodeKey(nodes, address),
        );
        const naiveResult = naiveResolveTerraformPlanNodeKey(nodes, address);

        comparisons++;
        if (indexedResult !== naiveResult) {
          discrepancies++;
          discrepancyDetails.push(
            `address=${JSON.stringify(address)} indexed=${JSON.stringify(
              indexedResult,
            )} naive=${JSON.stringify(naiveResult)}`,
          );
        }
      }

      if (discrepancies > 0) {
        throw new Error(
          `${discrepancies}/${comparisons} discrepancies between indexed path and naive reference resolver:\n${discrepancyDetails
            .slice(0, 25)
            .join("\n")}`,
        );
      }

      // The RCA measured ~12,000 calls per build on a smaller subset; this corpus spans 3 full fixture
      // builds (semantic, module, pipeline) over the full 25-stack staging-multi-state preset, so a
      // healthy corpus should be in the tens of thousands of unique (nodes, address) pairs, not a handful.
      expect(comparisons).toBeGreaterThan(1000);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );
});

describe("resolveTerraformPlanNodeKey construction-time path (unaffected by the indexed fast path)", () => {
  it("buildTerraformLocalImportNodesMap resolves a depends_on reference to a resource inserted earlier in the same construction pass", async () => {
    const { buildTerraformLocalImportNodesMap } = await import(
      "./terraformPlanParsing"
    );
    const graph = graphlibDot.read("digraph G {}\n");

    const plan = {
      resource_changes: [
        {
          address: "aws_vpc.main",
          type: "aws_vpc",
          name: "main",
          mode: "managed",
          change: { actions: ["no-op"] },
        },
        {
          address: "aws_subnet.a",
          type: "aws_subnet",
          name: "a",
          mode: "managed",
          change: { actions: ["no-op"] },
        },
      ],
      // buildExistingEdges walks prior_state.values.root_module and, for each resource's depends_on,
      // resolves the dependency address against nodes mid-construction - entirely outside any
      // withTerraformPlanNodeKeyIndex scope (that scope is only ever active inside preparePipelineLayout,
      // which runs later in the pipeline, not during node-map construction).
      prior_state: {
        values: {
          root_module: {
            resources: [
              {
                address: "aws_vpc.main",
                mode: "managed",
                type: "aws_vpc",
                depends_on: [],
              },
              {
                address: "aws_subnet.a",
                mode: "managed",
                type: "aws_subnet",
                // References aws_vpc.main, which was inserted earlier in the same resources array /
                // construction pass.
                depends_on: ["aws_vpc.main"],
              },
            ],
          },
        },
      },
    };

    const nodes = buildTerraformLocalImportNodesMap(plan, graph, []);

    expect(nodes["aws_vpc.main"]).toBeDefined();
    expect(nodes["aws_subnet.a"]).toBeDefined();
    expect(nodes["aws_subnet.a"]?.edges_existing).toContain("aws_vpc.main");
  });
});

describe("withTerraformPlanNodeKeyIndex nested-scope restoration", () => {
  it("restores the outer index after an inner scope with a different nodes ref exits", async () => {
    const { withTerraformPlanNodeKeyIndex, resolveTerraformPlanNodeKey } =
      await import("./terraformPlanParsing");

    const nodesA: Record<string, TerraformPlanGraphNode> = {
      "aws_vpc.main": { resources: {} },
      "stack-a::aws_vpc.main": { resources: {} },
    };
    const nodesB: Record<string, TerraformPlanGraphNode> = {
      "aws_subnet.b": { resources: {} },
      "stack-b::aws_subnet.b": { resources: {} },
    };

    withTerraformPlanNodeKeyIndex(nodesA, () => {
      // Sanity: resolving against nodesA inside the outer scope works as expected before nesting.
      expect(resolveTerraformPlanNodeKey(nodesA, "aws_vpc.main")).toBe(
        "stack-a::aws_vpc.main",
      );

      withTerraformPlanNodeKeyIndex(nodesB, () => {
        // Inner scope: resolution must use nodesB's index, not nodesA's.
        expect(resolveTerraformPlanNodeKey(nodesB, "aws_subnet.b")).toBe(
          "stack-b::aws_subnet.b",
        );
        // A lookup against nodesA's address while the active index is scoped to nodesB falls back to the
        // original (unindexed) scan path via the ref-equality guard, and must still resolve correctly
        // against nodesA itself (the ref-mismatch defends against silent misresolution, not a crash).
        expect(resolveTerraformPlanNodeKey(nodesA, "aws_vpc.main")).toBe(
          "stack-a::aws_vpc.main",
        );
      });

      // After the inner scope exits, resolution against nodesA must use nodesA's index again (proving
      // "previous" restoration, not clearing to null).
      expect(resolveTerraformPlanNodeKey(nodesA, "aws_vpc.main")).toBe(
        "stack-a::aws_vpc.main",
      );
    });

    // Outside any scope at all, the original fallback path still resolves both correctly.
    expect(resolveTerraformPlanNodeKey(nodesA, "aws_vpc.main")).toBe(
      "stack-a::aws_vpc.main",
    );
    expect(resolveTerraformPlanNodeKey(nodesB, "aws_subnet.b")).toBe(
      "stack-b::aws_subnet.b",
    );
  });
});
