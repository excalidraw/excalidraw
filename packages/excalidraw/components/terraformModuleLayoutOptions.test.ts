import { describe, expect, it } from "vitest";

import {
  buildElkBoxLayoutOptions,
  buildElkRectPackingLayoutOptions,
  DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
  moduleLayoutOptionsToMeta,
  paramFieldsForMode,
  resolveTerraformModuleLayoutOptions,
} from "./terraformModuleLayoutOptions";

describe("terraformModuleLayoutOptions", () => {
  it("resolves partial overrides onto defaults", () => {
    const resolved = resolveTerraformModuleLayoutOptions({
      mode: "rectpacking",
      rectpacking: { aspectRatio: 2 },
    });
    expect(resolved.mode).toBe("rectpacking");
    expect(resolved.rectpacking.aspectRatio).toBe(2);
    expect(resolved.defaultGrid.resourceGap).toBe(
      DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS.defaultGrid.resourceGap,
    );
  });

  it("builds ELK layout option maps", () => {
    expect(
      buildElkBoxLayoutOptions(DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS.box)[
        "elk.algorithm"
      ],
    ).toBe("box");
    expect(
      buildElkRectPackingLayoutOptions(
        DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS.rectpacking,
      )["elk.algorithm"],
    ).toBe("rectpacking");
  });

  it("exposes param fields per mode", () => {
    expect(paramFieldsForMode("default").map((f) => f.key)).toEqual([
      "resourceGap",
      "submoduleGap",
      "rootStackMinCellWidth",
    ]);
    expect(paramFieldsForMode("box").length).toBe(3);
    expect(paramFieldsForMode("rectpacking").length).toBe(7);
  });

  it("serializes active mode params into meta", () => {
    expect(
      moduleLayoutOptionsToMeta({
        ...DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
        mode: "box",
      }),
    ).toEqual({
      mode: "box",
      params: DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS.box,
    });
  });
});
