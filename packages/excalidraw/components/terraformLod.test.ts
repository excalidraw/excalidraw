import { describe, expect, it } from "vitest";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import {
  buildTerraformLodContext,
  classifyTerraformLodElement,
  filterTerraformLodVisibleElements,
  getTerraformLodThresholds,
  resolveCanonicalTerraformElement,
  shouldRenderTerraformElementAtZoom,
  shouldShowTerraformPipelineFrameName,
  terraformLodFloorForElement,
  terraformSearchTargetZoom,
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

  describe("frame name footprint decluttering (Phase 2b)", () => {
    const region = {
      terraformPipelineView: true,
      terraformTopologyRole: "region",
    };
    const subnet = {
      terraformPipelineView: true,
      terraformTopologyRole: "subnetZone",
    };

    it("shows a topology frame name once footprint exceeds the threshold", () => {
      // footprint = min(w,h) * zoom. 56px is the floor.
      expect(
        shouldShowTerraformPipelineFrameName(region, 0.05, "balanced", 55),
      ).toBe(false);
      expect(
        shouldShowTerraformPipelineFrameName(region, 0.05, "balanced", 56),
      ).toBe(true);
    });

    it("keeps a large enclosing frame name alive farther out than the legacy 0.13 region floor", () => {
      // a 4000px-min-dim region at 2% zoom = 80px footprint → still named,
      // where the legacy zoom floor (0.13 balanced) would have hidden it.
      const footprint = 4000 * 0.02;
      expect(
        shouldShowTerraformPipelineFrameName(
          region,
          0.02,
          "balanced",
          footprint,
        ),
      ).toBe(true);
      // legacy path (no footprint) hides it at 0.02
      expect(
        shouldShowTerraformPipelineFrameName(region, 0.02, "balanced"),
      ).toBe(false);
    });

    it("suppresses a small child frame name at the low zoom where stacking would occur", () => {
      // a 300px-min-dim subnet at 0.2 zoom = 60px → just shows; at 0.15 = 45px → suppressed
      expect(
        shouldShowTerraformPipelineFrameName(
          subnet,
          0.2,
          "balanced",
          300 * 0.2,
        ),
      ).toBe(true);
      expect(
        shouldShowTerraformPipelineFrameName(
          subnet,
          0.15,
          "balanced",
          300 * 0.15,
        ),
      ).toBe(false);
    });

    it("provider/account anchors are always named regardless of footprint", () => {
      expect(
        shouldShowTerraformPipelineFrameName(
          { terraformPipelineView: true, terraformTopologyRole: "account" },
          0.01,
          "balanced",
          1,
        ),
      ).toBe(true);
    });

    it("non-pipeline frames are unaffected by the footprint rule", () => {
      expect(
        shouldShowTerraformPipelineFrameName({}, 0.01, "balanced", 1),
      ).toBe(true);
    });
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

const frame = (
  id: string,
  customData: Record<string, unknown>,
): ExcalidrawElement =>
  ({
    id,
    type: "frame",
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    isDeleted: false,
    customData,
  } as unknown as ExcalidrawElement);

describe("terraformLodFloorForElement (search-to-fit)", () => {
  it("returns the class threshold for culled content classes", () => {
    const thresholds = getTerraformLodThresholds("performance");
    const label = text("l", {
      terraform: true,
      terraformVisibilityRole: "resource",
    });
    const icon = rect("i", { terraform: true, terraformAwsIconGlyph: true });
    expect(terraformLodFloorForElement(label, "performance")).toBe(
      thresholds.label,
    );
    expect(terraformLodFloorForElement(icon, "performance")).toBe(
      thresholds.icon,
    );
  });

  it("returns the frame-name threshold for topology frames (the name is the navigational unit)", () => {
    const thresholds = getTerraformLodThresholds("balanced");
    const region = frame("r", {
      terraform: true,
      terraformTopologyRole: "region",
    });
    const vpc = frame("v", { terraform: true, terraformTopologyRole: "vpc" });
    expect(terraformLodFloorForElement(region, "balanced")).toBe(
      thresholds.frameName.region,
    );
    expect(terraformLodFloorForElement(vpc, "balanced")).toBe(
      thresholds.frameName.vpc,
    );
  });

  it("returns null for always-rendered content (primary box, provider/account frame, non-Terraform)", () => {
    const primary = rect("p", {
      terraform: true,
      terraformVisibilityRole: "resource",
      terraformInitiallyVisible: true,
      terraformSatelliteTier: 0,
    });
    const account = frame("a", {
      terraform: true,
      terraformTopologyRole: "account",
    });
    const plain = rect("x", {});
    expect(terraformLodFloorForElement(primary)).toBeNull();
    expect(terraformLodFloorForElement(account)).toBeNull();
    expect(terraformLodFloorForElement(plain)).toBeNull();
  });

  it("scales the floor with the preset (detailed shows content from farther out)", () => {
    const label = text("l", {
      terraform: true,
      terraformVisibilityRole: "resource",
    });
    const detailed = terraformLodFloorForElement(label, "detailed")!;
    const performance = terraformLodFloorForElement(label, "performance")!;
    expect(detailed).toBeLessThan(performance);
  });
});

describe("terraformSearchTargetZoom (LOD floor wins the clamp)", () => {
  it("uses the larger of fit-zoom and LOD floor so the match renders", () => {
    expect(
      terraformSearchTargetZoom({
        fitZoom: 0.1,
        lodFloor: 0.35,
        minZoom: 0.05,
        maxZoom: 30,
      }),
    ).toBe(0.35);
  });

  it("keeps fit-zoom when it already clears the floor", () => {
    expect(
      terraformSearchTargetZoom({
        fitZoom: 0.8,
        lodFloor: 0.35,
        minZoom: 0.05,
        maxZoom: 30,
      }),
    ).toBe(0.8);
  });

  it("regression: floor wins over maxZoom (no min>max inversion to blank space)", () => {
    // Pathological maxZoom below the floor must NOT pull the target under the
    // floor — that was the blank-space bug.
    expect(
      terraformSearchTargetZoom({
        fitZoom: 0.1,
        lodFloor: 0.5,
        minZoom: 0.05,
        maxZoom: 0.3,
      }),
    ).toBe(0.5);
  });

  it("clamps normally when there is no LOD floor", () => {
    expect(
      terraformSearchTargetZoom({
        fitZoom: 50,
        lodFloor: null,
        minZoom: 0.05,
        maxZoom: 30,
      }),
    ).toBe(30);
    expect(
      terraformSearchTargetZoom({
        fitZoom: 0.001,
        lodFloor: null,
        minZoom: 0.05,
        maxZoom: 30,
      }),
    ).toBe(0.05);
  });

  it("guards degenerate fit-zoom (Infinity from getCommonBounds([]))", () => {
    expect(
      terraformSearchTargetZoom({
        fitZoom: Infinity,
        lodFloor: null,
        minZoom: 0.05,
        maxZoom: 30,
      }),
    ).toBe(0.05);
    // with a floor, the floor still applies
    expect(
      terraformSearchTargetZoom({
        fitZoom: Infinity,
        lodFloor: 0.4,
        minZoom: 0.05,
        maxZoom: 30,
      }),
    ).toBe(0.4);
  });
});

describe("resolveCanonicalTerraformElement", () => {
  const KEY = "aws_s3_bucket.data";
  const primary = rect("primary", {
    terraform: true,
    terraformVisibilityRole: "resource",
    terraformInitiallyVisible: true,
    terraformSatelliteTier: 0,
    terraformVisibilityKey: KEY,
  });
  const label = text("label", {
    terraform: true,
    terraformVisibilityRole: "resource",
    terraformVisibilityKey: KEY,
  });
  const icon = rect("icon", {
    terraform: true,
    terraformAwsIconGlyph: true,
    terraformVisibilityKey: KEY,
  });

  it("resolves a matched label to its primary box (shared visibility key)", () => {
    expect(
      resolveCanonicalTerraformElement(label, [primary, label, icon]).id,
    ).toBe("primary");
  });

  it("resolves a matched icon glyph to its primary box", () => {
    expect(
      resolveCanonicalTerraformElement(icon, [primary, label, icon]).id,
    ).toBe("primary");
  });

  it("returns a primary unchanged", () => {
    expect(
      resolveCanonicalTerraformElement(primary, [primary, label, icon]).id,
    ).toBe("primary");
  });

  it("returns a frame match unchanged (frames are fit directly)", () => {
    const region = frame("region", {
      terraform: true,
      terraformTopologyRole: "region",
    });
    expect(resolveCanonicalTerraformElement(region, [region, primary]).id).toBe(
      "region",
    );
  });

  it("returns a satellite unchanged when it has no separate primary (it is its own box)", () => {
    const satellite = rect("sat", {
      terraform: true,
      terraformVisibilityRole: "resource",
      terraformInitiallyVisible: false,
      terraformSatelliteTier: 1,
      terraformVisibilityKey: "aws_iam_role.x",
    });
    expect(
      resolveCanonicalTerraformElement(satellite, [primary, satellite]).id,
    ).toBe("sat");
  });

  it("returns the match unchanged for a non-Terraform element", () => {
    const plain = rect("plain", {});
    expect(resolveCanonicalTerraformElement(plain, [plain, primary]).id).toBe(
      "plain",
    );
  });
});
