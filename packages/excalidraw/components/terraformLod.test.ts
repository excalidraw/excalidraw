import { describe, expect, it } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  buildTerraformLodContext,
  classifyTerraformLodElement,
  filterTerraformLodVisibleElements,
  getTerraformLodThresholds,
  shouldRenderTerraformElementAtZoom,
  shouldShowTerraformPipelineFrameName,
  TERRAFORM_LOD_DEFAULT_PRESET,
  TERRAFORM_LOD_LABEL_ZOOM,
  TERRAFORM_LOD_SATELLITE1_ZOOM,
} from "./terraformLod";

const rect = (
  id: string,
  customData: Record<string, unknown>,
): ExcalidrawElement =>
  ({
    id,
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    isDeleted: false,
    customData,
  } as unknown as ExcalidrawElement);

const text = (
  id: string,
  customData: Record<string, unknown>,
): ExcalidrawElement =>
  ({
    id,
    type: "text",
    x: 0,
    y: 0,
    width: 80,
    height: 20,
    isDeleted: false,
    customData,
  } as unknown as ExcalidrawElement);

const arrow = (id: string, source: string, target: string): ExcalidrawElement =>
  ({
    id,
    type: "arrow",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    isDeleted: false,
    customData: {
      terraform: true,
      relationship: { source, target },
    },
  } as unknown as ExcalidrawElement);

const emptyBypass = {
  expandedPrimaryAddresses: new Set<string>(),
  explodedParentKeys: new Set<string>(),
  selectedGroupIds: new Set<string>(),
};

describe("terraformLod", () => {
  it("classifies primaries, satellites, labels, and icons", () => {
    expect(
      classifyTerraformLodElement(
        rect("p", {
          terraform: true,
          terraformVisibilityRole: "resource",
          terraformInitiallyVisible: true,
          terraformSatelliteTier: 0,
        }),
      ),
    ).toBe("primary");
    expect(
      classifyTerraformLodElement(
        rect("s1", {
          terraform: true,
          terraformVisibilityRole: "resource",
          terraformInitiallyVisible: false,
          terraformSatelliteTier: 1,
        }),
      ),
    ).toBe("satellite1");
    expect(
      classifyTerraformLodElement(
        rect("s2", {
          terraform: true,
          terraformVisibilityRole: "resource",
          terraformInitiallyVisible: false,
          terraformSatelliteTier: 2,
        }),
      ),
    ).toBe("satellite2");
    expect(
      classifyTerraformLodElement(
        text("lbl", {
          terraform: true,
          terraformVisibilityRole: "resource",
          nodePath: "aws_vpc.main",
        }),
      ),
    ).toBe("label");
    expect(
      classifyTerraformLodElement(
        rect("icon", { terraform: true, terraformAwsIconGlyph: true }),
      ),
    ).toBe("icon");
  });

  it("keeps primary boxes visible at low zoom", () => {
    const primary = rect("p", {
      terraform: true,
      terraformVisibilityRole: "resource",
      terraformInitiallyVisible: true,
      terraformSatelliteTier: 0,
    });
    const ctx = buildTerraformLodContext(true, 0.1, {}, null, [primary]);
    expect(shouldRenderTerraformElementAtZoom(primary, ctx, emptyBypass)).toBe(
      true,
    );
  });

  it("hides tier-1 satellites and labels at low zoom (performance preset)", () => {
    const satellite = rect("s", {
      terraform: true,
      terraformVisibilityRole: "resource",
      terraformInitiallyVisible: false,
      terraformSatelliteTier: 1,
    });
    const label = text("l", {
      terraform: true,
      terraformVisibilityRole: "resource",
      nodePath: "aws_iam_role.r",
    });
    const ctxLow = buildTerraformLodContext(
      true,
      0.3,
      {},
      null,
      [satellite, label],
      "performance",
    );
    expect(
      shouldRenderTerraformElementAtZoom(satellite, ctxLow, emptyBypass),
    ).toBe(false);
    expect(shouldRenderTerraformElementAtZoom(label, ctxLow, emptyBypass)).toBe(
      false,
    );

    const ctxHigh = buildTerraformLodContext(
      true,
      0.6,
      {},
      null,
      [satellite, label],
      "performance",
    );
    expect(
      shouldRenderTerraformElementAtZoom(satellite, ctxHigh, emptyBypass),
    ).toBe(true);
    expect(
      shouldRenderTerraformElementAtZoom(label, ctxHigh, emptyBypass),
    ).toBe(true);
  });

  it("shows selected satellites even at low zoom", () => {
    const satellite = rect("s", {
      terraform: true,
      terraformVisibilityRole: "resource",
      terraformVisibilityKey: "aws_iam_role.r",
      terraformInitiallyVisible: false,
      terraformSatelliteTier: 1,
    });
    const ctx = buildTerraformLodContext(true, 0.1, { s: true }, null, [
      satellite,
    ]);
    expect(
      shouldRenderTerraformElementAtZoom(satellite, ctx, {
        ...emptyBypass,
        selectedGroupIds: new Set<string>(),
      }),
    ).toBe(true);
  });

  it("shows satellites for expanded pipeline clusters at low zoom", () => {
    const primary = rect("p", {
      terraform: true,
      terraformVisibilityRole: "resource",
      terraformVisibilityKey: "aws_lambda_function.fn",
      terraformInitiallyVisible: true,
      terraformPipelineExpanded: true,
    });
    const satellite = rect("s", {
      terraform: true,
      terraformVisibilityRole: "resource",
      terraformInitiallyVisible: false,
      terraformSatelliteTier: 1,
      terraformExplodeParent: "aws_lambda_function.fn",
    });
    const ctx = buildTerraformLodContext(true, 0.1, {}, null, [
      primary,
      satellite,
    ]);
    expect(
      shouldRenderTerraformElementAtZoom(satellite, ctx, {
        expandedPrimaryAddresses: new Set(["aws_lambda_function.fn"]),
        explodedParentKeys: new Set<string>(),
        selectedGroupIds: new Set<string>(),
      }),
    ).toBe(true);
  });

  it("renders everything when LOD is disabled", () => {
    const satellite = rect("s", {
      terraform: true,
      terraformVisibilityRole: "resource",
      terraformInitiallyVisible: false,
      terraformSatelliteTier: 1,
    });
    const ctx = buildTerraformLodContext(false, 0.1, {}, null, [satellite]);
    expect(
      shouldRenderTerraformElementAtZoom(satellite, ctx, emptyBypass),
    ).toBe(true);
  });

  it("filterTerraformLodVisibleElements hides edges to hidden endpoints", () => {
    const primary = rect("p", {
      terraform: true,
      terraformVisibilityRole: "resource",
      terraformVisibilityKey: "aws_lambda_function.fn",
      terraformInitiallyVisible: true,
      terraformSatelliteTier: 0,
    });
    const satellite = rect("s", {
      terraform: true,
      terraformVisibilityRole: "resource",
      terraformVisibilityKey: "aws_iam_role.r",
      terraformInitiallyVisible: false,
      terraformSatelliteTier: 1,
    });
    const edge = arrow("e", "aws_lambda_function.fn", "aws_iam_role.r");
    const elements = [primary, satellite, edge];
    const ctx = buildTerraformLodContext(true, 0.1, {}, null, elements);
    const filtered = filterTerraformLodVisibleElements(
      elements,
      ctx,
      new Map(elements.map((el) => [el.id, el])) as never,
    );
    expect(filtered.map((el) => el.id)).toEqual(["p"]);
  });

  it("shouldShowTerraformPipelineFrameName uses shared thresholds", () => {
    const pipeline = (terraformTopologyRole: string) => ({
      terraformPipelineView: true,
      terraformTopologyRole,
    });
    expect(
      shouldShowTerraformPipelineFrameName(
        pipeline("region"),
        0.19,
        "performance",
      ),
    ).toBe(false);
    expect(
      shouldShowTerraformPipelineFrameName(
        pipeline("region"),
        0.2,
        "performance",
      ),
    ).toBe(true);
    expect(
      shouldShowTerraformPipelineFrameName(
        { terraformTopologyRole: "primaryCluster" },
        0.01,
      ),
    ).toBe(true);
  });

  it("preset thresholds scale detail when zoomed out", () => {
    const perf = getTerraformLodThresholds("performance");
    const balanced = getTerraformLodThresholds("balanced");
    const detailed = getTerraformLodThresholds("detailed");
    expect(detailed.satellite1).toBeLessThan(balanced.satellite1);
    expect(balanced.satellite1).toBeLessThan(perf.satellite1);
    expect(perf.satellite1).toBe(TERRAFORM_LOD_SATELLITE1_ZOOM);
  });

  it("detailed preset shows satellites at zoom 0.25, performance hides them", () => {
    const satellite = rect("s", {
      terraform: true,
      terraformVisibilityRole: "resource",
      terraformInitiallyVisible: false,
      terraformSatelliteTier: 1,
    });
    const ctxDetailed = buildTerraformLodContext(
      true,
      0.25,
      {},
      null,
      [satellite],
      "detailed",
    );
    const ctxPerformance = buildTerraformLodContext(
      true,
      0.25,
      {},
      null,
      [satellite],
      "performance",
    );
    expect(
      shouldRenderTerraformElementAtZoom(satellite, ctxDetailed, emptyBypass),
    ).toBe(true);
    expect(
      shouldRenderTerraformElementAtZoom(
        satellite,
        ctxPerformance,
        emptyBypass,
      ),
    ).toBe(false);
  });

  it("frame name thresholds scale with preset", () => {
    const pipeline = {
      terraformPipelineView: true,
      terraformTopologyRole: "region",
    };
    expect(
      shouldShowTerraformPipelineFrameName(pipeline, 0.14, "balanced"),
    ).toBe(true);
    expect(
      shouldShowTerraformPipelineFrameName(pipeline, 0.14, "performance"),
    ).toBe(false);
  });

  it("default preset is balanced", () => {
    expect(TERRAFORM_LOD_DEFAULT_PRESET).toBe("balanced");
    const satellite = rect("s", {
      terraform: true,
      terraformVisibilityRole: "resource",
      terraformInitiallyVisible: false,
      terraformSatelliteTier: 1,
    });
    const ctxDefault = buildTerraformLodContext(true, 0.3, {}, null, [
      satellite,
    ]);
    expect(ctxDefault.preset).toBe("balanced");
    expect(
      shouldRenderTerraformElementAtZoom(satellite, ctxDefault, emptyBypass),
    ).toBe(false);
  });

  it("documents performance-tier base zoom cutoffs", () => {
    expect(TERRAFORM_LOD_LABEL_ZOOM).toBe(0.35);
    expect(TERRAFORM_LOD_SATELLITE1_ZOOM).toBe(0.5);
  });
});
