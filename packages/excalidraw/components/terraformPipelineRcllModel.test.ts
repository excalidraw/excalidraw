/**
 * Unit tests for the RCLL M1 model builder (docs/pipeline-rcll-layout-design.md
 * §6/§7.1, REQ-9, DEC-2). M1 builds the compound tree + lattice and changes NO
 * geometry, so these are pure-data tests over synthetic prep fixtures:
 *
 *   - buildCompoundTree: roles/levels, LEAF KEYS = cluster.id (F2 — same-subnet
 *     siblings must not collide), minDescendantSequence, deterministic order
 *   - computeUpperBounds / slack: chain, diamond, sink, UB = min over successors,
 *     and the clamp that keeps slack ≥ 0 under a cycle artifact
 *   - buildFanSets: ≥2 grouping (de-duped), both directions
 *   - buildHullEdges (D_H): up-projection at the LCA; same-subnet sibling edge
 *     KEPT (F2); cross-provider → root container; intra-child excluded; parallel
 *     edges accumulate weight; declared-edge merge by (from,to) WITHOUT
 *     double-counting weight (F1)
 *   - detectContainerCycles: flags only the cyclic container
 *   - buildRcllModel: degenerate inputs do NOT throw (F3 compensating control)
 *
 * Run: yarn vitest run packages/excalidraw/components/terraformPipelineRcllModel.test.ts
 */
import { describe, expect, it } from "vitest";

import {
  RCLL_ROOT_KEY,
  buildCompoundTree,
  buildFanSets,
  buildHullEdges,
  buildRcllModel,
  computeUpperBounds,
  detectContainerCycles,
  summarizeRcllModel,
} from "./terraformPipelineRcllModel";
import { topologyRoleAndKeyFromPath } from "./terraformPipelineTopologyFrames";

import type {
  CollapsedPipelineEdge,
  PipelineCluster,
  PipelineLayoutPrep,
  PipelinePlacement,
} from "./terraformPipelineLayoutShared";
import type { CompoundNode, HullEdge } from "./terraformPipelineRcllTypes";

// ── fixtures ────────────────────────────────────────────────────────────────

function placement(
  providerFamily: string,
  accountId: string,
  region: string,
  vpcId: string | null = null,
  subnetSignature?: string,
): PipelinePlacement {
  return { providerFamily, accountId, region, vpcId, subnetSignature };
}

function cluster(
  id: string,
  p: PipelinePlacement,
  firstSequence: number,
): PipelineCluster {
  // The model only reads id / firstSequence / placement; `build` is never
  // touched, so a placeholder is safe.
  return {
    id,
    primaryAddress: id,
    firstSequence,
    depth: 0,
    placement: p,
    build: {} as PipelineCluster["build"],
  };
}

function edge(
  source: string,
  target: string,
  sequence: number,
): CollapsedPipelineEdge {
  return {
    source,
    target,
    sequence,
    original: { source, target, sequence, origin: "tfd" },
  };
}

function prep(
  clusters: PipelineCluster[],
  collapsedEdges: CollapsedPipelineEdge[],
  depths: Map<string, number>,
  hasCycle = false,
): PipelineLayoutPrep {
  return {
    clusters,
    collapsedEdges,
    maxDepth: Math.max(0, ...depths.values()),
    columnX: [],
    depthResult: { depths, hasCycle },
    satelliteOwners: new Map(),
    placementByAddress: new Map(),
  };
}

/** Find a node by key in the tree (DFS). */
function findNode(node: CompoundNode, key: string): CompoundNode | undefined {
  if (node.key === key) {
    return node;
  }
  for (const child of node.children) {
    const hit = findNode(child, key);
    if (hit) {
      return hit;
    }
  }
  return undefined;
}

const subnetKey = (
  pf: string,
  acct: string,
  region: string,
  vpc: string,
  subnet: string,
): string => topologyRoleAndKeyFromPath([pf, acct, region, vpc, subnet])!.key;

// ── buildCompoundTree ─────────────────────────────────────────────────────────

describe("buildCompoundTree", () => {
  it("nests provider→account→region and makes leaves children of the deepest container", () => {
    const a = cluster("res.a", placement("aws", "111", "us-east-1"), 0);
    const tree = buildCompoundTree([a]);

    expect(tree.key).toBe(RCLL_ROOT_KEY);
    expect(tree.role).toBe("root");
    expect(tree.level).toBe(0);

    const provider = tree.children[0]!;
    expect(provider.role).toBe("provider");
    expect(provider.level).toBe(1);
    const account = provider.children[0]!;
    expect(account.role).toBe("account");
    expect(account.level).toBe(2);
    const region = account.children[0]!;
    expect(region.role).toBe("region");
    expect(region.level).toBe(3);

    const leaf = region.children[0]!;
    expect(leaf.role).toBe("primaryCluster");
    expect(leaf.key).toBe("res.a"); // F2: leaf keyed by cluster id
    expect(leaf.level).toBe(4);
    expect(leaf.cluster).toBe(a);
    expect(leaf.children).toEqual([]);
  });

  it("keeps two clusters in the SAME subnet as DISTINCT leaves (F2 — no path collision)", () => {
    const p = placement("aws", "111", "us-east-1", "vpc-1", "private");
    const a = cluster("res.a", p, 0);
    const b = cluster("res.b", p, 1);
    const tree = buildCompoundTree([a, b]);

    const sub = findNode(
      tree,
      subnetKey("aws", "111", "us-east-1", "vpc-1", "private"),
    );
    expect(sub, "subnetZone container exists").toBeDefined();
    expect(sub!.role).toBe("subnetZone");
    const leafKeys = sub!.children.map((c) => c.key).sort();
    expect(leafKeys).toEqual(["res.a", "res.b"]); // two distinct leaves, not one
  });

  it("computes minDescendantSequence bottom-up and orders children by it", () => {
    // account 111 first touched at seq 5; account 222 at seq 2 → 222 sorts first.
    const a = cluster("res.a", placement("aws", "111", "us-east-1"), 5);
    const b = cluster("res.b", placement("aws", "222", "us-east-1"), 2);
    const tree = buildCompoundTree([a, b]);
    const provider = tree.children[0]!;
    expect(provider.minDescendantSequence).toBe(2);
    const accountIds = provider.children.map(
      (c) => c.cluster?.id ?? c.children[0]?.children[0]?.cluster?.id,
    );
    // 222's subtree (min seq 2) precedes 111's subtree (min seq 5).
    expect(provider.children[0]!.minDescendantSequence).toBe(2);
    expect(provider.children[1]!.minDescendantSequence).toBe(5);
    expect(accountIds.length).toBe(2);
  });

  it("is deterministic across two builds (same tree shape + keys + order)", () => {
    const clusters = [
      cluster("res.b", placement("aws", "111", "us-east-1"), 3),
      cluster("res.a", placement("aws", "111", "us-east-1"), 1),
      cluster("res.c", placement("aws", "222", "eu-west-1"), 2),
    ];
    const keys = (n: CompoundNode): unknown => [
      n.key,
      n.role,
      n.level,
      n.children.map(keys),
    ];
    expect(keys(buildCompoundTree(clusters))).toEqual(
      keys(buildCompoundTree([...clusters].reverse())),
    );
  });
});

// ── computeUpperBounds / slack ────────────────────────────────────────────────

describe("computeUpperBounds + slack", () => {
  it("linear chain a→b→c: zero slack on the critical path", () => {
    const cs = [
      cluster("a", placement("aws", "1", "r"), 0),
      cluster("b", placement("aws", "1", "r"), 1),
      cluster("c", placement("aws", "1", "r"), 2),
    ];
    const floor = new Map([
      ["a", 0],
      ["b", 1],
      ["c", 2],
    ]);
    const ceil = computeUpperBounds(
      [edge("a", "b", 0), edge("b", "c", 1)],
      cs,
      floor,
    );
    expect(ceil.get("a")).toBe(0); // floor(b)-1
    expect(ceil.get("b")).toBe(1); // floor(c)-1
    expect(ceil.get("c")).toBe(2); // sink → maxDepth
  });

  it("UB = MIN over successors (a far successor does not raise UB)", () => {
    const cs = [
      cluster("a", placement("aws", "1", "r"), 0),
      cluster("b", placement("aws", "1", "r"), 1),
      cluster("c", placement("aws", "1", "r"), 2),
    ];
    // floor handed directly: b near (1), c deep (3).
    const floor = new Map([
      ["a", 0],
      ["b", 1],
      ["c", 3],
    ]);
    const ceil = computeUpperBounds(
      [edge("a", "b", 0), edge("a", "c", 1)],
      cs,
      floor,
    );
    expect(ceil.get("a")).toBe(0); // min(floor(b)-1, floor(c)-1) = min(0, 2)
  });

  it("a pure sink with a deep maxDepth has positive slack", () => {
    // a→b (b sink, floor 1) and c→d→e chain pushing maxDepth to 2 elsewhere.
    const cs = [
      cluster("a", placement("aws", "1", "r"), 0),
      cluster("b", placement("aws", "1", "r"), 1),
      cluster("c", placement("aws", "1", "r"), 0),
      cluster("d", placement("aws", "1", "r"), 1),
      cluster("e", placement("aws", "1", "r"), 2),
    ];
    const floor = new Map([
      ["a", 0],
      ["b", 1],
      ["c", 0],
      ["d", 1],
      ["e", 2],
    ]);
    const ceil = computeUpperBounds(
      [edge("a", "b", 0), edge("c", "d", 1), edge("d", "e", 2)],
      cs,
      floor,
    );
    expect(ceil.get("b")).toBe(2); // sink → maxDepth 2
    expect(ceil.get("b")! - floor.get("b")!).toBe(1); // slack > 0
    expect(ceil.get("e")).toBe(2); // critical-path sink, slack 0
  });

  it("clamps UB ≥ LB so slack is never negative under a cycle artifact", () => {
    // computeDepths sets cyclic floors to firstSequence, which can put a
    // successor's floor BELOW the node's — UB would go negative without the clamp.
    const cs = [
      cluster("a", placement("aws", "1", "r"), 2),
      cluster("b", placement("aws", "1", "r"), 0),
    ];
    const floor = new Map([
      ["a", 2],
      ["b", 0],
    ]);
    const ceil = computeUpperBounds([edge("a", "b", 0)], cs, floor);
    expect(ceil.get("a")).toBe(2); // clamped to LB, not floor(b)-1 = -1
    expect(ceil.get("a")! - floor.get("a")!).toBe(0); // slack ≥ 0
  });
});

// ── buildFanSets ──────────────────────────────────────────────────────────────

describe("buildFanSets", () => {
  const floor = new Map([
    ["u", 0],
    ["a", 1],
    ["b", 1],
    ["c", 1],
    ["w", 2],
  ]);
  const seq = new Map([
    ["u", 0],
    ["a", 1],
    ["b", 2],
    ["c", 3],
    ["w", 4],
  ]);

  it("groups fan-out targets and de-duplicates parallel edges", () => {
    const { fanout } = buildFanSets(
      [edge("u", "a", 0), edge("u", "b", 1), edge("u", "a", 2)],
      floor,
      seq,
    );
    expect(fanout.get("u")).toEqual(["a", "b"]); // a listed once
  });

  it("captures both directions (fan-out hub AND fan-in convergence)", () => {
    const { fanout, fanin } = buildFanSets(
      [edge("a", "w", 0), edge("b", "w", 1), edge("c", "w", 2)],
      floor,
      seq,
    );
    expect(fanin.get("w")).toEqual(["a", "b", "c"]);
    expect(fanout.get("a")).toEqual(["w"]);
  });
});

// ── buildHullEdges (D_H) ─────────────────────────────────────────────────────

describe("buildHullEdges (D_H, up-projection at the LCA)", () => {
  it("up-projects a cross-region edge to two region children under the account", () => {
    const a = cluster("a", placement("aws", "1", "us-east-1"), 0);
    const b = cluster("b", placement("aws", "1", "us-west-2"), 1);
    const dh = buildHullEdges([edge("a", "b", 0)], [a, b]);

    const accountKey = topologyRoleAndKeyFromPath(["aws", "1"])!.key;
    const regionA = topologyRoleAndKeyFromPath(["aws", "1", "us-east-1"])!.key;
    const regionB = topologyRoleAndKeyFromPath(["aws", "1", "us-west-2"])!.key;
    expect(dh.get(accountKey)).toEqual([
      { from: regionA, to: regionB, weight: 1, declared: false },
    ]);
  });

  it("KEEPS a same-subnet sibling edge as a leaf→leaf edge in D_H (F2)", () => {
    const p = placement("aws", "1", "r", "vpc-1", "private");
    const a = cluster("res.a", p, 0);
    const b = cluster("res.b", p, 1);
    const dh = buildHullEdges([edge("res.a", "res.b", 0)], [a, b]);

    const sub = subnetKey("aws", "1", "r", "vpc-1", "private");
    expect(dh.get(sub)).toEqual([
      { from: "res.a", to: "res.b", weight: 1, declared: false },
    ]);
  });

  it("routes a cross-provider edge to the root container, between provider children", () => {
    const a = cluster("a", placement("aws", "1", "us-east-1"), 0);
    const b = cluster("b", placement("gcp", "2", "us-central1"), 1);
    const dh = buildHullEdges([edge("a", "b", 0)], [a, b]);
    expect(dh.get(RCLL_ROOT_KEY)).toEqual([
      { from: "aws", to: "gcp", weight: 1, declared: false },
    ]);
  });

  it("excludes intra-child edges (both endpoints in the same child subtree)", () => {
    // a→b both inside the SAME region (different... no, same everything but id):
    // they share the region container, so at the ACCOUNT level there is no edge.
    const a = cluster("a", placement("aws", "1", "us-east-1", "vpc-1", "s"), 0);
    const b = cluster("b", placement("aws", "1", "us-east-1", "vpc-1", "s"), 1);
    const dh = buildHullEdges([edge("a", "b", 0)], [a, b]);
    const accountKey = topologyRoleAndKeyFromPath(["aws", "1"])!.key;
    expect(dh.get(accountKey)).toBeUndefined(); // edge lives only at the subnet
    expect(dh.size).toBe(1);
  });

  it("accumulates weight on parallel cross-hull edges", () => {
    const a = cluster("a", placement("aws", "1", "us-east-1"), 0);
    const b = cluster("b", placement("aws", "1", "us-west-2"), 1);
    const dh = buildHullEdges([edge("a", "b", 0), edge("a", "b", 1)], [a, b]);
    const accountKey = topologyRoleAndKeyFromPath(["aws", "1"])!.key;
    expect(dh.get(accountKey)![0]!.weight).toBe(2);
  });

  it("merges a coinciding declared edge WITHOUT doubling weight (F1)", () => {
    const a = cluster("a", placement("aws", "1", "us-east-1"), 0);
    const b = cluster("b", placement("aws", "1", "us-west-2"), 1);
    const accountKey = topologyRoleAndKeyFromPath(["aws", "1"])!.key;
    const regionA = topologyRoleAndKeyFromPath(["aws", "1", "us-east-1"])!.key;
    const regionB = topologyRoleAndKeyFromPath(["aws", "1", "us-west-2"])!.key;

    const dh = buildHullEdges(
      [edge("a", "b", 0)],
      [a, b],
      [{ container: accountKey, from: regionA, to: regionB }],
    );
    expect(dh.get(accountKey)).toEqual([
      { from: regionA, to: regionB, weight: 1, declared: true }, // merged, weight stays 1
    ]);
  });

  it("inserts a declared edge that has no up-projected twin", () => {
    const a = cluster("a", placement("aws", "1", "us-east-1"), 0);
    const dh = buildHullEdges(
      [],
      [a],
      [{ container: RCLL_ROOT_KEY, from: "aws", to: "gcp" }],
    );
    expect(dh.get(RCLL_ROOT_KEY)).toEqual([
      { from: "aws", to: "gcp", weight: 1, declared: true },
    ]);
  });
});

// ── detectContainerCycles ─────────────────────────────────────────────────────

describe("detectContainerCycles", () => {
  it("flags ONLY the container whose D_H has a cycle", () => {
    const cyclic: HullEdge[] = [
      { from: "a", to: "b", weight: 1, declared: false },
      { from: "b", to: "a", weight: 1, declared: false },
    ];
    const acyclic: HullEdge[] = [
      { from: "x", to: "y", weight: 1, declared: false },
    ];
    const flagged = detectContainerCycles(
      new Map([
        ["C-cyclic", cyclic],
        ["C-ok", acyclic],
      ]),
    );
    expect([...flagged]).toEqual(["C-cyclic"]);
  });

  it("does not flag a DAG (diamond is acyclic)", () => {
    const diamond: HullEdge[] = [
      { from: "a", to: "b", weight: 1, declared: false },
      { from: "a", to: "c", weight: 1, declared: false },
      { from: "b", to: "d", weight: 1, declared: false },
      { from: "c", to: "d", weight: 1, declared: false },
    ];
    expect([...detectContainerCycles(new Map([["C", diamond]]))]).toEqual([]);
  });
});

// ── buildRcllModel: degenerate inputs do NOT throw (F3 compensating control) ───

describe("buildRcllModel — degenerate inputs (F3: unguarded import must not throw)", () => {
  it("single cluster, no edges", () => {
    const a = cluster("a", placement("aws", "1", "r"), 0);
    expect(() =>
      buildRcllModel(prep([a], [], new Map([["a", 0]]))),
    ).not.toThrow();
  });

  it("cluster with synthetic 'unknown' topology (CON-7/A2 bucket)", () => {
    const a = cluster(
      "a",
      placement("unknown-provider", "unknown-account", "unknown-region"),
      0,
    );
    const { tree, lattice } = buildRcllModel(
      prep([a], [], new Map([["a", 0]])),
    );
    expect(tree.children.length).toBe(1);
    expect(lattice.cyclicContainers!.size).toBe(0);
  });

  it("a cycle in D yields a model (cycle flagged at the container) and slack ≥ 0", () => {
    // a→b→a: computeDepths reports hasCycle; our container-level detector flags
    // the LCA container, and every slack stays ≥ 0.
    const a = cluster("a", placement("aws", "1", "us-east-1"), 0);
    const b = cluster("b", placement("aws", "1", "us-west-2"), 1);
    const depths = new Map([
      ["a", 0],
      ["b", 1],
    ]); // cyclic floors (fallback-ish)
    const { lattice } = buildRcllModel(
      prep([a, b], [edge("a", "b", 0), edge("b", "a", 1)], depths, true),
    );
    const accountKey = topologyRoleAndKeyFromPath(["aws", "1"])!.key;
    expect(lattice.cyclicContainers!.has(accountKey)).toBe(true);
    for (const s of lattice.slack!.values()) {
      expect(s).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── summarizeRcllModel ────────────────────────────────────────────────────────

describe("summarizeRcllModel", () => {
  it("produces finite scalar counts; ≥2 filter for fan-out/fan-in sets", () => {
    const u = cluster("u", placement("aws", "1", "us-east-1"), 0);
    const a = cluster("a", placement("aws", "1", "us-west-2"), 1);
    const b = cluster("b", placement("aws", "1", "eu-west-1"), 2);
    const depths = new Map([
      ["u", 0],
      ["a", 1],
      ["b", 1],
    ]);
    const { tree, lattice } = buildRcllModel(
      prep([u, a, b], [edge("u", "a", 0), edge("u", "b", 1)], depths),
    );
    const s = summarizeRcllModel(tree, lattice);
    expect(s.primaryClusterCount).toBe(3);
    expect(s.fanoutSetCount).toBe(1); // u → {a, b}
    expect(s.faninSetCount).toBe(0); // no convergence (a, b each have 1 source)
    expect(s.hullEdgeCount).toBeGreaterThan(0);
    expect(s.cyclicContainerCount).toBe(0);
    for (const v of Object.values(s)) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});
