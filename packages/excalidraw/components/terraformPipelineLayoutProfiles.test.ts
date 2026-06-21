import { describe, expect, it } from "vitest";

import {
  DEFAULT_RCLL_LAYOUT_PROFILE,
  isRcllLayoutProfile,
  RCLL_LAYOUT_PROFILES,
  resolveRcllLayoutProfile,
  type RcllLayoutProfileFlags,
} from "./terraformPipelineLayoutProfiles";

// The exact flag set the dialog ships as its defaults today (useTerraformImportDialog):
// every RCLL pass off except the cycle-rise (staircaseBandOverlap), which is on.
const TODAY_DEFAULT_FLAGS: RcllLayoutProfileFlags = {
  swimlaneLaneRise: false,
  rankSeparate: false,
  deBandLevel: "none",
  staircaseBandOverlap: true,
  reorder: false,
  straighten: false,
  columnPacking: "none",
};

describe("resolveRcllLayoutProfile", () => {
  it("balanced reproduces today's default flags EXACTLY (byte-identical contract)", () => {
    expect(resolveRcllLayoutProfile("balanced")).toEqual(TODAY_DEFAULT_FLAGS);
  });

  it("balanced is the default profile", () => {
    expect(DEFAULT_RCLL_LAYOUT_PROFILE).toBe("balanced");
    expect(resolveRcllLayoutProfile(DEFAULT_RCLL_LAYOUT_PROFILE)).toEqual(
      TODAY_DEFAULT_FLAGS,
    );
  });

  it("readable stacks cycles and turns on legibility passes, no width-shrinkers", () => {
    expect(resolveRcllLayoutProfile("readable")).toEqual({
      swimlaneLaneRise: false,
      rankSeparate: false,
      deBandLevel: "none",
      staircaseBandOverlap: false,
      reorder: true,
      straighten: true,
      columnPacking: "none",
    });
  });

  it("compact enables the height + width composition (rise+split+deband+compact)", () => {
    expect(resolveRcllLayoutProfile("compact")).toEqual({
      swimlaneLaneRise: true,
      rankSeparate: true,
      deBandLevel: "subnet",
      staircaseBandOverlap: true,
      reorder: true,
      straighten: true,
      columnPacking: "compact",
    });
  });

  it("compact never violates the lane-split guard (rankSeparate needs lane-rise)", () => {
    const f = resolveRcllLayoutProfile("compact");
    // rankSeparate alone is a regression; the guard drops it unless the lane-rise is on.
    // A profile must never hand the guard an invalid pair.
    expect(f.rankSeparate && !f.swimlaneLaneRise).toBe(false);
  });

  it("is pure — repeated calls return equal, independent objects", () => {
    for (const p of RCLL_LAYOUT_PROFILES) {
      const a = resolveRcllLayoutProfile(p);
      const b = resolveRcllLayoutProfile(p);
      expect(a).toEqual(b);
      expect(a).not.toBe(b); // fresh object each call (no shared mutable state)
    }
  });

  it("isRcllLayoutProfile guards the enum", () => {
    expect(isRcllLayoutProfile("compact")).toBe(true);
    expect(isRcllLayoutProfile("balanced")).toBe(true);
    expect(isRcllLayoutProfile("readable")).toBe(true);
    expect(isRcllLayoutProfile("sideways")).toBe(false);
    expect(isRcllLayoutProfile(undefined)).toBe(false);
    expect(isRcllLayoutProfile(null)).toBe(false);
  });
});
