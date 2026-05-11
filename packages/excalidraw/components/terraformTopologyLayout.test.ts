import { describe, expect, it } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { buildTerraformTopologyExcalidrawScene } from "./terraformTopologyLayout";
import type { TerraformTopologyModel } from "./terraformTopologyExtract";

function axisBounds(el: ExcalidrawElement): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const w = el.width ?? 0;
  const h = el.height ?? 0;
  return {
    minX: el.x,
    minY: el.y,
    maxX: el.x + w,
    maxY: el.y + h,
  };
}

/** Topology frames must visually contain direct child frames (Excalidraw contract when x/y + explicit w/h set). */
function assertTopologyFramesContainChildren(elements: readonly ExcalidrawElement[]) {
  const eps = 4;
  const frames = elements.filter(
    (e) =>
      e.type === "frame" &&
      (e.customData as { terraformTopologyRole?: string } | undefined)
        ?.terraformTopologyRole,
  );

  for (const frame of frames) {
    const kids = elements.filter(
      (e) => e.frameId === frame.id && !e.isDeleted,
    );
    if (kids.length === 0) {
      continue;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of kids) {
      const b = axisBounds(c);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }
    const fb = axisBounds(frame);
    expect(
      fb.minX,
      `frame ${frame.id} left vs children`,
    ).toBeLessThanOrEqual(minX + eps);
    expect(
      fb.minY,
      `frame ${frame.id} top vs children`,
    ).toBeLessThanOrEqual(minY + eps);
    expect(
      fb.maxX,
      `frame ${frame.id} right vs children`,
    ).toBeGreaterThanOrEqual(maxX - eps);
    expect(
      fb.maxY,
      `frame ${frame.id} bottom vs children`,
    ).toBeGreaterThanOrEqual(maxY - eps);
  }
}

describe("buildTerraformTopologyExcalidrawScene", () => {
  it("parent frames contain direct children after conversion", async () => {
    const model: TerraformTopologyModel = {
      sawAwsResourceChanges: true,
      accounts: new Map([
        [
          "111111111111",
          {
            accountId: "111111111111",
            regions: new Map([
              [
                "us-east-1",
                {
                  region: "us-east-1",
                  vpcs: new Map([
                    [
                      "vpc-test",
                      {
                        vpcId: "vpc-test",
                        subnets: new Map([
                          ["subnet-a", { subnetId: "subnet-a" }],
                          ["subnet-b", { subnetId: "subnet-b" }],
                        ]),
                      },
                    ],
                  ]),
                },
              ],
            ]),
          },
        ],
      ]),
    };

    const { elements, meta } = await buildTerraformTopologyExcalidrawScene(model);
    expect(meta.layoutEngine).toBe("topology");
    expect(elements.length).toBeGreaterThan(0);
    assertTopologyFramesContainChildren(elements);
  });
});
