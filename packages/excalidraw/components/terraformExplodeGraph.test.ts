import { describe, expect, it } from "vitest";

import {
  buildTerraformExplodeParentMap,
  collectDataFlowEdges,
} from "./terraformExplodeGraph";

describe("collectDataFlowEdges", () => {
  it("dedupes by source target type label and merges bidirectional pairs", () => {
    const nodes = {
      a: {
        edges_data_flow: [
          { target: "b", type: "ref", label: "x", origin: "o1" },
          { target: "b", type: "ref", label: "x", origin: "o1" },
        ],
      },
      b: {
        edges_data_flow: [{ target: "a", type: "ref", label: "y", origin: "o2" }],
      },
    };
    const edges = collectDataFlowEdges(nodes);
    const bidir = edges.find((e) => e.bidirectional);
    expect(bidir).toBeDefined();
    expect(bidir!.source < bidir!.target).toBe(true);
  });
});

describe("buildTerraformExplodeParentMap", () => {
  it("links neighbors across directed dependency and data-flow edges", () => {
    const nodeKeys = ["a", "b", "c"];
    const directedEdges = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    const dataFlowEdges = collectDataFlowEdges({
      a: { edges_data_flow: [{ target: "c", type: "t", label: "l" }] },
      c: {},
    });
    const map = buildTerraformExplodeParentMap(nodeKeys, directedEdges, dataFlowEdges);
    expect([...(map.get("a") || [])].sort()).toEqual(["b", "c"]);
    expect([...(map.get("b") || [])].sort()).toEqual(["a", "c"]);
    expect([...(map.get("c") || [])].sort()).toEqual(["a", "b"]);
  });

  it("ignores endpoints outside nodeKeys", () => {
    const map = buildTerraformExplodeParentMap(
      ["a", "b"],
      [{ source: "a", target: "x" }],
      [],
    );
    expect([...(map.get("a") || [])]).toEqual([]);
  });
});
