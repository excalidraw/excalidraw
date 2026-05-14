import { describe, expect, it } from "vitest";

import { newElement, newTextElement } from "@excalidraw/element";

import {
  ensureTerraformAwsIconLibraryLoaded,
  injectTerraformAwsIconsIntoElements,
} from "./terraformAwsIcons";

describe("terraformAwsIcons", () => {
  it("ensureTerraformAwsIconLibraryLoaded is safe to call repeatedly", async () => {
    await ensureTerraformAwsIconLibraryLoaded();
    await ensureTerraformAwsIconLibraryLoaded();
  });

  it("injectTerraformAwsIconsIntoElements skips unknown resource types", async () => {
    const key = "aws_fictitious_resource_type_xyz.foo";
    const rect = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 200,
      height: 80,
      customData: {
        terraformVisibilityRole: "resource",
        terraformVisibilityKey: key,
        nodePath: key,
        resourceType: "aws_fictitious_resource_type_xyz",
      },
    });
    const label = newTextElement({
      x: 8,
      y: 8,
      text: key,
      containerId: null,
      customData: {
        terraformVisibilityRole: "resource",
        terraformVisibilityKey: key,
        nodePath: key,
      },
    });
    const out = await injectTerraformAwsIconsIntoElements([rect, label]);
    expect(out.length).toBe(2);
  });

  it("injectTerraformAwsIconsIntoElements inserts icon glyphs for mapped AWS types", async () => {
    const key = "aws_s3_bucket.data";
    const rect = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 220,
      height: 80,
      customData: {
        terraformVisibilityRole: "resource",
        terraformVisibilityKey: key,
        nodePath: key,
        resourceType: "aws_s3_bucket",
      },
    });
    const label = newTextElement({
      x: 48,
      y: 10,
      text: key,
      containerId: null,
      customData: {
        terraformVisibilityRole: "resource",
        terraformVisibilityKey: key,
        nodePath: key,
      },
    });
    const out = await injectTerraformAwsIconsIntoElements([rect, label]);
    expect(out.length).toBeGreaterThan(2);
    expect(out.some((e) => e.customData?.terraformAwsIconGlyph === true)).toBe(
      true,
    );
  });
});
