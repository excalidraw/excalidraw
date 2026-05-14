import { describe, expect, it } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  TERRAFORM_GROUP_FLAGS,
  getTerraformGraphAddressForElement,
  isTerraformGroupElement,
  isTerraformInspectableElement,
  isTerraformLayerEdge,
  isTerraformResourceElement,
  isTerraformSemanticOverviewScene,
} from "./terraformElementMetadata";

const el = (partial: Partial<ExcalidrawElement>): ExcalidrawElement =>
  ({
    type: "rectangle",
    id: "id",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    angle: 0,
    strokeColor: "#000",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 1,
    opacity: 100,
    ...partial,
  } as ExcalidrawElement);

describe("terraformElementMetadata", () => {
  it("TERRAFORM_GROUP_FLAGS lists known group customData keys", () => {
    expect(TERRAFORM_GROUP_FLAGS).toContain("terraformModuleGroup");
    expect(TERRAFORM_GROUP_FLAGS).toContain("terraformSubnetGroup");
  });

  it("isTerraformResourceElement requires terraform flag and nodePath", () => {
    expect(
      isTerraformResourceElement(
        el({ customData: { terraform: true, nodePath: "aws_s3_bucket.a" } }),
      ),
    ).toBe(true);
    expect(
      isTerraformResourceElement(el({ customData: { terraform: true } })),
    ).toBe(false);
    expect(
      isTerraformResourceElement(el({ customData: { nodePath: "x" } })),
    ).toBeFalsy();
  });

  it("isTerraformGroupElement matches any terraform*Group flag", () => {
    for (const flag of TERRAFORM_GROUP_FLAGS) {
      expect(
        isTerraformGroupElement(el({ customData: { [flag]: true } })),
      ).toBe(true);
    }
    expect(isTerraformGroupElement(el({ customData: {} }))).toBe(false);
  });

  it("isTerraformLayerEdge matches dependency, dataFlow, networking", () => {
    for (const layer of ["dependency", "dataFlow", "networking"] as const) {
      expect(
        isTerraformLayerEdge(
          el({ type: "arrow", customData: { terraformEdgeLayer: layer } }),
        ),
      ).toBe(true);
    }
    expect(
      isTerraformLayerEdge(
        el({ type: "arrow", customData: { terraformEdgeLayer: "x" } }),
      ),
    ).toBe(false);
  });

  it("isTerraformInspectableElement covers resource, group, layer edge, relationship", () => {
    expect(isTerraformInspectableElement(null)).toBe(false);
    expect(
      isTerraformInspectableElement(
        el({
          customData: {
            terraform: true,
            nodePath: "aws_vpc.main",
          },
        }),
      ),
    ).toBe(true);
    expect(
      isTerraformInspectableElement(
        el({ customData: { terraformVpcGroup: true } }),
      ),
    ).toBe(true);
    expect(
      isTerraformInspectableElement(
        el({ type: "arrow", customData: { terraformEdgeLayer: "dependency" } }),
      ),
    ).toBe(true);
    expect(
      isTerraformInspectableElement(el({ customData: { relationship: true } })),
    ).toBe(true);
  });

  it("isTerraformSemanticOverviewScene is true when any element has terraformSemanticOverview", () => {
    expect(isTerraformSemanticOverviewScene([])).toBe(false);
    expect(isTerraformSemanticOverviewScene([el({ customData: {} })])).toBe(
      false,
    );
    expect(
      isTerraformSemanticOverviewScene([
        el({
          type: "frame",
          customData: { terraformSemanticOverview: true },
        }),
      ]),
    ).toBe(true);
  });

  it("getTerraformGraphAddressForElement prefers nodePath over terraformVisibilityKey", () => {
    expect(
      getTerraformGraphAddressForElement(
        el({
          customData: {
            nodePath: "a",
            terraformVisibilityKey: "b",
          },
        }),
      ),
    ).toBe("a");
    expect(
      getTerraformGraphAddressForElement(
        el({ customData: { terraformVisibilityKey: "only-key" } }),
      ),
    ).toBe("only-key");
    expect(getTerraformGraphAddressForElement(undefined)).toBe(null);
    expect(getTerraformGraphAddressForElement(el({ customData: {} }))).toBe(
      null,
    );
  });
});
