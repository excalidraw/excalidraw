import { describe, expect, it } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  applyTerraformRelationshipFocus,
  getTerraformRelationshipFocus,
} from "./terraformRelationshipFocus";
import { terraformVpceSgLayoutElementId } from "./terraformTopologySgLinks";
import { washHexColor } from "./terraformColorWash";

const VIEW_BG = "#ffffff";

/**
 * Color washing levels mirror the constants in `terraformRelationshipFocus.ts`. A
 * `level` of 100 means "no dimming" (so stroke / background stay as-is); below 100
 * the stroke color is blended toward the canvas background by `(100 - level) / 100`.
 */
const expectedWashedStroke = (level: number, baseColor = "#000000") =>
  washHexColor(baseColor, (100 - level) / 100, VIEW_BG);

/** Transparent backgrounds become an opaque washed fill (the user's "fully hides what's behind" requirement). */
const expectedWashedTransparentBackground = (level: number) =>
  washHexColor("transparent", (100 - level) / 100, VIEW_BG);

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
      VIEW_BG,
    );
    const byId = new Map(result.elements.map((e) => [e.id, e]));

    expect(byId.get("rect:sg")?.isDeleted).toBe(false);
    expect(byId.get("text:sg")?.isDeleted).toBe(false);
    expect(byId.get("text:sg")?.opacity).toBe(100);
    expect(byId.get("text:sg")?.strokeColor).toBe("#000000");
  });

  it("reveals the multi-hop dependency neighborhood with degree-of-interest falloff", () => {
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
      VIEW_BG,
    );
    const byId = new Map(
      result.elements.map((element) => [element.id, element]),
    );

    expect(byId.get("edge:web-sg")?.isDeleted).toBe(false);
    expect(byId.get("edge:web-sg")?.opacity).toBe(100);
    expect(byId.get("edge:web-sg")?.strokeColor).toBe(expectedWashedStroke(85));
    expect(byId.get("edge:web-sg")?.customData?.terraformFocusPreview).toBe(
      true,
    );
    expect(byId.get("node:aws_security_group.sg")?.isDeleted).toBe(false);
    expect(
      byId.get("node:aws_security_group.sg")?.customData?.terraformFocusPreview,
    ).toBe(true);
    // aws_vpc.main is two hops out (web → sg → vpc): revealed at the farther
    // degree-of-interest level, and the sg→vpc edge lights as in-neighborhood.
    expect(byId.get("edge:sg-vpc")?.opacity).toBe(100);
    expect(byId.get("edge:sg-vpc")?.strokeColor).toBe(expectedWashedStroke(85));
    expect(byId.get("node:aws_vpc.main")?.opacity).toBe(100);
    expect(byId.get("node:aws_vpc.main")?.strokeColor).toBe(
      expectedWashedStroke(55),
    );
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
      VIEW_BG,
    );
    const byId = new Map(
      result.elements.map((element) => [element.id, element]),
    );

    expect(byId.get("edge:fn-logs")?.isDeleted).toBe(false);
    expect(byId.get("edge:fn-logs")?.opacity).toBe(100);
    expect(byId.get("edge:fn-logs")?.strokeColor).toBe(
      expectedWashedStroke(85),
    );
    expect(byId.get("node:aws_cloudwatch_log_group.logs")?.isDeleted).toBe(
      false,
    );
  });

  it("keeps bound label text at full color when the resource rectangle is dimmed", () => {
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
      VIEW_BG,
    );
    const byId = new Map(result.elements.map((e) => [e.id, e]));

    expect(byId.get("rect:s3")?.opacity).toBe(100);
    expect(byId.get("rect:s3")?.strokeColor).toBe(expectedWashedStroke(25));
    expect(byId.get("text:s3")?.opacity).toBe(100);
    expect(byId.get("text:s3")?.strokeColor).toBe("#000000");
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
      VIEW_BG,
    );
    const byId = new Map(
      result.elements.map((element) => [element.id, element]),
    );

    for (const id of [
      "node:aws_instance.web",
      "node:aws_security_group.sg",
      "edge:web-sg",
      "group:focus",
      "node:aws_vpc.main",
      "group:other",
      "edge:other",
    ]) {
      expect(byId.get(id)?.opacity).toBe(100);
    }

    expect(byId.get("node:aws_instance.web")?.strokeColor).toBe("#000000");
    expect(byId.get("node:aws_security_group.sg")?.strokeColor).toBe(
      expectedWashedStroke(85),
    );
    expect(byId.get("edge:web-sg")?.strokeColor).toBe(expectedWashedStroke(85));
    expect(byId.get("group:focus")?.strokeColor).toBe(expectedWashedStroke(60));
    expect(byId.get("node:aws_vpc.main")?.strokeColor).toBe(
      expectedWashedStroke(25),
    );
    expect(byId.get("group:other")?.strokeColor).toBe(expectedWashedStroke(25));
    expect(byId.get("edge:other")?.strokeColor).toBe(expectedWashedStroke(15));
  });

  it("turns transparent backgrounds opaque so dimmed elements fully hide what's behind", () => {
    const elements = [
      resource("aws_instance.web"),
      resource("aws_vpc.main"),
      group("group:other", ["aws_vpc.main"]),
    ];

    const result = applyTerraformRelationshipFocus(
      elements,
      "aws_instance.web",
      VIEW_BG,
    );
    const byId = new Map(
      result.elements.map((element) => [element.id, element]),
    );

    const dimmedNode = byId.get("node:aws_vpc.main");
    expect(dimmedNode?.backgroundColor).toBe(
      expectedWashedTransparentBackground(25),
    );
    expect(dimmedNode?.backgroundColor).not.toBe("transparent");
    expect(dimmedNode?.fillStyle).toBe("solid");

    const dimmedGroup = byId.get("group:other");
    expect(dimmedGroup?.backgroundColor).toBe(
      expectedWashedTransparentBackground(25),
    );
    expect(dimmedGroup?.backgroundColor).not.toBe("transparent");
    expect(dimmedGroup?.fillStyle).toBe("solid");
  });

  it("re-dimming after a level change blends from the canonical originals, not the washed value", () => {
    const elements = [
      resource("aws_instance.web", {
        strokeColor: "#112233",
        backgroundColor: "#ffaabb",
        fillStyle: "hachure",
      }),
      resource("aws_security_group.sg", {
        strokeColor: "#112233",
        backgroundColor: "#ffaabb",
        fillStyle: "hachure",
      }),
      resource("aws_vpc.main", {
        strokeColor: "#112233",
        backgroundColor: "#ffaabb",
        fillStyle: "hachure",
      }),
    ];

    const focusedOnWeb = applyTerraformRelationshipFocus(
      elements,
      "aws_instance.web",
      VIEW_BG,
    ).elements;
    const focusedOnSg = applyTerraformRelationshipFocus(
      focusedOnWeb,
      "aws_security_group.sg",
      VIEW_BG,
    ).elements;
    const byId = new Map(focusedOnSg.map((e) => [e.id, e]));

    expect(byId.get("node:aws_security_group.sg")?.strokeColor).toBe("#112233");
    expect(byId.get("node:aws_security_group.sg")?.backgroundColor).toBe(
      "#ffaabb",
    );
    expect(byId.get("node:aws_security_group.sg")?.fillStyle).toBe("hachure");

    const dimmedVpc = byId.get("node:aws_vpc.main");
    expect(dimmedVpc?.strokeColor).toBe(washHexColor("#112233", 0.75, VIEW_BG));
    expect(dimmedVpc?.backgroundColor).toBe(
      washHexColor("#ffaabb", 0.75, VIEW_BG),
    );
    expect(dimmedVpc?.fillStyle).toBe("hachure");
  });

  it("clearing focus restores stroke/background/fillStyle and clears the originals stash", () => {
    const original = [
      resource("aws_instance.web", {
        strokeColor: "#123456",
        backgroundColor: "#fedcba",
        fillStyle: "cross-hatch",
      }),
      resource("aws_security_group.sg", {
        strokeColor: "#123456",
        backgroundColor: "#fedcba",
        fillStyle: "cross-hatch",
        isDeleted: true,
      }),
      resource("aws_vpc.main", {
        strokeColor: "#123456",
        backgroundColor: "#fedcba",
        fillStyle: "cross-hatch",
      }),
      baseElement("freehand:note", {}, { opacity: 40 }),
      edge(
        "edge:web-sg",
        "dependency",
        "aws_instance.web",
        "aws_security_group.sg",
        {
          isDeleted: true,
          strokeColor: "#123456",
          backgroundColor: "#fedcba",
          fillStyle: "cross-hatch",
        },
      ),
    ];

    const focused = applyTerraformRelationshipFocus(
      original,
      "aws_instance.web",
      VIEW_BG,
    ).elements;

    const cleared = applyTerraformRelationshipFocus(focused, null, VIEW_BG);
    const byId = new Map(
      cleared.elements.map((element) => [element.id, element]),
    );

    expect(byId.get("node:aws_security_group.sg")?.isDeleted).toBe(true);
    expect(byId.get("edge:web-sg")?.isDeleted).toBe(true);
    expect(byId.get("node:aws_instance.web")?.isDeleted).toBe(false);
    expect(byId.get("node:aws_vpc.main")?.isDeleted).toBe(false);

    for (const id of [
      "node:aws_instance.web",
      "node:aws_vpc.main",
      "edge:web-sg",
      "node:aws_security_group.sg",
    ]) {
      const el = byId.get(id);
      expect(el?.opacity).toBe(100);
      expect(el?.strokeColor).toBe("#123456");
      expect(el?.backgroundColor).toBe("#fedcba");
      expect(el?.fillStyle).toBe("cross-hatch");
      expect(el?.customData?.terraformDimmedOriginals).toBeUndefined();
    }

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

  it("washes co-highlighted duplicate layout tiles that share a canonical nodePath when focus is a layout instance id", () => {
    const layoutKeyA = terraformVpceSgLayoutElementId(
      'aws_vpc_endpoint.ep["a"]',
      "aws_security_group.sg",
    );
    const layoutKeyB = terraformVpceSgLayoutElementId(
      'aws_vpc_endpoint.ep["b"]',
      "aws_security_group.sg",
    );
    const elements = [
      baseElement(
        "rect:a",
        {
          terraform: true,
          terraformVisibilityRole: "resource",
          terraformVisibilityKey: layoutKeyA,
          nodePath: "aws_security_group.sg",
          terraformSemanticLayoutDuplicate: true,
        },
        { type: "rectangle" },
      ),
      baseElement(
        "rect:b",
        {
          terraform: true,
          terraformVisibilityRole: "resource",
          terraformVisibilityKey: layoutKeyB,
          nodePath: "aws_security_group.sg",
          terraformSemanticLayoutDuplicate: true,
        },
        { type: "rectangle" },
      ),
      resource("aws_lambda_function.fn"),
    ];

    const out = applyTerraformRelationshipFocus(
      elements,
      layoutKeyA,
      VIEW_BG,
    ).elements;
    const byId = new Map(out.map((e) => [e.id, e]));
    expect(byId.get("rect:a")?.strokeColor).toBe("#000000");
    expect(byId.get("rect:b")?.strokeColor).toBe(
      expectedWashedStroke(85, "#000000"),
    );
  });

  describe("semantic overview (topology) ambient washing", () => {
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
        VIEW_BG,
      ).elements;

      const cleared = applyTerraformRelationshipFocus(focused, null, VIEW_BG);
      const byId = new Map(cleared.elements.map((e) => [e.id, e]));

      expect(byId.get("node:aws_instance.web")?.opacity).toBe(100);
      expect(byId.get("node:aws_instance.web")?.strokeColor).toBe("#000000");
      expect(byId.get("node:aws_vpc.main")?.opacity).toBe(100);
      expect(byId.get("node:aws_vpc.main")?.strokeColor).toBe(
        expectedWashedStroke(35),
      );
      expect(byId.get("edge:web-vpc")?.opacity).toBe(100);
      expect(byId.get("edge:web-vpc")?.strokeColor).toBe(
        expectedWashedStroke(22),
      );
    });

    it("with expand-all view, non-primary resources return to full color when focus clears", () => {
      const focused = applyTerraformRelationshipFocus(
        [
          resource(
            "aws_instance.web",
            {},
            {
              semantic: true,
              primary: true,
              expandAllView: true,
            },
          ),
          resource(
            "aws_vpc.main",
            {},
            {
              semantic: true,
              primary: false,
              expandAllView: true,
            },
          ),
          semanticEdge(
            "edge:web-vpc",
            "dependency",
            "aws_instance.web",
            "aws_vpc.main",
          ),
        ],
        "aws_instance.web",
        VIEW_BG,
      ).elements;

      const cleared = applyTerraformRelationshipFocus(focused, null, VIEW_BG);
      const byId = new Map(cleared.elements.map((e) => [e.id, e]));

      expect(byId.get("node:aws_instance.web")?.opacity).toBe(100);
      expect(byId.get("node:aws_instance.web")?.strokeColor).toBe("#000000");
      expect(byId.get("node:aws_vpc.main")?.opacity).toBe(100);
      expect(byId.get("node:aws_vpc.main")?.strokeColor).toBe("#000000");
      expect(byId.get("edge:web-vpc")?.opacity).toBe(100);
      expect(byId.get("edge:web-vpc")?.strokeColor).toBe(
        expectedWashedStroke(22),
      );
    });

    it("dims terraform module groups when focus clears", () => {
      const clearedElements = applyTerraformRelationshipFocus(
        [
          resource("aws_instance.web", {}, { semantic: true, primary: true }),
          group("group:a", ["aws_instance.web"], {}, true),
        ],
        null,
        VIEW_BG,
      ).elements;
      const byId = new Map(clearedElements.map((e) => [e.id, e]));
      expect(byId.get("group:a")?.opacity).toBe(100);
      expect(byId.get("group:a")?.strokeColor).toBe(expectedWashedStroke(68));
    });
  });
});
