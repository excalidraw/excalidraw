/**
 * Unit tests for pipeline v2 structural analysis (ELK-free, deterministic): hull
 * tree grouping, TFD edge lifting, and fan-out / pure-sink bundle detection — the
 * logic that turns a fan-out into a square block instead of a tall column.
 */
import { describe, expect, it } from "vitest";

import {
  buildHullTree,
  classifyHullLayout,
  hullChildUnits,
  liftEdges,
} from "./terraformPipelineV2Structure";

import type {
  CollapsedPipelineEdge,
  PipelineCluster,
} from "./terraformPipelineLayoutShared";

function cluster(
  id: string,
  placement: {
    account?: string;
    region: string;
    vpc?: string;
    subnet?: string;
  },
  seq: number,
): PipelineCluster {
  return {
    id,
    primaryAddress: id,
    firstSequence: seq,
    depth: 0,
    placement: {
      providerFamily: "aws",
      accountId: placement.account ?? "111111111111",
      region: placement.region,
      vpcId: placement.vpc ?? null,
      ...(placement.subnet ? { subnetSignature: placement.subnet } : {}),
    },
    build: {
      skeleton: [],
      width: 200,
      height: 88,
      clusterFrameId: `frame:${id}`,
    },
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

/** account hull = root → provider(aws) → account; its units are the regions. */
function accountHull(clusters: PipelineCluster[]) {
  return buildHullTree(clusters).childHulls[0]!.childHulls[0]!;
}

describe("pipeline v2 structure — hull tree", () => {
  it("nests clusters provider → account → region and attaches leaves", () => {
    const clusters = [
      cluster("api", { region: "us-east-1" }, 0),
      cluster("w1", { region: "us-west-1" }, 1),
      cluster("w2", { region: "us-west-2" }, 2),
    ];
    const root = buildHullTree(clusters);
    expect(root.role).toBe("root");
    expect(root.childHulls).toHaveLength(1);

    const provider = root.childHulls[0]!;
    expect(provider.role).toBe("provider");
    const account = provider.childHulls[0]!;
    expect(account.role).toBe("account");
    expect(account.childHulls.map((h) => h.role)).toEqual([
      "region",
      "region",
      "region",
    ]);
    // each region directly holds its one cluster
    expect(
      account.childHulls.flatMap((r) => r.leafClusters.map((c) => c.id)),
    ).toEqual(["api", "w1", "w2"]);
  });

  it("orders sibling hulls by model order (firstSequence)", () => {
    const clusters = [
      cluster("late", { region: "us-west-2" }, 9),
      cluster("early", { region: "us-east-1" }, 1),
    ];
    const account = accountHull(clusters);
    expect(account.childHulls.map((r) => r.leafClusters[0]!.id)).toEqual([
      "early",
      "late",
    ]);
  });
});

describe("pipeline v2 structure — classify", () => {
  it("packs parallel siblings with no edges", () => {
    const clusters = [
      cluster("x", { region: "us-east-1" }, 0),
      cluster("y", { region: "us-west-1" }, 1),
    ];
    const account = accountHull(clusters);
    const plan = classifyHullLayout(hullChildUnits(account), []);
    expect(plan.kind).toBe("pack");
  });

  it("detects a fan-out target bundle (us-east-1 → us-west-1/2, us-east-2)", () => {
    const clusters = [
      cluster("api", { region: "us-east-1" }, 0),
      cluster("w1", { region: "us-west-1" }, 1),
      cluster("w2", { region: "us-west-2" }, 2),
      cluster("e2", { region: "us-east-2" }, 3),
    ];
    const edges = [
      edge("api", "w1", 0),
      edge("api", "w2", 1),
      edge("api", "e2", 2),
    ];
    const account = accountHull(clusters);
    const units = hullChildUnits(account);
    const lifted = liftEdges(account, units, edges);
    expect(lifted).toHaveLength(3);

    const plan = classifyHullLayout(units, lifted);
    expect(plan.kind).toBe("flow");
    if (plan.kind === "flow") {
      expect(plan.bundles).toHaveLength(1);
      // the three fan-out targets are bundled (the source is not)
      expect(plan.bundles[0]).toHaveLength(3);
      expect(plan.bundles[0]!.some((id) => id.includes("us-east-1"))).toBe(
        false,
      );
    }
  });

  it("does not bundle a linear chain a → b → c", () => {
    const clusters = [
      cluster("a", { region: "us-east-1" }, 0),
      cluster("b", { region: "us-west-1" }, 1),
      cluster("c", { region: "us-west-2" }, 2),
    ];
    const edges = [edge("a", "b", 0), edge("b", "c", 1)];
    const account = accountHull(clusters);
    const units = hullChildUnits(account);
    const plan = classifyHullLayout(units, liftEdges(account, units, edges));
    expect(plan.kind).toBe("flow");
    if (plan.kind === "flow") {
      expect(plan.bundles).toEqual([]);
    }
  });

  it("lifts cross-region edges to region units and ignores intra-unit edges", () => {
    const clusters = [
      cluster("a1", { region: "us-east-1" }, 0),
      cluster("a2", { region: "us-east-1" }, 1), // same region as a1
      cluster("b", { region: "us-west-1" }, 2),
    ];
    // a1 → a2 is intra-region (dropped); a1 → b crosses regions (lifted once)
    const edges = [edge("a1", "a2", 0), edge("a1", "b", 1)];
    const account = accountHull(clusters);
    const units = hullChildUnits(account); // 2 region units
    const lifted = liftEdges(account, units, edges);
    expect(lifted).toHaveLength(1);
  });
});
