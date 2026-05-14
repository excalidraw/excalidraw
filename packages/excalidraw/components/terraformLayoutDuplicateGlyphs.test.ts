import { describe, expect, it } from "vitest";

import { newElement } from "@excalidraw/element";

import { injectTerraformLayoutDuplicateInfoGlyphs } from "./terraformLayoutDuplicateGlyphs";

describe("injectTerraformLayoutDuplicateInfoGlyphs", () => {
  it("returns unchanged elements when no duplicate semantic tiles", async () => {
    const rect = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      customData: { terraformSemanticLayoutDuplicate: false },
    });
    const { elements, files } =
      await injectTerraformLayoutDuplicateInfoGlyphs([rect]);
    expect(elements).toHaveLength(1);
    expect(Object.keys(files)).toHaveLength(0);
  });

  it("inserts an info image after each terraformSemanticLayoutDuplicate rectangle", async () => {
    const rect = newElement({
      type: "rectangle",
      x: 10,
      y: 20,
      width: 100,
      height: 40,
      customData: {
        terraformSemanticLayoutDuplicate: true,
        nodePath: "aws_vpc_endpoint.x",
        terraformVisibilityKey: "aws_vpc_endpoint.x",
      },
    });
    const { elements, files } =
      await injectTerraformLayoutDuplicateInfoGlyphs([rect]);
    expect(elements).toHaveLength(2);
    const glyph = elements[1]!;
    expect(glyph.type).toBe("image");
    expect(glyph.customData?.terraformLayoutDuplicateGlyph).toBe(true);
    expect(Object.keys(files).length).toBe(1);
  });
});
