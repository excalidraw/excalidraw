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
  opts?: { semantic?: boolean; primary?: boolean; expandAllView?: boolean },
) =>
  baseElement(
    `node:${nodePath}`,
    {
      terraform: true,
      terraformVisibilityRole: "resource",
      nodePath,
      ...(opts?.semantic
        ? {
            terraformSemanticOverview: true,
            terraformExpandAllView: opts.expandAllView === true,
          }
        : {}),
      ...(opts?.primary === true ? { terraformInitiallyVisible: true } : {}),
      ...(opts?.primary === false ? { terraformInitiallyVisible: false } : {}),
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
  semantic = false,
) =>
  baseElement(
    id,
    {
      terraformModuleGroup: true,
      terraformGroupChildKeys: childKeys,
      ...(semantic ? { terraformSemanticOverview: true } : {}),
    },
    overrides,
  );

const semanticEdge = (
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
      terraform: true,
      terraformSemanticOverview: true,
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

describe("terraform relationship focus", () => {
  it("reveals bound label when it lacks nodePath but its container is a related resource", () => {
    const rectSg = resource("aws_security_group.sg", {
      id: "rect:sg",
      isDeleted: true,
    });
    const labelText = baseElement(
      "text:sg",
      { terraform: true, terraformVisibilityRole: "resource" },
      {
        type: "text",
        containerId: "rect:sg",
        isDeleted: true,
        width: 80,
        height: 20,
        fontSize: 12,
        originalText: "aws_security_group.sg",
        text: "aws_security_group.sg",
      },
    );

    const elements = [
      resource("aws_instance.web"),
      rectSg,
      labelText,
      edge(
        "edge:web-sg",
        "dependency",
        "aws_instance.web",
        "aws_security_group.sg",
        { isDeleted: true },
      ),
    ];

    const result = applyTerraformRelationshipFocus(
      elements,
      "aws_instance.web",
    );
    const byId = new Map(result.elements.map((e) => [e.id, e]));

    expect(byId.get("rect:sg")?.isDeleted).toBe(false);
    expect(byId.get("text:sg")?.isDeleted).toBe(false);
    expect(byId.get("text:sg")?.opacity).toBe(100);
  });

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

  it("keeps bound label text at full opacity when the resource rectangle is dimmed", () => {
    const rectS3 = resource("aws_s3_bucket.logs", { id: "rect:s3" });
    const labelText = baseElement(
      "text:s3",
      {
        terraform: true,
        nodePath: "aws_s3_bucket.logs",
        terraformVisibilityRole: "resource",
      },
      {
        type: "text",
        containerId: "rect:s3",
        width: 80,
        height: 20,
        fontSize: 12,
        originalText: "aws_s3_bucket.logs",
        text: "aws_s3_bucket.logs",
      },
    );

    const elements = [
      resource("aws_instance.web"),
      resource("aws_security_group.sg"),
      rectS3,
      labelText,
      edge(
        "edge:link",
        "dependency",
        "aws_instance.web",
        "aws_security_group.sg",
      ),
    ];

    const result = applyTerraformRelationshipFocus(
      elements,
      "aws_instance.web",
    );
    const byId = new Map(result.elements.map((e) => [e.id, e]));

    expect(byId.get("rect:s3")?.opacity).toBe(25);
    expect(byId.get("text:s3")?.opacity).toBe(100);
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

  describe("semantic overview (topology) ambient opacities", () => {
    it("applies dim edges and primary vs non-primary nodes when focus clears", () => {
      const focused = applyTerraformRelationshipFocus(
        [
          resource("aws_instance.web", {}, { semantic: true, primary: true }),
          resource("aws_vpc.main", {}, { semantic: true, primary: false }),
          semanticEdge(
            "edge:web-vpc",
            "dependency",
            "aws_instance.web",
            "aws_vpc.main",
          ),
        ],
        "aws_instance.web",
      ).elements;

      const cleared = applyTerraformRelationshipFocus(focused, null);
      const byId = new Map(cleared.elements.map((e) => [e.id, e]));

      expect(byId.get("node:aws_instance.web")?.opacity).toBe(100);
      expect(byId.get("node:aws_vpc.main")?.opacity).toBe(35);
      expect(byId.get("edge:web-vpc")?.opacity).toBe(22);
    });

    it("with expand-all view, non-primary resources return to full opacity when focus clears", () => {
      const focused = applyTerraformRelationshipFocus(
        [
          resource("aws_instance.web", {}, {
            semantic: true,
            primary: true,
            expandAllView: true,
          }),
          resource("aws_vpc.main", {}, {
            semantic: true,
            primary: false,
            expandAllView: true,
          }),
          semanticEdge(
            "edge:web-vpc",
            "dependency",
            "aws_instance.web",
            "aws_vpc.main",
          ),
        ],
        "aws_instance.web",
      ).elements;

      const cleared = applyTerraformRelationshipFocus(focused, null);
      const byId = new Map(cleared.elements.map((e) => [e.id, e]));

      expect(byId.get("node:aws_instance.web")?.opacity).toBe(100);
      expect(byId.get("node:aws_vpc.main")?.opacity).toBe(100);
      expect(byId.get("edge:web-vpc")?.opacity).toBe(22);
    });

    it("dims terraform module groups when focus clears", () => {
      const clearedElements = applyTerraformRelationshipFocus(
        [
          resource("aws_instance.web", {}, { semantic: true, primary: true }),
          group("group:a", ["aws_instance.web"], {}, true),
        ],
        null,
      ).elements;
      const byId = new Map(clearedElements.map((e) => [e.id, e]));
      expect(byId.get("group:a")?.opacity).toBe(68);
    });
  });
});
