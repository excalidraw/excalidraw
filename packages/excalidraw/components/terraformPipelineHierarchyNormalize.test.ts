import { describe, expect, it } from "vitest";

import { normalizePipelineColumnsForHierarchy } from "./terraformPipelineContainers";

import type { PipelineAtomGraph } from "./terraformPipelineAtoms";
import type {
  PipelineAtomGeoMap,
  PipelineGeoPath,
} from "./terraformPipelineGeo";

const geo = (name: string): PipelineGeoPath => ({
  accountId: "111111111111",
  region: "us-east-1",
  vpcId: "vpc-1",
  tier: "private",
  subnetSignature: name,
});

const graph = (
  atoms: readonly string[],
  edges: PipelineAtomGraph["edges"] = [],
): PipelineAtomGraph => ({
  atoms: new Map(
    atoms.map((atom) => [
      atom,
      {
        primaryAddress: atom,
        resourceType: "aws_instance",
        memberAddresses: [atom],
      },
    ]),
  ),
  edges,
  closureAddresses: new Set(atoms),
  tfdVersion: 2,
});

const geoMap = (entries: Record<string, string>): PipelineAtomGeoMap =>
  new Map(
    Object.entries(entries).map(([atom, group]) => [
      atom,
      {
        ...geo(group),
        vpcId: `vpc-${group}`,
      },
    ]),
  );

describe("normalizePipelineColumnsForHierarchy", () => {
  it("splits fragmented ABCABC parent order into parent-owned bands", () => {
    const columns = [["a1", "b1", "c1", "a2", "b2", "c2"]];
    const normalized = normalizePipelineColumnsForHierarchy(
      columns,
      graph(columns.flat()),
      geoMap({ a1: "a", a2: "a", b1: "b", b2: "b", c1: "c", c2: "c" }),
      "local-shims",
    );

    expect(normalized).toEqual([
      ["a1", "a2"],
      ["b1", "b2"],
      ["c1", "c2"],
    ]);
  });

  it("keeps contiguous AABBCC parent order unchanged", () => {
    const columns = [["a1", "a2", "b1", "b2", "c1", "c2"]];
    const normalized = normalizePipelineColumnsForHierarchy(
      columns,
      graph(columns.flat()),
      geoMap({ a1: "a", a2: "a", b1: "b", b2: "b", c1: "c", c2: "c" }),
      "local-shims",
    );

    expect(normalized).toEqual(columns);
  });

  it("relaxes children forward when parent shims move past their TFD column", () => {
    const columns = [["a1", "b1", "a2"], ["child"]];
    const normalized = normalizePipelineColumnsForHierarchy(
      columns,
      graph(columns.flat(), [{ source: "a2", target: "child", sequence: 0 }]),
      geoMap({ a1: "a", a2: "a", b1: "b", child: "a" }),
      "local-shims",
    );
    const colByAtom = new Map(
      normalized.flatMap((col, index) => col.map((atom) => [atom, index])),
    );

    expect(colByAtom.get("child")).toBeGreaterThan(colByAtom.get("a2")!);
  });

  it("preserves left-to-right dataflow edges after global relayer normalization", () => {
    const columns = [["a1", "b1", "a2"], ["b2"], ["sink"]];
    const edges = [
      { source: "a2", target: "sink", sequence: 0 },
      { source: "b2", target: "sink", sequence: 1 },
    ];
    const normalized = normalizePipelineColumnsForHierarchy(
      columns,
      graph(columns.flat(), edges),
      geoMap({ a1: "a", a2: "a", b1: "b", b2: "b", sink: "c" }),
      "global-relayer",
    );
    const colByAtom = new Map(
      normalized.flatMap((col, index) => col.map((atom) => [atom, index])),
    );

    for (const edge of edges) {
      expect(colByAtom.get(edge.target)).toBeGreaterThanOrEqual(
        colByAtom.get(edge.source)! + 1,
      );
    }
  });
});
