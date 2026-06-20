import { describe, expect, it } from "vitest";

import {
  hasTerraformDemoAutoImportQuery,
  isDemoPathname,
  normalizePresetIdParam,
  parseTerraformDemoUrlParams,
} from "./terraformDemoUrlParams";

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

    it("parses subnetDeBand (RCLL subnet de-band A/B)", () => {
      expect(
        parseTerraformDemoUrlParams("?preset=demo&view=rcll&subnetDeBand=1"),
      ).toEqual({
        presetId: "demo",
        view: "rcll",
        subnetDeBand: true,
      });
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

    it("parses deDensify (RCLL M5b A/B)", () => {
      expect(
        parseTerraformDemoUrlParams("?preset=demo&view=rcll&deDensify=1"),
      ).toEqual({ presetId: "demo", view: "rcll", deDensify: true });
      expect(parseTerraformDemoUrlParams("?preset=demo&deDensify=0")).toEqual({
        presetId: "demo",
        deDensify: false,
      });
      expect(
        parseTerraformDemoUrlParams("?preset=demo&deDensify=maybe"),
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
});
