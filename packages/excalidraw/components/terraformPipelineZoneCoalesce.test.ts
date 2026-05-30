import { describe, expect, it } from "vitest";

import {
  coalescePipelineZoneSpecs,
  pipelineZoneCoalesceKey,
  type PipelineZoneFrameSpec,
} from "./terraformPipelineLayout";

function regionalSpec(
  overrides: Partial<PipelineZoneFrameSpec> & {
    id: string;
    laneIndex: number;
    columnIndex: number;
    regionalBandKey: string;
  },
): PipelineZoneFrameSpec {
  const [accountId, region, , geoInstanceId] =
    overrides.regionalBandKey.split("|");
  return {
    label: "Regional",
    role: "subnetZone",
    path: [
      accountId ?? "111",
      region ?? "us-east-1",
      "regional",
      geoInstanceId ?? "0",
      String(overrides.columnIndex),
      String(overrides.laneIndex),
    ],
    bounds: { x: 10, y: overrides.laneIndex * 100, width: 80, height: 60 },
    clusterFrameIds: [`cluster-${overrides.id}`],
    vpcKey: null,
    accountId: accountId ?? "111",
    region: region ?? "us-east-1",
    ...overrides,
  };
}

function vpcSpec(
  overrides: Partial<PipelineZoneFrameSpec> & {
    id: string;
    laneIndex: number;
    columnIndex: number;
    vpcKey: string;
    label?: string;
  },
): PipelineZoneFrameSpec {
  const [accountId, region, vpcId, geoInstanceId] =
    overrides.vpcKey.split("|");
  return {
    label: overrides.label ?? "VPC · Private",
    role: "subnetZone",
    path: [
      accountId ?? "111",
      region ?? "us-east-1",
      vpcId ?? "vpc-a",
      geoInstanceId ?? "0",
      String(overrides.columnIndex),
      String(overrides.laneIndex),
    ],
    bounds: { x: 200, y: overrides.laneIndex * 100, width: 120, height: 80 },
    clusterFrameIds: [`cluster-${overrides.id}`],
    regionalBandKey: null,
    accountId: accountId ?? "111",
    region: region ?? "us-east-1",
    ...overrides,
  };
}

describe("pipelineZoneCoalesceKey", () => {
  it("returns parent bucket + label + column for regional specs", () => {
    const spec = regionalSpec({
      id: "r1",
      laneIndex: 4,
      columnIndex: 1,
      regionalBandKey: "222|eu-central-1|regional|3",
    });
    expect(pipelineZoneCoalesceKey(spec)).toBe(
      "222|eu-central-1|regional|3|Regional|col1",
    );
  });

  it("returns parent bucket + label + column for VPC specs", () => {
    const spec = vpcSpec({
      id: "v1",
      laneIndex: 2,
      columnIndex: 4,
      vpcKey: "111|us-east-1|vpc-shared|0",
      label: "VPC · Intra",
    });
    expect(pipelineZoneCoalesceKey(spec)).toBe(
      "111|us-east-1|vpc-shared|0|VPC · Intra|col4",
    );
  });
});

describe("coalescePipelineZoneSpecs", () => {
  it("merges regional specs in the same parent and column", () => {
    const band = "222|eu-central-1|regional|3";
    const input = new Map<string, PipelineZoneFrameSpec>([
      [
        "z-a5",
        regionalSpec({
          id: "z-a5",
          laneIndex: 4,
          columnIndex: 1,
          regionalBandKey: band,
          bounds: { x: 10, y: 400, width: 80, height: 60 },
        }),
      ],
      [
        "z-a6",
        regionalSpec({
          id: "z-a6",
          laneIndex: 5,
          columnIndex: 1,
          regionalBandKey: band,
          bounds: { x: 10, y: 500, width: 80, height: 60 },
        }),
      ],
    ]);

    const out = coalescePipelineZoneSpecs(input);
    expect(out.size).toBe(1);
    const merged = [...out.values()][0]!;
    expect(merged.label).toBe("Regional");
    expect(merged.clusterFrameIds).toEqual(["cluster-z-a5", "cluster-z-a6"]);
    expect(merged.bounds).toEqual({ x: 10, y: 400, width: 80, height: 160 });
    expect(merged.laneIndex).toBe(4);
    expect(merged.path).toEqual([
      "222",
      "eu-central-1",
      "regional",
      "3",
      "1",
    ]);
  });

  it("merges VPC specs in the same parent, tier, and column", () => {
    const vpcKey = "111|us-east-1|vpc-shared|0";
    const input = new Map<string, PipelineZoneFrameSpec>([
      [
        "api2",
        vpcSpec({
          id: "api2",
          laneIndex: 1,
          columnIndex: 3,
          vpcKey,
          label: "VPC · Intra",
          bounds: { x: 100, y: 200, width: 120, height: 80 },
        }),
      ],
      [
        "api3",
        vpcSpec({
          id: "api3",
          laneIndex: 2,
          columnIndex: 3,
          vpcKey,
          label: "VPC · Intra",
          bounds: { x: 100, y: 300, width: 120, height: 80 },
        }),
      ],
    ]);

    const out = coalescePipelineZoneSpecs(input);
    expect(out.size).toBe(1);
    const merged = [...out.values()][0]!;
    expect(merged.label).toBe("VPC · Intra");
    expect(merged.vpcKey).toBe(vpcKey);
    expect(merged.clusterFrameIds).toEqual(["cluster-api2", "cluster-api3"]);
    expect(merged.bounds).toEqual({ x: 100, y: 200, width: 120, height: 180 });
    expect(merged.path).toEqual([
      "111",
      "us-east-1",
      "vpc-shared",
      "0",
      "3",
    ]);
  });

  it("leaves specs in different columns separate", () => {
    const band = "222|eu-central-1|regional|3";
    const input = new Map<string, PipelineZoneFrameSpec>([
      [
        "gw",
        regionalSpec({
          id: "gw",
          laneIndex: 4,
          columnIndex: 1,
          regionalBandKey: band,
        }),
      ],
      [
        "ssm",
        regionalSpec({
          id: "ssm",
          laneIndex: 4,
          columnIndex: 3,
          regionalBandKey: band,
        }),
      ],
    ]);

    expect(coalescePipelineZoneSpecs(input).size).toBe(2);
  });

  it("does not merge VPC specs with different vpcKey", () => {
    const input = new Map<string, PipelineZoneFrameSpec>([
      [
        "v1",
        vpcSpec({
          id: "v1",
          laneIndex: 4,
          columnIndex: 2,
          vpcKey: "222|eu-central-1|vpc-d1|0",
        }),
      ],
      [
        "v2",
        vpcSpec({
          id: "v2",
          laneIndex: 5,
          columnIndex: 2,
          vpcKey: "222|eu-central-1|vpc-d2|0",
        }),
      ],
    ]);

    expect(coalescePipelineZoneSpecs(input).size).toBe(2);
  });

  it("does not merge VPC specs with different tier labels", () => {
    const vpcKey = "111|us-east-1|vpc-shared|0";
    const input = new Map<string, PipelineZoneFrameSpec>([
      [
        "intra",
        vpcSpec({
          id: "intra",
          laneIndex: 0,
          columnIndex: 2,
          vpcKey,
          label: "VPC · Intra",
        }),
      ],
      [
        "private",
        vpcSpec({
          id: "private",
          laneIndex: 0,
          columnIndex: 2,
          vpcKey,
          label: "VPC · Private",
        }),
      ],
    ]);

    expect(coalescePipelineZoneSpecs(input).size).toBe(2);
  });
});
