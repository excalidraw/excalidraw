import { describe, expect, it } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  expandAllTerraformExplode,
  inferLegacyTerraformEdgePinsFromElements,
  reconcileTerraformVisibility,
  TERRAFORM_IMPORT_EDGE_LAYER_PINS,
} from "./terraformVisibility";

const depEdge = (
  id: string,
  source: string,
  target: string,
): ExcalidrawElement =>
  ({
    id,
    type: "arrow",
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
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: "arrow",
    customData: {
      terraformEdgeLayer: "dependency",
      relationship: { source, target },
    },
  } as unknown as ExcalidrawElement);

const resourceRect = (id: string, key: string): ExcalidrawElement =>
  ({
    id,
    type: "rectangle",
    x: 0,
    y: 0,
    width: 40,
    height: 20,
    angle: 0,
    strokeColor: "#000",
    backgroundColor: "#fff",
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    customData: {
      terraform: true,
      terraformVisibilityRole: "resource",
      terraformVisibilityKey: key,
      nodePath: key,
    },
  } as unknown as ExcalidrawElement);

describe("reconcileTerraformVisibility edge pins", () => {
  it("hides all terraform edges when import pins are all false", () => {
    const a = "aws_instance.a";
    const b = "aws_instance.b";
    const elements = [
      resourceRect("r-a", a),
      resourceRect("r-b", b),
      depEdge("e1", a, b),
    ];
    const out = reconcileTerraformVisibility(elements, {
      pins: TERRAFORM_IMPORT_EDGE_LAYER_PINS,
      hoverPeekKey: null,
    });
    const edge = out.find((e) => e.id === "e1");
    expect(edge?.isDeleted).toBe(true);
  });

  it("reveals only edges incident to hover peek key when pins are off", () => {
    const a = "aws_instance.a";
    const b = "aws_instance.b";
    const c = "aws_instance.c";
    const elements = [
      resourceRect("r-a", a),
      resourceRect("r-b", b),
      resourceRect("r-c", c),
      depEdge("e-ab", a, b),
      depEdge("e-bc", b, c),
    ];
    const out = reconcileTerraformVisibility(elements, {
      pins: TERRAFORM_IMPORT_EDGE_LAYER_PINS,
      hoverPeekKey: b,
    });
    const ab = out.find((e) => e.id === "e-ab");
    const bc = out.find((e) => e.id === "e-bc");
    expect(ab?.isDeleted).toBe(false);
    expect(bc?.isDeleted).toBe(false);
  });

  it("does not reveal peek edges when an endpoint is not visible", () => {
    const a = "aws_instance.a";
    const b = "aws_instance.b";
    const elements = [
      resourceRect("r-a", a),
      { ...resourceRect("r-b", b), isDeleted: true },
      depEdge("e-ab", a, b),
    ];
    const out = reconcileTerraformVisibility(elements, {
      pins: TERRAFORM_IMPORT_EDGE_LAYER_PINS,
      hoverPeekKey: a,
    });
    const edge = out.find((e) => e.id === "e-ab");
    expect(edge?.isDeleted).toBe(true);
  });

  it("expandAll keeps edges hidden when pins stay off", () => {
    const a = "aws_instance.a";
    const b = "aws_instance.b";
    const elements = reconcileTerraformVisibility(
      [resourceRect("r-a", a), resourceRect("r-b", b), depEdge("e1", a, b)],
      { pins: TERRAFORM_IMPORT_EDGE_LAYER_PINS, hoverPeekKey: null },
    );
    const expanded = expandAllTerraformExplode(elements, {
      pins: TERRAFORM_IMPORT_EDGE_LAYER_PINS,
      hoverPeekKey: null,
    });
    const edge = expanded.find((e) => e.id === "e1");
    expect(edge?.isDeleted).toBe(true);
  });

  it("inferLegacyTerraformEdgePinsFromElements matches visible edges", () => {
    const a = "aws_instance.a";
    const b = "aws_instance.b";
    const elements = [
      resourceRect("r-a", a),
      resourceRect("r-b", b),
      { ...depEdge("e1", a, b), isDeleted: false },
      { ...depEdge("e2", a, b), isDeleted: true },
    ];
    const pins = inferLegacyTerraformEdgePinsFromElements(elements);
    expect(pins.dependency).toBe(true);
  });
});
