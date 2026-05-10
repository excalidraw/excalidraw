import { describe, expect, it } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  applyTerraformRelationshipFocus,
  getTerraformRelationshipFocus,
} from "./terraformRelationshipFocus";

const baseElement = (
  id: string,
  customData: Record<string, any>,
  overrides: Partial<ExcalidrawElement> = {},
) =>
  ({
    id,
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    angle: 0,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    customData,
    ...overrides,
  } as ExcalidrawElement);

const resource = (
  nodePath: string,
  overrides: Partial<ExcalidrawElement> = {},
) =>
  baseElement(
    `node:${nodePath}`,
    {
      terraform: true,
      terraformVisibilityRole: "resource",
      nodePath,
    },
    overrides,
  );

const edge = (
  id: string,
  layer: "dependency" | "dataFlow",
  source: string,
  target: string,
  overrides: Partial<ExcalidrawElement> = {},
  relationshipOverrides: Record<string, any> = {},
) =>
  baseElement(
    id,
    {
      terraformEdgeLayer: layer,
      relationship: {
        source,
        target,
        ...relationshipOverrides,
      },
    },
    {
      type: "arrow",
      ...overrides,
    },
  );

const group = (
  id: string,
  childKeys: string[],
  overrides: Partial<ExcalidrawElement> = {},
) =>
  baseElement(
    id,
    {
      terraformModuleGroup: true,
      terraformGroupChildKeys: childKeys,
    },
    overrides,
  );

describe("terraform relationship focus", () => {
  it("reveals direct dependency edges and direct neighbor nodes", () => {
    const elements = [
      resource("aws_instance.web"),
      resource("aws_security_group.sg", { isDeleted: true }),
      resource("aws_vpc.main"),
      edge(
        "edge:web-sg",
        "dependency",
        "aws_instance.web",
        "aws_security_group.sg",
        { isDeleted: true },
      ),
      edge(
        "edge:sg-vpc",
        "dependency",
        "aws_security_group.sg",
        "aws_vpc.main",
      ),
    ];

    const result = applyTerraformRelationshipFocus(
      elements,
      "aws_instance.web",
    );
    const byId = new Map(
      result.elements.map((element) => [element.id, element]),
    );

    expect(byId.get("edge:web-sg")?.isDeleted).toBe(false);
    expect(byId.get("edge:web-sg")?.opacity).toBe(85);
    expect(byId.get("edge:web-sg")?.customData?.terraformFocusPreview).toBe(
      true,
    );
    expect(byId.get("node:aws_security_group.sg")?.isDeleted).toBe(false);
    expect(
      byId.get("node:aws_security_group.sg")?.customData?.terraformFocusPreview,
    ).toBe(true);
    expect(byId.get("edge:sg-vpc")?.opacity).toBe(15);
    expect(byId.get("node:aws_vpc.main")?.opacity).toBe(25);
  });

  it("includes hidden data-flow edges touching the focus node", () => {
    const elements = [
      resource("aws_lambda_function.fn"),
      resource("aws_cloudwatch_log_group.logs", { isDeleted: true }),
      edge(
        "edge:fn-logs",
        "dataFlow",
        "aws_lambda_function.fn",
        "aws_cloudwatch_log_group.logs",
        { isDeleted: true },
      ),
    ];

    const result = applyTerraformRelationshipFocus(
      elements,
      "aws_lambda_function.fn",
    );
    const byId = new Map(
      result.elements.map((element) => [element.id, element]),
    );

    expect(byId.get("edge:fn-logs")?.isDeleted).toBe(false);
    expect(byId.get("edge:fn-logs")?.opacity).toBe(85);
    expect(byId.get("node:aws_cloudwatch_log_group.logs")?.isDeleted).toBe(
      false,
    );
  });

  it("dims unrelated Terraform resources, groups, and edges", () => {
    const elements = [
      resource("aws_instance.web"),
      resource("aws_security_group.sg"),
      resource("aws_vpc.main"),
      group("group:focus", ["aws_instance.web", "aws_security_group.sg"]),
      group("group:other", ["aws_vpc.main"]),
      edge(
        "edge:web-sg",
        "dependency",
        "aws_instance.web",
        "aws_security_group.sg",
      ),
      edge("edge:other", "dataFlow", "aws_vpc.main", "aws_subnet.private"),
    ];

    const result = applyTerraformRelationshipFocus(
      elements,
      "aws_instance.web",
    );
    const byId = new Map(
      result.elements.map((element) => [element.id, element]),
    );

    expect(byId.get("node:aws_instance.web")?.opacity).toBe(100);
    expect(byId.get("node:aws_security_group.sg")?.opacity).toBe(85);
    expect(byId.get("edge:web-sg")?.opacity).toBe(85);
    expect(byId.get("group:focus")?.opacity).toBe(60);
    expect(byId.get("node:aws_vpc.main")?.opacity).toBe(25);
    expect(byId.get("group:other")?.opacity).toBe(25);
    expect(byId.get("edge:other")?.opacity).toBe(15);
  });

  it("clearing focus restores opacity and re-hides only preview-revealed elements", () => {
    const focused = applyTerraformRelationshipFocus(
      [
        resource("aws_instance.web"),
        resource("aws_security_group.sg", { isDeleted: true }),
        resource("aws_vpc.main"),
        baseElement("freehand:note", {}, { opacity: 40 }),
        edge(
          "edge:web-sg",
          "dependency",
          "aws_instance.web",
          "aws_security_group.sg",
          { isDeleted: true },
        ),
      ],
      "aws_instance.web",
    ).elements;

    const cleared = applyTerraformRelationshipFocus(focused, null);
    const byId = new Map(
      cleared.elements.map((element) => [element.id, element]),
    );

    expect(byId.get("node:aws_security_group.sg")?.isDeleted).toBe(true);
    expect(byId.get("edge:web-sg")?.isDeleted).toBe(true);
    expect(byId.get("node:aws_instance.web")?.isDeleted).toBe(false);
    expect(byId.get("node:aws_vpc.main")?.isDeleted).toBe(false);
    expect(byId.get("node:aws_instance.web")?.opacity).toBe(100);
    expect(byId.get("node:aws_vpc.main")?.opacity).toBe(100);
    expect(byId.get("edge:web-sg")?.opacity).toBe(100);
    expect(byId.get("freehand:note")?.opacity).toBe(40);
    expect(
      [...byId.values()].some(
        (element) => element.customData?.terraformFocusPreview === true,
      ),
    ).toBe(false);
  });

  it("detects coalesced dependency edges using direction endpoint hints", () => {
    const elements = [
      resource("aws_instance.web"),
      resource("aws_security_group.sg"),
      edge(
        "edge:coalesced",
        "dependency",
        "module.network",
        "module.compute",
        {},
        {
          directions: [
            {
              source: "aws_security_group.sg",
              target: "aws_instance.web",
            },
          ],
        },
      ),
    ];

    const focus = getTerraformRelationshipFocus(elements, "aws_instance.web");

    expect(focus.focusedEdgeIds.has("edge:coalesced")).toBe(true);
    expect(focus.relatedNodePaths.has("aws_security_group.sg")).toBe(true);
  });

  it("detects coalesced data-flow edges using direction endpoint hints", () => {
    const elements = [
      resource("aws_instance.web"),
      resource("aws_security_group.sg"),
      edge(
        "edge:coalesced-df",
        "dataFlow",
        "module.network",
        "module.compute",
        {},
        {
          directions: [
            {
              source: "aws_security_group.sg",
              target: "aws_instance.web",
            },
          ],
        },
      ),
    ];

    const focus = getTerraformRelationshipFocus(elements, "aws_instance.web");

    expect(focus.focusedEdgeIds.has("edge:coalesced-df")).toBe(true);
    expect(focus.relatedNodePaths.has("aws_security_group.sg")).toBe(true);
  });
});
