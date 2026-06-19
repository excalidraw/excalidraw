import { describe, expect, it } from "vitest";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import { appendSubnetMembershipAnnotations } from "./terraformPipelineSubnetAnnotation";
import type { PipelineCluster } from "./terraformPipelineLayoutShared";
import type { TerraformDependencyLayoutBox } from "./terraformElkLayout";

/** Minimal cluster stub — only the fields the annotation reads. */
function cluster(
  id: string,
  subnetTier: string | null,
  subnetSignature: string | null,
): PipelineCluster {
  return {
    id,
    placement: { subnetTier, subnetSignature },
  } as unknown as PipelineCluster;
}

const box = (
  x: number,
  y: number,
  width: number,
  height: number,
): TerraformDependencyLayoutBox => ({ x, y, width, height });

describe("appendSubnetMembershipAnnotations", () => {
  it("emits one rail per subnet cluster, skips non-subnet clusters", () => {
    const skeleton: ExcalidrawElementSkeleton[] = [];
    const clusters = [
      cluster("a", "public", "subnet-1"),
      cluster("b", "private", "subnet-2"),
      cluster("c", null, null), // region-direct, no subnet → no rail
    ];
    const boxes = new Map([
      ["a", box(100, 0, 200, 80)],
      ["b", box(100, 120, 200, 80)],
      ["c", box(100, 240, 200, 80)],
    ]);

    const { railCount, tiers } = appendSubnetMembershipAnnotations(
      skeleton,
      clusters,
      boxes,
    );

    expect(railCount).toBe(2);
    const rails = skeleton.filter((e) =>
      String(e.id).startsWith("tf-subnet-rail:"),
    );
    expect(rails.map((r) => r.id)).toEqual([
      "tf-subnet-rail:a",
      "tf-subnet-rail:b",
    ]);
    // legend has one row per distinct tier present
    expect(tiers).toEqual(["private", "public"]);
    const legend = skeleton.filter((e) =>
      String(e.id).startsWith("tf-subnet-legend:"),
    );
    expect(legend.map((l) => l.id).sort()).toEqual([
      "tf-subnet-legend:private",
      "tf-subnet-legend:public",
    ]);
  });

  it("places each rail to the LEFT of its card (never overlapping the card frame)", () => {
    const skeleton: ExcalidrawElementSkeleton[] = [];
    appendSubnetMembershipAnnotations(
      skeleton,
      [cluster("a", "public", "subnet-1")],
      new Map([["a", box(500, 30, 200, 80)]]),
    );
    const rail = skeleton.find((e) => e.id === "tf-subnet-rail:a")!;
    // rail right edge is strictly left of the card's left edge (x=500)
    expect((rail.x ?? 0) + (rail.width ?? 0)).toBeLessThanOrEqual(500);
    // rail spans the card's height band
    expect(rail.y).toBe(30);
    expect(rail.height).toBe(80);
  });

  it("tags annotations as gate/diagnostic-invisible (no terraformTopologyRole)", () => {
    const skeleton: ExcalidrawElementSkeleton[] = [];
    appendSubnetMembershipAnnotations(
      skeleton,
      [cluster("a", "intra", "subnet-1")],
      new Map([["a", box(0, 0, 100, 50)]]),
    );
    for (const el of skeleton) {
      const cd = el.customData as Record<string, unknown>;
      expect(cd.terraformSubnetChip).toBe(true);
      expect(cd.terraformTopologyRole).toBeUndefined();
    }
  });

  it("is a no-op when no cluster has a subnet", () => {
    const skeleton: ExcalidrawElementSkeleton[] = [];
    const { railCount, tiers } = appendSubnetMembershipAnnotations(
      skeleton,
      [cluster("a", null, null)],
      new Map([["a", box(0, 0, 100, 50)]]),
    );
    expect(railCount).toBe(0);
    expect(tiers).toEqual([]);
    expect(skeleton).toEqual([]);
  });

  it("colors rails by tier (public/private/intra distinct)", () => {
    const skeleton: ExcalidrawElementSkeleton[] = [];
    appendSubnetMembershipAnnotations(
      skeleton,
      [
        cluster("a", "public", "s1"),
        cluster("b", "private", "s2"),
        cluster("c", "intra", "s3"),
      ],
      new Map([
        ["a", box(0, 0, 100, 50)],
        ["b", box(0, 60, 100, 50)],
        ["c", box(0, 120, 100, 50)],
      ]),
    );
    const railColors = skeleton
      .filter((e) => String(e.id).startsWith("tf-subnet-rail:"))
      .map((e) => e.backgroundColor);
    // three distinct tier colors
    expect(new Set(railColors).size).toBe(3);
  });
});
