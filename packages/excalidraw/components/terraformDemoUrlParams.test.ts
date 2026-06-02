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

    it("rejects invalid view or pack", () => {
      expect(
        parseTerraformDemoUrlParams("?preset=demo&view=invalid"),
      ).toBeNull();
      expect(
        parseTerraformDemoUrlParams("?preset=demo&pack=invalid"),
      ).toBeNull();
      expect(parseTerraformDemoUrlParams("?preset=bad id")).toBeNull();
    });
  });

  describe("hasTerraformDemoAutoImportQuery", () => {
    it("detects auto-import queries", () => {
      expect(hasTerraformDemoAutoImportQuery("?preset=demo")).toBe(true);
      expect(hasTerraformDemoAutoImportQuery("?view=semantic")).toBe(false);
    });
  });
});
