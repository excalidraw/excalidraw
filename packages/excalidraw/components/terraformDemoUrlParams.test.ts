import { describe, expect, it } from "vitest";

import {
  buildTerraformDemoUrl,
  buildTerraformDemoUrlFromSettings,
  collectTerraformDemoParams,
  hasTerraformDemoAutoImportQuery,
  isDemoPathname,
  normalizePresetIdParam,
  parseTerraformDemoUrlParams,
  type TerraformDemoSettingsSnapshot,
  type TerraformDemoUrlParams,
} from "./terraformDemoUrlParams";

const queryOf = (url: string): string => url.slice(url.indexOf("?"));

const baseSnapshot: TerraformDemoSettingsSnapshot = {
  presetId: "staging-extended-localstack-v2",
  view: "rcll",
  pipelineCompact: true,
  pipelineLayoutVariant: "classic",
  pipelinePacked: false,
  pipelinePackedPullLeft: false,
  pipelineIncludeAncillary: false,
  pipelineSemanticPlacement: false,
  pipelineSwimlaneLaneRise: false,
  pipelineReorder: false,
  pipelineCrossingMin: false,
  pipelineDeBandLevel: "none",
  pipelineRankSeparate: false,
  pipelineStraighten: false,
  pipelineColumnPacking: "none",
  pipelineLayoutProfile: "balanced",
  pipelineStaircaseBandOverlap: true,
  moduleLayoutMode: "default",
};

describe("terraformDemoUrlParams", () => {
  describe("isDemoPathname", () => {
    it("matches /demo routes", () => {
      expect(isDemoPathname("/demo")).toBe(true);
      expect(isDemoPathname("/demo/")).toBe(true);
      expect(isDemoPathname("/")).toBe(false);
    });
  });

  describe("normalizePresetIdParam", () => {
    it("accepts slug ids", () => {
      expect(normalizePresetIdParam("staging-multi-state-expanded")).toBe(
        "staging-multi-state-expanded",
      );
    });

    it("rejects unsafe ids", () => {
      expect(normalizePresetIdParam("")).toBeNull();
      expect(normalizePresetIdParam("../etc")).toBeNull();
      expect(normalizePresetIdParam("bad id")).toBeNull();
    });

    it("lowercases preset ids", () => {
      expect(normalizePresetIdParam("Staging-Multi-State")).toBe(
        "staging-multi-state",
      );
    });
  });

  describe("parseTerraformDemoUrlParams", () => {
    it("returns null without preset", () => {
      expect(parseTerraformDemoUrlParams("")).toBeNull();
      expect(parseTerraformDemoUrlParams("?view=semantic")).toBeNull();
    });

    it("parses preset only", () => {
      expect(
        parseTerraformDemoUrlParams("?preset=staging-multi-state-expanded"),
      ).toEqual({
        presetId: "staging-multi-state-expanded",
      });
    });

    it("parses view and pack", () => {
      expect(
        parseTerraformDemoUrlParams(
          "?preset=staging-multi-state-expanded&view=module&pack=box",
        ),
      ).toEqual({
        presetId: "staging-multi-state-expanded",
        view: "module",
        pack: "box",
      });
    });

    it("parses pipeline variant and packed", () => {
      expect(
        parseTerraformDemoUrlParams(
          "?preset=staging-extended-localstack-v2&view=pipeline&pipelineVariant=compound&packed=1",
        ),
      ).toEqual({
        presetId: "staging-extended-localstack-v2",
        view: "pipeline",
        pipelineVariant: "compound",
        packed: true,
      });
      expect(parseTerraformDemoUrlParams("?preset=demo&packed=false")).toEqual({
        presetId: "demo",
        packed: false,
      });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&packed=nope"),
      ).toBeNull();
    });

    it("parses compact", () => {
      expect(
        parseTerraformDemoUrlParams("?preset=demo&view=rcll&compact=1"),
      ).toEqual({
        presetId: "demo",
        view: "rcll",
        compact: true,
      });
      expect(parseTerraformDemoUrlParams("?preset=demo&compact=0")).toEqual({
        presetId: "demo",
        compact: false,
      });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&compact=maybe"),
      ).toBeNull();
    });

    it("parses ancillary", () => {
      expect(
        parseTerraformDemoUrlParams("?preset=demo&view=pipeline&ancillary=1"),
      ).toEqual({
        presetId: "demo",
        view: "pipeline",
        ancillary: true,
      });
      expect(parseTerraformDemoUrlParams("?preset=demo&ancillary=0")).toEqual({
        presetId: "demo",
        ancillary: false,
      });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&ancillary=nope"),
      ).toBeNull();
    });

    it("parses swimlaneRise (RCLL M4 A/B)", () => {
      expect(
        parseTerraformDemoUrlParams("?preset=demo&view=rcll&swimlaneRise=1"),
      ).toEqual({
        presetId: "demo",
        view: "rcll",
        swimlaneRise: true,
      });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&swimlaneRise=0"),
      ).toEqual({
        presetId: "demo",
        swimlaneRise: false,
      });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&swimlaneRise=maybe"),
      ).toBeNull();
    });

    it("parses reorder (RCLL M6 A/B)", () => {
      expect(
        parseTerraformDemoUrlParams("?preset=demo&view=rcll&reorder=1"),
      ).toEqual({
        presetId: "demo",
        view: "rcll",
        reorder: true,
      });
      expect(parseTerraformDemoUrlParams("?preset=demo&reorder=0")).toEqual({
        presetId: "demo",
        reorder: false,
      });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&reorder=maybe"),
      ).toBeNull();
    });

    it("parses crossingMin (RCLL M6c container-aware crossing-min)", () => {
      expect(
        parseTerraformDemoUrlParams("?preset=demo&view=rcll&crossingMin=1"),
      ).toEqual({
        presetId: "demo",
        view: "rcll",
        crossingMin: true,
      });
      expect(parseTerraformDemoUrlParams("?preset=demo&crossingMin=0")).toEqual(
        {
          presetId: "demo",
          crossingMin: false,
        },
      );
      expect(
        parseTerraformDemoUrlParams("?preset=demo&crossingMin=maybe"),
      ).toBeNull();
    });

    it("parses subnetDeBand (legacy alias ⇒ deBandLevel=subnet)", () => {
      // The legacy boolean is preserved AND mapped to the generalized de-band enum.
      expect(
        parseTerraformDemoUrlParams("?preset=demo&view=rcll&subnetDeBand=1"),
      ).toEqual({
        presetId: "demo",
        view: "rcll",
        subnetDeBand: true,
        deBandLevel: "subnet",
      });
      // `subnetDeBand=0` does not synthesize a level (stays "none" downstream).
      expect(
        parseTerraformDemoUrlParams("?preset=demo&subnetDeBand=0"),
      ).toEqual({
        presetId: "demo",
        subnetDeBand: false,
      });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&subnetDeBand=maybe"),
      ).toBeNull();
    });

    it("parses deBandLevel (RCLL hierarchy-level de-band depth)", () => {
      expect(
        parseTerraformDemoUrlParams("?preset=demo&view=rcll&deBandLevel=vpc"),
      ).toEqual({
        presetId: "demo",
        view: "rcll",
        deBandLevel: "vpc",
      });
      // Case-insensitive; explicit level wins over a co-present alias.
      expect(
        parseTerraformDemoUrlParams(
          "?preset=demo&subnetDeBand=1&deBandLevel=Region",
        ),
      ).toEqual({
        presetId: "demo",
        subnetDeBand: true,
        deBandLevel: "region",
      });
      // Invalid level hard-fails (same contract as columnPacking / profile).
      expect(
        parseTerraformDemoUrlParams("?preset=demo&deBandLevel=datacenter"),
      ).toBeNull();
    });

    it("parses rankSeparate (RCLL M8r A/B)", () => {
      expect(
        parseTerraformDemoUrlParams("?preset=demo&view=rcll&rankSeparate=1"),
      ).toEqual({ presetId: "demo", view: "rcll", rankSeparate: true });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&rankSeparate=0"),
      ).toEqual({ presetId: "demo", rankSeparate: false });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&rankSeparate=maybe"),
      ).toBeNull();
    });

    it("parses straighten (RCLL M5 A/B)", () => {
      expect(
        parseTerraformDemoUrlParams("?preset=demo&view=rcll&straighten=1"),
      ).toEqual({ presetId: "demo", view: "rcll", straighten: true });
      expect(parseTerraformDemoUrlParams("?preset=demo&straighten=0")).toEqual({
        presetId: "demo",
        straighten: false,
      });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&straighten=maybe"),
      ).toBeNull();
    });

    it("parses deDensify (RCLL M5b A/B) — legacy alias maps to columnPacking=spread", () => {
      expect(
        parseTerraformDemoUrlParams("?preset=demo&view=rcll&deDensify=1"),
      ).toEqual({
        presetId: "demo",
        view: "rcll",
        deDensify: true,
        columnPacking: "spread",
      });
      expect(parseTerraformDemoUrlParams("?preset=demo&deDensify=0")).toEqual({
        presetId: "demo",
        deDensify: false,
      });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&deDensify=maybe"),
      ).toBeNull();
    });

    it("parses columnPacking (RCLL M5b/M5c tri-state) and rejects invalid", () => {
      expect(
        parseTerraformDemoUrlParams(
          "?preset=demo&view=rcll&columnPacking=compact",
        ),
      ).toEqual({ presetId: "demo", view: "rcll", columnPacking: "compact" });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&columnPacking=none"),
      ).toEqual({ presetId: "demo", columnPacking: "none" });
      // explicit columnPacking wins over a legacy deDensify=1
      expect(
        parseTerraformDemoUrlParams(
          "?preset=demo&deDensify=1&columnPacking=compact",
        ),
      ).toEqual({
        presetId: "demo",
        deDensify: true,
        columnPacking: "compact",
      });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&columnPacking=sideways"),
      ).toBeNull();
    });

    it("parses profile (RCLL Layout profile) and rejects invalid", () => {
      expect(
        parseTerraformDemoUrlParams("?preset=demo&view=rcll&profile=compact"),
      ).toEqual({ presetId: "demo", view: "rcll", profile: "compact" });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&profile=readable"),
      ).toEqual({ presetId: "demo", profile: "readable" });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&profile=balanced"),
      ).toEqual({ presetId: "demo", profile: "balanced" });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&profile=sideways"),
      ).toBeNull();
    });

    it("accepts clear aliases (laneRise/laneSplit/cycleRise) for the milestone params", () => {
      // laneRise ⇒ swimlaneRise
      expect(parseTerraformDemoUrlParams("?preset=demo&laneRise=1")).toEqual({
        presetId: "demo",
        swimlaneRise: true,
      });
      // laneSplit ⇒ rankSeparate
      expect(parseTerraformDemoUrlParams("?preset=demo&laneSplit=1")).toEqual({
        presetId: "demo",
        rankSeparate: true,
      });
      // cycleRise ⇒ staircaseBandOverlap
      expect(parseTerraformDemoUrlParams("?preset=demo&cycleRise=0")).toEqual({
        presetId: "demo",
        staircaseBandOverlap: false,
      });
      // the legacy milestone name still works
      expect(
        parseTerraformDemoUrlParams("?preset=demo&swimlaneRise=1"),
      ).toEqual({ presetId: "demo", swimlaneRise: true });
      // an invalid alias value hard-fails
      expect(
        parseTerraformDemoUrlParams("?preset=demo&laneSplit=maybe"),
      ).toBeNull();
    });

    it("parses staircaseBandOverlap (RCLL DEC-1, default on — only =0 is meaningful)", () => {
      // Default on: absent ⇒ omitted (engine default true downstream).
      expect(parseTerraformDemoUrlParams("?preset=demo&view=rcll")).toEqual({
        presetId: "demo",
        view: "rcll",
      });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&staircaseBandOverlap=0"),
      ).toEqual({ presetId: "demo", staircaseBandOverlap: false });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&staircaseBandOverlap=maybe"),
      ).toBeNull();
    });

    it("rejects invalid view or pack", () => {
      expect(
        parseTerraformDemoUrlParams("?preset=demo&view=invalid"),
      ).toBeNull();
      expect(
        parseTerraformDemoUrlParams("?preset=demo&pack=invalid"),
      ).toBeNull();
      expect(parseTerraformDemoUrlParams("?preset=bad id")).toBeNull();
    });

    it("parses view=rcll (deep-link)", () => {
      expect(
        parseTerraformDemoUrlParams(
          "?preset=staging-extended-localstack-v2&view=rcll",
        ),
      ).toEqual({
        presetId: "staging-extended-localstack-v2",
        view: "rcll",
      });
    });

    it("rejects the retired view=experimental (graceful, no auto-import)", () => {
      // Experimental was removed at M0; a stale deep-link must degrade to null,
      // not crash or silently import the wrong view.
      expect(
        parseTerraformDemoUrlParams("?preset=demo&view=experimental"),
      ).toBeNull();
    });
  });

  describe("hasTerraformDemoAutoImportQuery", () => {
    it("detects auto-import queries", () => {
      expect(hasTerraformDemoAutoImportQuery("?preset=demo")).toBe(true);
      expect(hasTerraformDemoAutoImportQuery("?view=semantic")).toBe(false);
    });
  });

  describe("buildTerraformDemoUrl", () => {
    it("emits a /demo path with the preset and origin", () => {
      const url = buildTerraformDemoUrl(
        { presetId: "demo", view: "rcll" },
        { origin: "https://tfdraw.dev" },
      );
      expect(url.startsWith("https://tfdraw.dev/demo?")).toBe(true);
      expect(url).toContain("preset=demo");
      expect(url).toContain("view=rcll");
    });

    it("serializes booleans as 1/0 and skips undefined fields", () => {
      const url = buildTerraformDemoUrl({
        presetId: "demo",
        ancillary: true,
        compact: false,
      });
      const params = new URLSearchParams(queryOf(url).slice(1));
      expect(params.get("ancillary")).toBe("1");
      expect(params.get("compact")).toBe("0");
      expect(params.has("reorder")).toBe(false);
    });

    it("round-trips every demo param through the parser", () => {
      const full: TerraformDemoUrlParams = {
        presetId: "staging-extended-localstack-v2",
        view: "rcll",
        compact: false,
        ancillary: true,
        swimlaneRise: true,
        reorder: true,
        crossingMin: true,
        deBandLevel: "region",
        rankSeparate: true,
        straighten: true,
        columnPacking: "compact",
        staircaseBandOverlap: false,
      };
      expect(
        parseTerraformDemoUrlParams(queryOf(buildTerraformDemoUrl(full))),
      ).toEqual(full);
    });
  });

  describe("collectTerraformDemoParams", () => {
    it("semantic view carries only preset + view", () => {
      expect(
        collectTerraformDemoParams({ ...baseSnapshot, view: "semantic" }),
      ).toEqual({ presetId: baseSnapshot.presetId, view: "semantic" });
    });

    it("module view emits pack only when non-default", () => {
      expect(
        collectTerraformDemoParams({
          ...baseSnapshot,
          view: "module",
          moduleLayoutMode: "default",
        }),
      ).toEqual({ presetId: baseSnapshot.presetId, view: "module" });
      expect(
        collectTerraformDemoParams({
          ...baseSnapshot,
          view: "module",
          moduleLayoutMode: "rectpacking",
        }).pack,
      ).toBe("rectpacking");
    });

    it("pipeline view captures variant, packing, ancillary, placement", () => {
      const params = collectTerraformDemoParams({
        ...baseSnapshot,
        view: "pipeline",
        pipelineLayoutVariant: "compound",
        pipelinePacked: true,
        pipelinePackedPullLeft: true,
        pipelineIncludeAncillary: true,
        pipelineSemanticPlacement: true,
      });
      expect(params).toMatchObject({
        view: "pipeline",
        pipelineVariant: "compound",
        packed: true,
        packedPullLeft: true,
        ancillary: true,
        semanticPlace: true,
      });
    });

    it("rcll view with a named profile emits profile, not raw flags", () => {
      const params = collectTerraformDemoParams({
        ...baseSnapshot,
        view: "rcll",
        pipelineLayoutProfile: "compact",
      });
      expect(params.profile).toBe("compact");
      expect(params.swimlaneRise).toBeUndefined();
      expect(params.straighten).toBeUndefined();
      // Independent toggles are still captured.
      expect(params.compact).toBe(true);
      expect(params.ancillary).toBe(false);
    });

    it("rcll view with a custom profile spells out the eight flags", () => {
      const params = collectTerraformDemoParams({
        ...baseSnapshot,
        view: "rcll",
        pipelineLayoutProfile: "custom",
        pipelineSwimlaneLaneRise: true,
        pipelineRankSeparate: true,
        pipelineDeBandLevel: "vpc",
        pipelineStaircaseBandOverlap: false,
        pipelineReorder: true,
        pipelineCrossingMin: true,
        pipelineStraighten: true,
        pipelineColumnPacking: "spread",
      });
      expect(params.profile).toBeUndefined();
      expect(params).toMatchObject({
        swimlaneRise: true,
        rankSeparate: true,
        deBandLevel: "vpc",
        staircaseBandOverlap: false,
        reorder: true,
        crossingMin: true,
        straighten: true,
        columnPacking: "spread",
      });
    });
  });

  describe("buildTerraformDemoUrlFromSettings", () => {
    it("round-trips a custom rcll snapshot through the parser", () => {
      const snapshot: TerraformDemoSettingsSnapshot = {
        ...baseSnapshot,
        view: "rcll",
        pipelineCompact: false,
        pipelineIncludeAncillary: true,
        pipelineLayoutProfile: "custom",
        pipelineSwimlaneLaneRise: true,
        pipelineRankSeparate: true,
        pipelineDeBandLevel: "account",
        pipelineStaircaseBandOverlap: false,
        pipelineReorder: true,
        pipelineCrossingMin: true,
        pipelineStraighten: true,
        pipelineColumnPacking: "compact",
      };
      const parsed = parseTerraformDemoUrlParams(
        queryOf(buildTerraformDemoUrlFromSettings(snapshot)),
      );
      expect(parsed).toEqual(collectTerraformDemoParams(snapshot));
    });
  });

  describe("runtime canvas view settings", () => {
    it("parses lod, minimap, layers, and canvasPerf", () => {
      const parsed = parseTerraformDemoUrlParams(
        "?preset=demo&view=rcll&lodEnabled=0&lodPreset=detailed&minimap=1" +
          "&layers=dep,net&canvasPerf=hideicons,noclip&canvasPerfZoom=0.4",
      );
      expect(parsed).toMatchObject({
        presetId: "demo",
        view: "rcll",
        lodEnabled: false,
        lodPreset: "detailed",
        minimap: true,
        edgeLayerPins: {
          dependency: true,
          networking: true,
          dataFlow: false,
          declaredDataFlow: false,
          topologyFrameFlow: false,
        },
        runtimePerformance: {
          hideAwsIconGlyphsBelowZoom: true,
          suppressFrameClippingBelowZoom: true,
          suppressHoverFocusBelowZoom: false,
          debounceHoverFocus: false,
          skipBindingRepairDuringFocus: false,
          lowZoomThreshold: 0.4,
        },
      });
    });

    it("treats layers=none and canvasPerf=none as all-off", () => {
      const parsed = parseTerraformDemoUrlParams(
        "?preset=demo&layers=none&canvasPerf=none",
      );
      expect(parsed?.edgeLayerPins).toEqual({
        dependency: false,
        dataFlow: false,
        declaredDataFlow: false,
        networking: false,
        topologyFrameFlow: false,
      });
      expect(parsed?.runtimePerformance?.hideAwsIconGlyphsBelowZoom).toBe(
        false,
      );
    });

    it("hard-fails on an unknown layer code or perf threshold", () => {
      expect(
        parseTerraformDemoUrlParams("?preset=demo&layers=dep,bogus"),
      ).toBeNull();
      expect(
        parseTerraformDemoUrlParams("?preset=demo&canvasPerfZoom=0.9"),
      ).toBeNull();
      expect(
        parseTerraformDemoUrlParams("?preset=demo&lodPreset=ultra"),
      ).toBeNull();
    });

    it("round-trips a full runtime-settings params object", () => {
      const full: TerraformDemoUrlParams = {
        presetId: "demo",
        view: "rcll",
        lodEnabled: true,
        lodPreset: "performance",
        minimap: false,
        edgeLayerPins: {
          dependency: true,
          dataFlow: false,
          declaredDataFlow: true,
          networking: false,
          topologyFrameFlow: true,
        },
        runtimePerformance: {
          hideAwsIconGlyphsBelowZoom: true,
          suppressHoverFocusBelowZoom: false,
          debounceHoverFocus: true,
          suppressFrameClippingBelowZoom: false,
          skipBindingRepairDuringFocus: true,
          lowZoomThreshold: 0.2,
        },
      };
      expect(
        parseTerraformDemoUrlParams(queryOf(buildTerraformDemoUrl(full))),
      ).toEqual(full);
    });
  });
});
