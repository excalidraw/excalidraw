import { describe, expect, it } from "vitest";

import {
  buildColumnOccupancy,
  mergeAdjacentColumnRunsIteratively,
  seedColumnRunsFromSpecs,
} from "./terraformPipelineGeoColumnMerge";

type TestSpec = {
  columnIndex: number;
  key: string;
};

function spec(columnIndex: number, key: string): TestSpec {
  return { columnIndex, key };
}

describe("terraformPipelineGeoColumnMerge", () => {
  it("collapses three adjacent single-column runs iteratively", () => {
    const specs = [
      spec(0, "east"),
      spec(1, "east"),
      spec(2, "east"),
    ];
    const occupancy = buildColumnOccupancy(specs, (s) => s.key);
    const seedRuns = seedColumnRunsFromSpecs(specs, (s) => s.key);
    const merged = mergeAdjacentColumnRunsIteratively(seedRuns, occupancy);
    expect(merged).toEqual([
      {
        key: "east",
        minColumn: 0,
        maxColumn: 2,
        items: specs,
      },
    ]);
  });

  it("blocks merge when span intersects another hierarchy key", () => {
    const specs = [
      spec(0, "east"),
      spec(1, "east"),
      spec(2, "west"),
      spec(3, "east"),
    ];
    const occupancy = buildColumnOccupancy(specs, (s) => s.key);
    const eastSpecs = specs.filter((s) => s.key === "east");
    const seedRuns = seedColumnRunsFromSpecs(eastSpecs, (s) => s.key);
    const merged = mergeAdjacentColumnRunsIteratively(seedRuns, occupancy);
    expect(merged).toEqual([
      { key: "east", minColumn: 0, maxColumn: 1, items: [spec(0, "east"), spec(1, "east")] },
      { key: "east", minColumn: 3, maxColumn: 3, items: [spec(3, "east")] },
    ]);
  });

  it("builds occupancy from all specs in the universe", () => {
    const universe = [
      spec(5, "111|us-east-1"),
      spec(5, "111|us-west-2"),
    ];
    const occupancy = buildColumnOccupancy(universe, (s) => s.key);
    expect([...occupancy.get(5)!].sort()).toEqual([
      "111|us-east-1",
      "111|us-west-2",
    ]);
  });
});
